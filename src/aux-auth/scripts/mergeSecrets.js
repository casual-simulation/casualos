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
        ['TEXT_IT_API_KEY', 'Please enter the API Key for TextIt'],
        ['TEXT_IT_FLOW_ID', 'Please enter the Flow ID for TextIt'],
        ['STRIPE_SECRET_KEY', 'Please enter the Stripe Secret Key'],
        ['STRIPE_PUBLISHABLE_KEY', 'Please enter the Stripe Publishable Key'],
        ['SUBSCRIPTION_CONFIG', 'Please enter the Subscription Config'],
    ];

    for (let [name, desc] of environmentVariables) {
        if (!serverlessResult?.handleRecords?.[name] || !serverResult?.[name]) {
            questions.push({
                type: 'text',
                name: name,
                message: desc,
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

    if (questions.length > 0) {
        const response = await prompts(questions);
        serverlessResult = _.merge({}, serverlessResult, {
            handleRecords: {
                ...response,
            },
        });
        serverResult = _.merge({}, serverResult, response);

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
