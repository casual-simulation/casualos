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
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import _ from 'es-toolkit/compat';
import prompts from 'prompts';

async function start() {
    const envFile = path.resolve(
        __dirname,
        '..',
        'aux-backend',
        'serverless',
        'aws',
        'env.json'
    );
    const serverlessSecretsFile = path.resolve(
        __dirname,
        '..',
        'aux-backend',
        'serverless',
        'aws',
        'secrets.env.json'
    );
    const serverSecretsFile = path.resolve(
        __dirname,
        '..',
        'aux-backend',
        'server',
        'secrets.env.json'
    );
    const env = JSON.parse(readFileSync(envFile, 'utf8'));
    const serverlessSecretsExists = existsSync(serverlessSecretsFile);
    const serverlessSecrets = serverlessSecretsExists
        ? JSON.parse(readFileSync(serverlessSecretsFile, 'utf8'))
        : {};

    if (serverlessSecrets.handleRecords?.SERVER_CONFIG) {
        serverlessSecrets.handleRecords.SERVER_CONFIG = JSON.parse(
            serverlessSecrets.handleRecords.SERVER_CONFIG
        );
    }

    let serverlessResult = _.merge({}, env, serverlessSecrets);
    let serverlessConfig = serverlessResult.handleRecords?.SERVER_CONFIG ?? {};

    let needsUpdate = !serverlessSecretsExists;

    const serverSecretsExists = existsSync(serverSecretsFile);
    const serverSecrets = serverSecretsExists
        ? JSON.parse(readFileSync(serverSecretsFile, 'utf8'))
        : {};

    let serverResult = _.merge({}, serverSecrets);
    let serverConfig = serverResult.SERVER_CONFIG ?? {};

    let questions = [];

    const environmentVariables = [
        ['textIt.apiKey', 'Please enter the API Key for TextIt'],
        ['textIt.flowId', 'Please enter the Flow ID for TextIt'],
        ['stripe.secretKey', 'Please enter the Stripe Secret Key'],
        ['stripe.publishableKey', 'Please enter the Stripe Publishable Key'],
        [
            'subscriptions',
            'Please enter the Subscription Config',
            (json) => JSON.parse(json),
        ],
    ];

    for (let [name, desc, transform] of environmentVariables) {
        if (!_.get(serverlessConfig, name) || !_.get(serverConfig, name)) {
            questions.push({
                type: 'text',
                name: name,
                message: desc,
                format: transform,
            });
        }
    }

    if (questions.length > 0) {
        const response = await prompts(questions);

        let final = {};
        for (let key in response) {
            const value = response[key];
            if (value) {
                _.set(final, key, response[key] ? response[key] : undefined);
            }
        }

        serverlessResult = _.merge({}, serverlessResult, {
            handleRecords: {},
        });

        serverlessResult.handleRecords.SERVER_CONFIG = JSON.stringify(
            _.merge({}, serverlessConfig, final)
        );
        serverResult.SERVER_CONFIG = _.merge({}, serverConfig, final);

        needsUpdate = true;
    }

    if (needsUpdate) {
        writeFileSync(
            serverlessSecretsFile,
            JSON.stringify(serverlessResult, null, 4)
        );
        writeFileSync(serverSecretsFile, JSON.stringify(serverResult, null, 4));
    }
}

start();
