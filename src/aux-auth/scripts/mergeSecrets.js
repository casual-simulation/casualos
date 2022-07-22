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

    let questions = [];

    if (!result?.handleRecords?.TEXT_IT_API_KEY) {
        questions.push({
            type: 'text',
            name: 'TEXT_IT_API_KEY',
            message: 'Please enter the API Key for TextIt',
        });
    }

    if (!result?.handleRecords?.TEXT_IT_FLOW_ID) {
        questions.push({
            type: 'text',
            name: 'TEXT_IT_FLOW_ID',
            message: 'Please enter the Flow ID for TextIt',
        });
    }

    if (questions.length > 0) {
        const response = await prompts(questions);
        result = _.merge({}, result, {
            handleRecords: {
                ...response,
            },
        });
        needsUpdate = true;
    }

    if (needsUpdate) {
        writeFileSync(secretsFile, JSON.stringify(result, null, 4));
    }
}

start();
