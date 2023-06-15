const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');
const _ = require('lodash');
const prompts = require('prompts');

async function start() {
    const envFile = path.resolve(
        __dirname,
        '..',
        'serverless',
        'aws',
        'env.json'
    );
    const serverlessSecretsFile = path.resolve(
        __dirname,
        '..',
        'serverless',
        'aws',
        'secrets.env.json'
    );
    const serverSecretsFile = path.resolve(
        __dirname,
        '..',
        'server',
        'secrets.env.json'
    );
    const env = JSON.parse(readFileSync(envFile, 'utf8'));
    const serverlessSecretsExists = existsSync(serverlessSecretsFile);
    const serverlessSecrets = serverlessSecretsExists
        ? JSON.parse(readFileSync(serverlessSecretsFile, 'utf8'))
        : {};

    let serverlessResult = _.merge({}, env, serverlessSecrets);
    let needsUpdate = !serverlessSecretsExists;

    const serverSecretsExists = existsSync(serverSecretsFile);
    const serverSecrets = serverSecretsExists
        ? JSON.parse(readFileSync(serverSecretsFile, 'utf8'))
        : {};

    let serverResult = _.merge({}, serverSecrets);

    let questions = [];

    const environmentVariables = [
        ['SERVER_CONFIG.textIt.apiKey', 'Please enter the API Key for TextIt'],
        ['SERVER_CONFIG.textIt.flowId', 'Please enter the Flow ID for TextIt'],
        [
            'SERVER_CONFIG.stripe.secretKey',
            'Please enter the Stripe Secret Key',
        ],
        [
            'SERVER_CONFIG.stripe.publishableKey',
            'Please enter the Stripe Publishable Key',
        ],
        [
            'SERVER_CONFIG.subscriptions',
            'Please enter the Subscription Config',
            (json) => JSON.parse(json),
        ],
    ];

    for (let [name, desc, transform] of environmentVariables) {
        if (
            !_.get(serverlessResult?.handleRecords, name) ||
            !_.get(serverResult, name)
        ) {
            questions.push({
                type: 'text',
                name: name,
                message: desc,
                format: transform,
            });
        }
    }

    // if ( ||
    //     !serverResult?.TEXT_IT_API_KEY) {

    // }

    // if (!serverlessResult?.handleRecords?.TEXT_IT_FLOW_ID) {
    //     questions.push({
    //         type: 'text',
    //         name: 'TEXT_IT_FLOW_ID',
    //         message: '',
    //     });
    // }

    // if (!serverlessResult?.handleRecords?.STRIPE_SECRET_KEY) {
    //     questions.push({
    //         type: 'text',
    //         name: 'STRIPE_SECRET_KEY',
    //         message: 'Please enter the Stripe Secret Key',
    //     });
    // }

    // if (!serverlessResult?.handleRecords?.SUBSCRIPTION_CONFIG) {
    //     questions.push({
    //         type: 'text',
    //         name: 'SUBSCRIPTION_CONFIG',
    //         message: 'Please enter the Subscription Config',
    //     });
    // }

    // if (!result?.handleRecords?.STRIPE_SECRET_KEY) {
    //     questions.push({
    //         type: 'text',
    //         name: 'STRIPE_SECRET_KEY',
    //         message: 'Please enter the Stripe Secret Key',
    //     });
    // }

    if (questions.length > 0) {
        const response = await prompts(questions);

        let final = {};
        for (let key in response) {
            _.set(final, key, response[key] ? response[key] : undefined);
        }

        serverlessResult = _.merge({}, serverlessResult, {
            handleRecords: {
                ...final,
            },
        });
        serverResult = _.merge({}, serverResult, final);

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
