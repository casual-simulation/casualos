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
    const secretsFile = path.resolve(
        __dirname,
        '..',
        'serverless',
        'aws',
        'secrets.env.json'
    );
    const env = JSON.parse(readFileSync(envFile, 'utf8'));
    const secretsExists = existsSync(secretsFile);
    const secrets = secretsExists
        ? JSON.parse(readFileSync(secretsFile, 'utf8'))
        : {};

    let result = _.merge({}, env, secrets);

    let needsUpdate = !secretsExists;

    if (!result?.handleRecordsV2?.TEXT_IT_API_KEY) {
        const response = await prompts({
            type: 'text',
            name: 'textItApiKey',
            message: 'Please enter the API Key for TextIt',
        });

        result = _.merge({}, result, {
            handleRecordsV2: {
                TEXT_IT_API_KEY: response.textItApiKey,
            },
        });

        needsUpdate = true;
    }

    if (needsUpdate) {
        writeFileSync(secretsFile, JSON.stringify(result, null, 4));
    }
}

start();
