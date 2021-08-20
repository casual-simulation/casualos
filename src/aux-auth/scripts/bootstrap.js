const AWS = require('aws-sdk');
const { readFileSync } = require('fs');
const path = require('path');
const YAML = require('yaml');

AWS.config.update({
    region: 'us-east-1',
});

const ddb = new AWS.DynamoDB({
    endpoint: 'http://localhost:9125',
    apiVersion: '2012-08-10',
});

// See env.json
const USERS_TABLE = 'Users';
const USER_SERVICES_TABLE = 'UserServices';

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

    const hasUserServicesTable = tablesResult.TableNames.includes(
        USER_SERVICES_TABLE
    );
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
}

start();
