import prompts from 'prompts';
import { Command } from 'commander';
import {
    RecordsClient,
    createRecordsClient,
} from '@casual-simulation/aux-records/RecordsClient';
import { askForInputs } from './schema';
import repl from 'node:repl';

// @ts-ignore
import Conf from 'conf';

import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import {
    AddressType,
    CompleteLoginSuccess,
    CompleteOpenIDLoginSuccess,
    getExpireTime,
} from '@casual-simulation/aux-records';
import { stderr, stdout } from 'process';
import { Duplex, PassThrough, Readable } from 'node:stream';

const REFRESH_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

const config = new Conf({
    projectName: 'casualos-cli',
});
const program = new Command();

program
    .name('casualos')
    .description('A CLI for CasualOS')
    .version('0.0.1')
    .option(
        '-e, --endpoint <url>',
        'The endpoint to use for queries. Can be used to override the current endpoint.'
    );

program
    .command('login')
    .description('Login to the CasualOS API')
    .action(async () => {
        const opts = program.optsWithGlobals();
        const endpoint = await getEndpoint(opts.endpoint);
        const client = await getClient(endpoint, getSessionKey(endpoint));
        await login(client);
    });

program
    .command('logout')
    .description('Logout of the CasualOS API')
    .action(async () => {
        const opts = program.optsWithGlobals();
        const endpoint = await getEndpoint(opts.endpoint);
        saveSessionKey(endpoint, null);
        console.log('Logged out!');
    });

program
    .command('set-endpoint')
    .argument(
        '[endpoint]',
        'The endpoint to use for queries. If omitted, then you will be prompted to enter an endpoint.'
    )
    .description('Set the endpoint that is currently in use.')
    .action(async (endpoint) => {
        if (endpoint) {
            saveCurrentEndpoint(endpoint);
        } else {
            await updateEndpoint();
        }
    });

program
    .command('status')
    .description('Get the status of the current session.')
    .action(async () => {
        const endpoint = getCurrentEndpoint();
        printStatus(endpoint);
    });

program
    .command('query')
    .description('Query the CasualOS API')
    .argument(
        '[procedure]',
        'The procedure to execute. If omitted, then you will be prompted to select a procedure.'
    )
    .argument(
        '[input]',
        'The input to the procedure. If specified, then it will be parsed as JSON. If omitted, then you will be prompted to enter the input.'
    )
    .option(
        '-k, --key <key>',
        'The session key to use for the query. If not specified, then the current session key will be used.'
    )
    .action(async (procedure, input, options) => {
        const opts = program.optsWithGlobals();
        const endpoint = await getEndpoint(opts.endpoint);
        const client = await getClient(
            endpoint,
            opts.key ?? (await getOrRefreshSessionKey(endpoint))
        );

        await query(client, procedure, input);
    });

program
    .command('repl')
    .description('Start a REPL for the CasualOS API')
    .option(
        '-k, --key <key>',
        'The session key to use for the session. If omitted, then the current session key will be used.'
    )
    .addHelpText(
        'after',
        `\nThe CasualOS REPL allows you to interact with the CasualOS API using a Read-Eval-Print Loop (REPL).\nIt supports JavaScript and has a special function, query([procedure], [input]), that can be used to query the API.`
    )
    .action(async (options) => {
        const opts = program.optsWithGlobals();
        const endpoint = await getEndpoint(opts.endpoint);
        const client = await getClient(
            endpoint,
            opts.key ?? (await getOrRefreshSessionKey(endpoint))
        );

        const replIn = new PassThrough();

        process.stdin.pipe(replIn);

        function pauseRepl(func: (...args: any[]) => Promise<void>) {
            return async (...args: any[]) => {
                process.stdin.unpipe(replIn);
                replIn.pause();
                try {
                    return await func(...args);
                } finally {
                    replIn.resume();
                    process.stdin.pipe(replIn);
                }
            };
        }

        const replServer = repl.start({
            prompt: 'casualos > ',
            input: replIn,
            output: process.stdout,
        });

        replServer.on('exit', () => {
            process.stdin.unpipe(replIn);
        });

        replServer.defineCommand('login', {
            help: 'Login to the CasualOS API',
            action(cmd) {
                console.log('command: ', cmd);
                const _this = this;
                async function loginImpl() {
                    try {
                        _this.pause();
                        await login(client);
                    } finally {
                        _this.resume();
                        _this.displayPrompt();
                    }
                }

                loginImpl();
            },
        });

        Object.defineProperties(replServer.context, {
            query: {
                configurable: false,
                writable: false,
                enumerable: true,
                value: pauseRepl(async (procedure: string, input: any) => {
                    return await query(client, procedure, input, false, true);
                }),
            },
        });
    });

async function query(
    client: ReturnType<typeof createRecordsClient>,
    procedure: string,
    input: any,
    shouldConfirm: boolean = true,
    isJavaScriptInput: boolean = false
) {
    const availableOperations = await client.listProcedures({});
    if (!procedure) {
        const response = await prompts({
            type: 'select',
            name: 'procedure',
            message: 'Select the procedure to execute',
            choices: availableOperations.procedures.map((op) => ({
                title: op.name,
                value: op.name,
            })),
        });
        procedure = response.procedure;
    }

    const operation = availableOperations.procedures.find(
        (p) => p.name === procedure
    );

    if (!operation) {
        console.error(`Could not find operation ${procedure}!`);
        return;
    }

    console.log('Your selected operation:', operation);

    if (!input) {
        input = await askForInputs(operation.inputs, operation.name);
    } else if (!isJavaScriptInput) {
        input = JSON.parse(input);
    }
    console.log('Your input:', input);

    let continueRequest = true;
    if (shouldConfirm) {
        const confirm = await prompts({
            type: 'confirm',
            name: 'continue',
            message: 'Do you want to continue?',
            initial: true,
        });

        continueRequest = confirm.continue;
    }

    if (continueRequest) {
        const result = await callProcedure(client, operation.name, input);
        if (shouldConfirm) {
            console.log('Result:', result);
        }
        return result;
    } else {
        console.log('Cancelled.');
    }
}

async function callProcedure(
    client: ReturnType<typeof createRecordsClient>,
    operation: string,
    input: any
) {
    while (true) {
        const result = await client.callProcedure(operation, input, {
            headers: getHeaders(client),
        });

        if (result.success === false && result.errorCode === 'not_logged_in') {
            const loginResponse = await prompts({
                type: 'confirm',
                name: 'login',
                message:
                    'You are not logged in. Do you want to log in and try again?',
                initial: true,
            });

            if (loginResponse.login) {
                const key = await login(client);
                if (!key) {
                    return result;
                }
            } else {
                return result;
            }
        } else {
            return result;
        }
    }
}

async function getClient(endpoint: string, key: string) {
    printStatus(endpoint);

    const client = createRecordsClient(endpoint);
    if (key) {
        client.sessionKey = key;
    }
    return client;
}

async function getOrRefreshSessionKey(endpoint: string) {
    const key = getSessionKey(endpoint);

    if (isExpired(key)) {
        return null;
    } else if (willExpire(key)) {
        return await replaceSessionKey(endpoint, key);
    }

    return key;
}

function getSessionKey(endpoint: string) {
    return convertToString(config.get(`${endpoint}:sessionKey`));
}

function saveSessionKey(endpoint: string, key: string) {
    config.set(`${endpoint}:sessionKey`, key);
}

function saveLoginResult(
    client: ReturnType<typeof createRecordsClient>,
    result: CompleteLoginSuccess | CompleteOpenIDLoginSuccess
) {
    if (!result) {
        saveSessionKey(client.endpoint, null);
        client.sessionKey = null;
    } else {
        saveSessionKey(client.endpoint, result.sessionKey);
        client.sessionKey = result.sessionKey;
    }
}

function getExpiration(key: string): number {
    const parsed = parseSessionKey(key);

    if (!parsed) {
        return 0;
    }

    const [userId, sessionId, secret, expireTimeMs] = parsed;

    return expireTimeMs;
}

function isExpired(key: string) {
    const expireTimeMs = getExpiration(key);
    return expireTimeMs < Date.now();
}

function willExpire(key: string) {
    const expireTimeMs = getExpiration(key);
    const lifetimeMs = expireTimeMs - Date.now();
    const refreshTimeMs = Math.max(lifetimeMs - REFRESH_LIFETIME_MS, 0);
    return refreshTimeMs < 0;
}

async function login(client: ReturnType<typeof createRecordsClient>) {
    const response = await prompts([
        {
            type: 'select',
            name: 'type',
            message: 'Select the type of address to use for login.',
            choices: [
                {
                    title: 'Email',
                    value: 'email',
                },
                {
                    title: 'Phone',
                    value: 'phone',
                },
                {
                    title: 'Privo',
                    value: 'privo',
                },
            ],
        },
    ]);

    if (response.type === 'privo') {
        return await loginWithPrivo(client);
    } else if (response.type === 'email' || response.type === 'phone') {
        const addressResponse = await prompts({
            type: 'text',
            name: 'address',
            message: 'Enter your address.',
        });

        const addressType = response.type;
        const address = addressResponse.address;

        return await loginWithCode(client, address, addressType);
    }
}

async function loginWithCode(
    client: ReturnType<typeof createRecordsClient>,
    address: string,
    addressType: AddressType
) {
    const result = await client.requestLogin(
        {
            address: address,
            addressType: addressType,
        },
        {
            headers: getHeaders(client),
        }
    );

    if (result.success) {
        const response = await prompts({
            type: 'text',
            name: 'code',
            message: 'Enter the code that was sent to your address.',
        });

        const code = response.code;

        const loginResult = await client.completeLogin(
            {
                code: code,
                requestId: result.requestId,
                userId: result.userId,
            },
            {
                headers: getHeaders(client),
            }
        );

        if (loginResult.success === true) {
            saveLoginResult(client, loginResult);
            console.log('Login successful!');
            return loginResult.sessionKey;
        } else {
            saveLoginResult(client, null);
            console.log('Failed to complete login:');
            console.log(loginResult);
            return null;
        }
    } else {
        saveLoginResult(client, null);
        console.log('Failed to create login request:');
        console.log(result);
        return null;
    }
}

async function loginWithPrivo(client: ReturnType<typeof createRecordsClient>) {
    const result = await client.requestPrivoLogin(
        {},
        {
            headers: getHeaders(client),
        }
    );

    if (result.success === false) {
        saveLoginResult(client, null);
        console.log('Failed to request Privo login:');
        console.log(result);
        return null;
    }

    const open = (await import('open')).default;
    await open(result.authorizationUrl);

    const startTime = Date.now();
    const timeout = 1000 * 60 * 5; // 5 minutes
    while (Date.now() - startTime < timeout) {
        const loginResult = await client.completeOAuthLogin(
            {
                requestId: result.requestId,
            },
            {
                headers: getHeaders(client),
            }
        );

        if (loginResult.success === true) {
            saveLoginResult(client, loginResult);
            console.log('Login successful!');
            return loginResult.sessionKey;
        } else {
            if (loginResult.errorCode === 'not_completed') {
                // Wait for a second before trying again.
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
                saveLoginResult(client, null);
                console.log('Failed to complete login:');
                console.log(loginResult);
                return null;
            }
        }
    }

    saveLoginResult(client, null);
    console.log('Failed to complete login:');
    console.log('Timed out');
    return null;
}

async function replaceSessionKey(endpoint: string, key: string) {
    const client = await getClient(endpoint, key);

    const result = await client.replaceSession(undefined, {
        sessionKey: key,
    });

    if (result.success === true) {
        saveSessionKey(endpoint, result.sessionKey);
        console.log('Session key replaced!');

        return result.sessionKey;
    }

    saveSessionKey(endpoint, null);
    console.log('Failed to replace session key:');
    console.log(result);
    return null;
}

async function getEndpoint(endpoint: string) {
    if (endpoint) {
        return endpoint;
    }
    let savedEndpoint = getCurrentEndpoint();
    console.log('saved endpoint', savedEndpoint);
    if (!savedEndpoint) {
        savedEndpoint = await updateEndpoint();
    }
    return savedEndpoint;
}

function getCurrentEndpoint() {
    return convertToString(config.get('currentEndpoint'));
}

async function updateEndpoint() {
    const response = await prompts({
        type: 'text',
        name: 'endpoint',
        message: 'Enter the endpoint to use for queries.',
    });

    const savedEndpoint = response.endpoint;
    saveCurrentEndpoint(savedEndpoint);
    return savedEndpoint;
}

function saveCurrentEndpoint(endpoint: string) {
    config.set('currentEndpoint', endpoint);
    console.log('Endpoint updated to:', endpoint);
}

function getHeaders(client: RecordsClient) {
    return {
        origin: client.endpoint,
    };
}

function printStatus(endpoint: string) {
    if (!endpoint) {
        console.log('No endpoint is currently set.');
        console.log('Set an endpoint using the set-endpoint command.');
        return;
    }

    console.log('Current endpoint:', endpoint);

    const key = getSessionKey(endpoint);
    if (key) {
        const expire = getExpiration(key);
        if (expire < Date.now()) {
            console.log('The current session has expired.');
        } else {
            console.log('You are logged in.');
            console.log('Session expires at:', new Date(expire).toString());
        }
    } else {
        console.log('You are not logged in.');
    }
}

async function main() {
    try {
        await program.parseAsync(process.argv);
    } catch (err) {
        console.error(err);
    }
}

function convertToString(str: unknown): string {
    if (typeof str === 'undefined' || str === null) {
        return str as string;
    }
    return String(str);
}

main();