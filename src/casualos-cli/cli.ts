/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import prompts from 'prompts';
import { Command } from 'commander';
import type { RecordsClient } from '@casual-simulation/aux-records/RecordsClient';

/* eslint-disable casualos/no-non-type-imports */
import { createRecordsClient } from '@casual-simulation/aux-records/RecordsClient';

import { askForInputs, onState } from './schema';
import repl from 'node:repl';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Conf from 'conf';

import type { BotsState } from '@casual-simulation/aux-common';
import {
    getBotsStateFromStoredAux,
    getSessionKeyExpiration,
    isExpired,
    parseSessionKey,
    willExpire,
} from '@casual-simulation/aux-common';
import type {
    AddressType,
    CompleteLoginSuccess,
    CompleteOpenIDLoginSuccess,
} from '@casual-simulation/aux-records';
import { serverConfigSchema } from '@casual-simulation/aux-records';
import { PassThrough } from 'node:stream';
import { getSchemaMetadata } from '@casual-simulation/aux-common';
import path from 'path';
import { readFile } from 'fs/promises';
import { setupInfraCommands } from 'infra';
import type { CliConfig } from './config';
import { z } from 'zod';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { writeFile } from 'node:fs/promises';

const REFRESH_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

const config: CliConfig = new Conf({
    projectName: 'casualos-cli',
});
const program = new Command();

declare const GIT_TAG: string;

program
    .name('casualos')
    .description('A CLI for CasualOS')
    .version(GIT_TAG)
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
            endpoint = await updateEndpoint();
        }

        const origin = getOrigin(endpoint);
        if (origin !== endpoint) {
            const response = await prompts({
                type: 'confirm',
                name: 'confirm',
                message: `The origin for the endpoint (${origin}) is different from the endpoint (${endpoint}) itself. Do you want to keep it?`,
                initial: true,
                onState,
            });

            if (response.confirm) {
                return;
            }
        }

        const originResponse = await prompts({
            type: 'text',
            name: 'origin',
            message: 'Enter the origin to use for requests to this endpoint.',
            initial: endpoint,
            onState,
        });

        saveOrigin(endpoint, originResponse.origin);
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
        const key = opts.key ?? (await getOrRefreshSessionKey(endpoint));
        const client = await getClient(endpoint, key);

        let userId: string = null;
        if (key) {
            const parseResult = parseSessionKey(key);
            if (parseResult) {
                userId = parseResult[0];
            }
        }

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

        Object.defineProperties(replServer.context, {
            query: {
                configurable: false,
                writable: false,
                enumerable: true,
                value: pauseRepl(async (procedure: string, input: any) => {
                    return await query(
                        client,
                        procedure,
                        input,
                        false,
                        true,
                        replServer
                    );
                }),
            },
            userId: {
                configurable: false,
                writable: false,
                enumerable: true,
                value: userId,
            },
        });
    });

const auxActions = new Set(['convert', 'genfs']);

program
    .command('aux')
    .argument('[action]', 'The action to take related to aux files.')
    .option('-ls, --list', 'List possible aux actions')
    .description('Work with aux files and their contents.')
    .action(async (action, options) => {
        if (options.list) {
            console.log(
                `Possible aux actions: ${Array.from(auxActions).join(', ')}`
            );
            return;
        }
        if (!auxActions.has(action ?? '')) {
            console.warn(
                `Unrecognized action "${
                    action ?? ''
                }" provided.\nUse -ls or --list to view possible actions.`
            );
        }
        switch (action) {
            case 'convert':
                return await auxConvert();
                break;
            case 'genfs':
                return await auxGenFs();
                break;
            default:
                break;
        }
    });

program
    .command('generate-server-config')
    .option('-p, --pretty', 'Pretty print the output.')
    .description('Generate a server config for CasualOS.')
    .action(async () => {
        const metadata = getSchemaMetadata(serverConfigSchema);
        const result = await askForInputs(metadata, 'serverConfig');

        const isValid = serverConfigSchema.safeParse(result);
        if (isValid.success === false) {
            console.error('Generated config is invalid:');
            console.error(isValid.error.toString());
        }

        if (result) {
            const output = JSON.stringify(result, null, 2);
            console.log(output);
        } else {
            console.log(JSON.stringify(result));
        }
    });

program
    .command('validate-server-config')
    .option('--json <config>', 'The JSON to validate.')
    .option('-f, --file <file>', 'The file to validate.')
    .description('Validate a server config for CasualOS.')
    .action(async (options) => {
        let configJson: string;
        if (options.json) {
            configJson = options.json;
        } else {
            const fullPath = path.resolve(options.file);
            configJson = await readFile(fullPath, 'utf-8');
        }

        const parsed = JSON.parse(configJson);
        const result = serverConfigSchema.safeParse(parsed);
        if (result.success == true) {
            console.log('Config is valid!');
        } else {
            console.error('Config is invalid:');
            console.error(result.error.toString());
            process.exit(1);
        }
    });

setupInfraCommands(program.command('infra'), config);

/**
 * Validates the given file is a proper aux file.
 * This function checks if the file exists, is a file, and has the correct extension.
 * If the file is valid, it returns the parsed bot state from the aux file.
 * @param filePath The path to the file whose to be validated.
 * @param opts Optional options to skip parsing or contents validation.
 */
async function validateAuxFile(
    filePath: string,
    opts?: { skipParse?: true; skipContents?: true }
) {
    const targetStat = statSync(filePath);
    if (!targetStat.isFile())
        return { success: false, error: 'Path is not a file.' };
    if (filePath.slice(-4) !== '.aux')
        return {
            success: false,
            error: 'Invalid file type provided. Expected ".aux"',
        };

    if (opts?.skipParse) return { success: true, botState: null };

    try {
        const contents = JSON.parse(
            await readFile(filePath, { encoding: 'utf-8' })
        );
        if (opts?.skipContents)
            return {
                success: contents !== null,
                botState: null,
            };
        const botState = getBotsStateFromStoredAux(contents);
        if (!botState)
            return {
                success: false,
                error: `Aux file at ${filePath} is not a valid (or supported) aux file.`,
            };
        return { success: true, botState };
    } catch (err) {
        return {
            success: false,
            error: `Could not read or parse aux file at ${filePath}.\n\n${err}`,
        };
    }
}

/**
 * Allows usage of instanceof DirectoryMarker to quickly check if a property is meant to represent a directory.
 */
class DirectoryMarker {
    constructor() {}
}

const prefixes = new Set(['@', '📖', '🧬', '📝', '🔢', '📅', '➡️', '🔁']);

function botStateToFileSystem(botState: BotsState) {
    const directory: Record<string, any> = new DirectoryMarker();
    const paths = new Set<string>();
    for (const botId of Object.keys(botState)) {
        const tags = botState[botId].tags;
        const system = tags.system ?? botId;
        paths.add(system.replace(/\./g, '/'));
        const subDirs = system.split('.');
        let curDir = directory;
        for (const subDirI in subDirs) {
            const subDir = subDirs[subDirI];
            if (!curDir[subDir]) {
                curDir[subDir] = new DirectoryMarker();
            }
            curDir = curDir[subDir];
        }
        curDir['bot.json'] = {
            tags: {},
            ...(curDir['bot.json'] ?? {}),
            id: botId,
        };
        for (const tag of Object.keys(tags)) {
            const tVal = tags[tag];
            if (typeof tVal !== 'string' || !tVal.includes('\n')) {
                curDir['bot.json'].tags[tag] = tVal;
            } else {
                curDir[
                    `${tag}.${
                        {
                            '@': 'tsx',
                            '📖': 'tsm',
                            '🧬': 'json',
                            '📝': 'text',
                            '🔢': 'number.text',
                            '📅': 'date.text',
                            '➡️': 'vector.text',
                            '🔁': 'rotation.text',
                        }[tVal[0]] ?? 'text'
                    }`
                ] = prefixes.has(tVal[0]) ? tVal.slice(1) : tVal; // Remove prefix if it exists
            }
        }
    }
    return { directory, paths };
}

async function requestFiles(opts: {
    query?: string;
    allowedExtensions?: Set<string>;
}) {
    opts = {
        query: 'target file or directory containing files (path)',
        allowedExtensions: new Set(['.aux']),
        ...opts,
    };
    const targetFD = sanitizePath(
        await askForInputs(getSchemaMetadata(z.string().min(1)), opts.query)
    );
    if (!existsSync(targetFD)) return { directory: null, files: [] };
    const targetStat = statSync(targetFD);
    const files = [];
    if (targetStat.isDirectory()) {
        for (let file of readdirSync(targetFD)) {
            if (opts.allowedExtensions.has(path.extname(file).toLowerCase())) {
                files.push(file);
            }
        }
    } else if (targetStat.isFile()) {
        if (opts.allowedExtensions.has(path.extname(targetFD).toLowerCase())) {
            files.push(path.basename(targetFD));
        } else {
            console.warn(
                `Invalid file type provided.\nExpected one of ${Array.from(
                    opts.allowedExtensions
                ).join(' | ')}.\nGot: ${path.extname(targetFD).toLowerCase()}`
            );
            return;
        }
    } else {
        console.error('Unknown item at path.');
        return;
    }
    return { directory: getDir(targetFD), files };
}

async function requestOutputDirectory(
    query: string = 'output directory to write files to'
) {
    const outDir = sanitizePath(
        await askForInputs(getSchemaMetadata(z.string().min(1)), query)
    );
    if (existsSync(outDir) && statSync(outDir).isDirectory()) return outDir;
    console.error(`Directory does not exist or is not a directory.`);
    return null;
}

async function auxGenFs() {
    const { directory, files } = await requestFiles({
        allowedExtensions: new Set(['.aux']),
    });
    if (files.length < 1) {
        console.error(`No aux file found at/in the provided path.`);
        return;
    }
    const outDir = await requestOutputDirectory();
    if (!outDir) {
        console.error(`Invalid output directory provided.`);
        return;
    }

    for (const file of files) {
        const fileSystem = botStateToFileSystem(
            (await validateAuxFile(replaceWithBasename(directory, file)))
                .botState
        );
        fileSystem.paths.forEach((p) => {
            const fullPath = path.join(outDir, p);
            mkdirSync(fullPath, {
                recursive: true,
            });
            const targetFSDir = p
                .split('/')
                .reduce(
                    (curDir, subDir) => curDir[subDir],
                    fileSystem.directory
                );
            const subFiles = Object.keys(targetFSDir).filter(
                (f) => f !== 'bot.json' && !f.endsWith('.json')
            );
            for (const subFile of subFiles) {
                const writeFilePath = path.join(fullPath, subFile);
                try {
                    writeFileSync(writeFilePath, targetFSDir[subFile]);
                } catch (err) {
                    console.error(
                        `Could not write file: ${writeFilePath}.\n\n${err}\n`
                    );
                }
            }
            try {
                writeFileSync(
                    path.join(fullPath, 'bot.json'),
                    JSON.stringify(targetFSDir['bot.json'], null, 2)
                );
            } catch (err) {
                console.error(
                    `Could not write bot.json file: ${path.join(
                        fullPath,
                        'bot.json'
                    )}.\n\n${err}\n`
                );
            }
        });
    }
}

async function auxConvert() {
    const { directory: targetFD, files: auxFiles } = await requestFiles({
        allowedExtensions: new Set(['.aux']),
    });
    if (auxFiles.length < 1) {
        console.error(`No aux file found at/in the provided path.`);
        return;
    }
    const outDir = await requestOutputDirectory();
    if (!outDir) {
        console.error(`Invalid output directory provided.`);
        return;
    }
    let converted = 0;
    const prefix = outDir === targetFD ? '_' : '';
    for (let file of auxFiles) {
        try {
            await writeFile(
                path.join(outDir, `${prefix}${file}`),
                JSON.stringify(
                    getBotsStateFromStoredAux(
                        JSON.parse(
                            await readFile(
                                replaceWithBasename(targetFD, file),
                                { encoding: 'utf-8' }
                            )
                        )
                    )
                )
            );
            converted++;
        } catch (err) {
            console.error(`Could not convert: ${file}.\n\n${err}\n`);
        }
    }
    console.log(
        `\n🍵 Converted ${converted}/${
            auxFiles.length
        } Files.\n--------------------------\n${auxFiles
            .map((f) => `|✔️ | ${f}`)
            .join('\n')}\n`
    );
}

async function query(
    client: ReturnType<typeof createRecordsClient>,
    procedure: string,
    input: any,
    shouldConfirm: boolean = true,
    isJavaScriptInput: boolean = false,
    repl: repl.REPLServer = null
) {
    const availableOperations = await client.listProcedures({});
    while (
        !procedure ||
        !availableOperations.procedures.find((p) => p.name === procedure)
    ) {
        const response = await prompts({
            type: 'autocomplete',
            name: 'procedure',
            message: 'Select the procedure to execute',
            choices: availableOperations.procedures.map((op) => ({
                title: op.name,
                value: op.name,
            })),
            onState,
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

    let query: any;
    if (operation.query) {
        query = await askForInputs(operation.query, operation.name, repl);
        console.log('Your query:', query);
    }

    if (!input) {
        input = await askForInputs(operation.inputs, operation.name, repl);
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
            onState,
        });

        continueRequest = confirm.continue;
    }

    if (continueRequest) {
        const result = await callProcedure(
            client,
            operation.name,
            input,
            query
        );
        if (shouldConfirm) {
            if (typeof result === 'object' && Symbol.asyncIterator in result) {
                console.log('Result:');
                async function logResult() {
                    for await (let item of result) {
                        console.log(item);
                    }
                }
                logResult();
            } else {
                console.log('Result:', result);
            }
        }
        return result;
    } else {
        console.log('Cancelled.');
    }
}

async function callProcedure(
    client: ReturnType<typeof createRecordsClient>,
    operation: string,
    input: any,
    query: any
) {
    while (true) {
        const result = await client.callProcedure(
            operation,
            input,
            {
                headers: getHeaders(client),
            },
            query
        );

        if (result.success === false && result.errorCode === 'not_logged_in') {
            const loginResponse = await prompts({
                type: 'confirm',
                name: 'login',
                message:
                    'You are not logged in. Do you want to log in and try again?',
                initial: true,
                onState,
            });

            if (loginResponse.login) {
                const key = await login(client);
                if (!key) {
                    return result;
                }
            } else {
                return result;
            }
        } else if (
            result.success === false &&
            result.errorCode === 'invalid_origin'
        ) {
            const originResponse = await prompts({
                type: 'text',
                name: 'origin',
                message:
                    'The endpoint does not allow itself as an origin. Enter the origin to use for the request.',
                onState,
            });

            saveOrigin(client.endpoint, originResponse.origin);
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

    const expiration = getSessionKeyExpiration(key);
    if (isExpired(expiration)) {
        return null;
    } else if (willExpire(expiration)) {
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
            onState,
        },
    ]);

    if (response.type === 'privo') {
        return await loginWithPrivo(client);
    } else if (response.type === 'email' || response.type === 'phone') {
        const addressResponse = await prompts({
            type: 'text',
            name: 'address',
            message: 'Enter your address.',
            onState,
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
            onState,
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
        onState,
    });

    const savedEndpoint = response.endpoint;
    saveCurrentEndpoint(savedEndpoint);
    return savedEndpoint;
}

function saveCurrentEndpoint(endpoint: string) {
    config.set('currentEndpoint', endpoint);
    console.log('Endpoint updated to:', endpoint);
}

function saveOrigin(endpoint: string, origin: string) {
    config.set(`${endpoint}:origin`, origin);
}

function getOrigin(endpoint: string) {
    let origin = config.get(`${endpoint}:origin`);
    if (typeof origin === 'string' && origin) {
        return origin;
    }

    return endpoint;
}

function getHeaders(client: RecordsClient) {
    return {
        origin: getOrigin(client.endpoint),
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
        const expire = getSessionKeyExpiration(key);
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

function sanitizePath(input: string): string {
    const unquoted = input ? input.replace(/^['"]|['"]$/g, '') : '';
    return path.resolve(path.normalize(unquoted));
}

function getDir(base: string): string {
    return statSync(base).isDirectory() ? base : path.dirname(base);
}

function replaceWithBasename(base: string, filename: string): string {
    return path.join(getDir(base), filename);
}

function convertToString(str: unknown): string {
    if (typeof str === 'undefined' || str === null) {
        return str as string;
    }
    return String(str);
}

main();
