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
    const secrets = existsSync(secretsFile)
        ? JSON.parse(readFileSync(secretsFile, 'utf8'))
        : {};

    let result = _.merge({}, env, secrets);

    let needsUpdate = false;
    if (
        !result?.handleService?.MAGIC_SECRET_KEY ||
        !result?.handleMetadata?.MAGIC_SECRET_KEY
    ) {
        const response = await prompts({
            type: 'text',
            name: 'magicSDKSecretKey',
            message: 'Please enter the secret key for the MAGIC SDK',
        });

        result = _.merge({}, result, {
            handleMetadata: {
                MAGIC_SECRET_KEY: response.magicSDKSecretKey,
            },
            handleService: {
                MAGIC_SECRET_KEY: response.magicSDKSecretKey,
            },
        });

        needsUpdate = true;
    }

    if (needsUpdate) {
        writeFileSync(secretsFile, JSON.stringify(result, null, 4));
    }
}

start();
