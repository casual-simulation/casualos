import prompts from 'prompts';
import { Command } from 'commander';
import {
    RecordsClient,
    createRecordsClient,
} from '@casual-simulation/aux-records/RecordsClient';
import { askForInputs } from './schema';

// @ts-ignore
import Conf from 'conf';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';

const REFRESH_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

const config = new Conf({
    projectName: 'casualos-cli',
});
const program = new Command();

let client: ReturnType<typeof createRecordsClient>;

async function getClient(endpoint: string) {
    if (!endpoint) {
        endpoint = await getEndpoint();
    }
    if (!client) {
        client = createRecordsClient(endpoint);
    }
    return client;
}

program
    .name('casualos')
    .description('A CLI for CasualOS')
    .version('0.0.1')
    .option('-e, --endpoint <url>', 'The endpoint to use for queries.');

program
    .command('login')
    .description('Login to the CasualOS API')
    .action(async () => {
        const opts = program.optsWithGlobals();
        const endpoint = opts.endpoint;
        await login(opts.endpoint);
    });

program
    .command('set-endpoint')
    .description('Set the endpoint that is currently in use.')
    .action(async () => {
        await updateEndpoint();
    });

program
    .command('query')
    .description('Query the CasualOS API')
    .argument('[procedure]', 'The procedure to execute')
    .option('-k, --key <key>', 'The session key to use for the query.')
    .action(async (procedure, options) => {
        const opts = program.optsWithGlobals();
        const endpoint = opts.endpoint;
        const client = await getClient(endpoint);
        if (options.key) {
            client.sessionKey = await getSessionKey(endpoint, options.key);
        }
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

        const input = await askForInputs(operation.inputs, operation.name);

        console.log('Your input:', input);

        const confirm = await prompts({
            type: 'confirm',
            name: 'continue',
            message: 'Do you want to continue?',
        });

        if (confirm.continue) {
            let result = await client.callProcedure(operation.name, input, {
                headers: getHeaders(),
            });

            if (
                result.success === false &&
                result.errorCode === 'not_logged_in'
            ) {
                const loginResponse = await prompts({
                    type: 'confirm',
                    name: 'login',
                    message:
                        'You are not logged in. Do you want to log in and try again?',
                });

                if (loginResponse.login) {
                    if (await login(endpoint)) {
                        result = await client.callProcedure(
                            operation.name,
                            input,
                            {
                                headers: getHeaders(),
                            }
                        );
                    }
                }
            }

            console.log('Result:', result);
        } else {
            console.log('Cancelled.');
        }
    });

async function getSessionKey(
    endpoint: string,
    key?: string,
    loginIfNecessary = false
) {
    if (key) {
        return key;
    }

    key = String(config.get(`${endpoint}:sessionKey`));

    const parsed = parseSessionKey(key);

    if (!parsed) {
        if (loginIfNecessary && (await login(endpoint))) {
            return getSessionKey(endpoint);
        }

        return null;
    }

    const [userId, sessionId, secret, expireTimeMs] = parsed;

    if (expireTimeMs < Date.now()) {
        if (loginIfNecessary && (await login(endpoint))) {
            return getSessionKey(endpoint);
        }
    } else {
        const lifetimeMs = expireTimeMs - Date.now();
        const refreshTimeMs = Math.max(lifetimeMs - REFRESH_LIFETIME_MS, 0);

        if (loginIfNecessary && refreshTimeMs < REFRESH_LIFETIME_MS) {
            console.log(
                `Session key expires in less than one week. Replacing stored session key.`
            );

            if (await login(endpoint)) {
                return getSessionKey(endpoint);
            }
        }
    }

    return key;
}

async function login(endpoint: string) {
    const client = await getClient(endpoint);

    const response = await prompts([
        {
            type: 'select',
            name: 'type',
            choices: [
                {
                    title: 'Email',
                    value: 'email',
                },
                {
                    title: 'phone',
                    value: 'phone',
                },
            ],
        },
        {
            type: 'text',
            name: 'address',
            message: 'Enter your address.',
        },
    ]);

    const addressType = response.type;
    const address = response.address;

    const result = await client.requestLogin(
        {
            address: address,
            addressType: addressType,
        },
        {
            headers: getHeaders(),
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
                headers: getHeaders(),
            }
        );

        if (loginResult.success === true) {
            config.set(`${endpoint}:sessionKey`, loginResult.sessionKey);
            console.log('Login successful!');
            return true;
        } else {
            console.log('Failed to complete login:');
            console.log(loginResult);
            return false;
        }
    } else {
        console.log('Failed to create login request:');
        console.log(result);
        return false;
    }
}

async function getEndpoint() {
    let savedEndpoint = String(config.get('currentEndpoint'));
    if (!savedEndpoint) {
        savedEndpoint = await updateEndpoint();
    }
    return savedEndpoint;
}

async function updateEndpoint() {
    const response = await prompts({
        type: 'text',
        name: 'endpoint',
        message: 'Enter the endpoint to use for queries.',
    });

    const savedEndpoint = response.endpoint;
    config.set('currentEndpoint', savedEndpoint);
    console.log('Endpoint updated to ' + savedEndpoint);
    return savedEndpoint;
}

function getHeaders() {
    return {
        origin: client.endpoint,
    };
}

async function main() {
    try {
        await program.parseAsync(process.argv);
    } catch (err) {
        console.error(err);
    }
}

main();

// async function start() {
//     const reponse = await prompts({
//         type: 'select',
//         name: 'action',
//         message: 'What would you like to do?',
//         choices: [
//             { title: 'Migrate', value: 'migrate' },
//             { title: 'Collect Responses', value: 'collect' },
//         ],
//     });

//     if (reponse.action === 'migrate') {
//         await migrate();
//     } else {
//         await collectAndSaveResponses();
//     }
// }
