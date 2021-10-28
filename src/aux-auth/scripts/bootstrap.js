const AWS = require('aws-sdk');
const { readFileSync } = require('fs');
const path = require('path');
const YAML = require('yaml');
const { v4: uuid } = require('uuid');

AWS.config.update({
    region: 'us-east-1',

    // Dummy credentials
    accessKeyId: 'xxxx',
    secretAccessKey: 'xxxx',
});

const ddb = new AWS.DynamoDB({
    endpoint: 'http://localhost:9125',
    apiVersion: '2012-08-10',
});

// See env.json
const USERS_TABLE = 'Users';
const USER_SERVICES_TABLE = 'UserServices';
const RECORDS_TABLE = 'Records';
const EMAIL_TABLE = 'EmailRules';

async function start() {
    const tablesResult = await ddb.listTables({}).promise();
    const reset = process.argv.includes('--reset');

    const templateSrc = readFileSync(
        path.resolve(__dirname, '..', 'serverless', 'aws', 'template.yml'),
        { encoding: 'utf8' }
    );
    const template = YAML.parseDocument(templateSrc).toJSON();

    const hasUsersTable = tablesResult.TableNames.includes(USERS_TABLE);
    if (!hasUsersTable || reset) {
        if (hasUsersTable) {
            console.log('Deleting Users Table');
            await ddb
                .deleteTable({
                    TableName: USERS_TABLE,
                })
                .promise();
        }

        console.log('Creating Users Table');

        const params = template.Resources.UsersTable.Properties;

        await ddb
            .createTable({
                TableName: USERS_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Users Table already exists');
    }

    const hasUserServicesTable =
        tablesResult.TableNames.includes(USER_SERVICES_TABLE);
    if (!hasUserServicesTable || reset) {
        if (hasUserServicesTable) {
            console.log('Deleting UserServices Table');
            await ddb
                .deleteTable({
                    TableName: USER_SERVICES_TABLE,
                })
                .promise();
        }

        console.log('Creating UserServices Table');

        const params = template.Resources.UserServicesTable.Properties;
        await ddb
            .createTable({
                TableName: USER_SERVICES_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('UserServices Table already exists');
    }

    const hasRecordsTable = tablesResult.TableNames.includes(RECORDS_TABLE);
    if (!hasRecordsTable || reset) {
        if (hasRecordsTable) {
            console.log('Deleting Records Table');
            await ddb
                .deleteTable({
                    TableName: RECORDS_TABLE,
                })
                .promise();
        }

        console.log('Creating Records Table');

        const params = template.Resources.RecordsTable.Properties;
        await ddb
            .createTable({
                TableName: RECORDS_TABLE,
                ...params,
            })
            .promise();
    } else {
        console.log('Records Table already exists');
    }

    const hasEmailTable = tablesResult.TableNames.includes(EMAIL_TABLE);
    if (!hasEmailTable || reset) {
        if (hasEmailTable) {
            console.log('Deleting Email Table');
            await ddb
                .deleteTable({
                    TableName: EMAIL_TABLE,
                })
                .promise();
        }

        console.log('Creating Email Table');

        const params = template.Resources.EmailRulesTable.Properties;
        await ddb
            .createTable({
                TableName: EMAIL_TABLE,
                ...params,
            })
            .promise();

        await ddb
            .putItem({
                TableName: EMAIL_TABLE,
                Item: {
                    id: uuid(),
                    type: 'allow',
                    pattern: '@casualsimulation\\.org$',
                },
            })
            .promise();

        await ddb
            .putItem({
                TableName: EMAIL_TABLE,
                Item: {
                    id: uuid(),
                    type: 'deny',
                    pattern: '^test@casualsimulation\\.org$',
                },
            })
            .promise();
    } else {
        console.log('Email Table already exists');
    }
}

start();
