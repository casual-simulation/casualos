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

const s3 = new AWS.S3({
    endpoint: 'http://localhost:4566',
    apiVersion: '2006-03-01',
    s3ForcePathStyle: true,
});

// See env.json
const USERS_TABLE = 'Users';
const USER_ADDRESSES_TABLE = 'UserAddresses';
const LOGIN_REQUESTS_TABLE = 'LoginRequests';
const SESSIONS_TABLE = 'Sessions';
const RECORDS_TABLE = 'Records';
const EMAIL_TABLE = 'EmailRules';
const SMS_TABLE = 'SmsRules';
const RECORDS_BUCKET = 'records-bucket';
const PUBLIC_RECORDS_TABLE = 'PublicRecords';
const PUBLIC_RECORDS_KEYS_TABLE = 'PublicRecordsKeys';
const DATA_TABLE = 'Data';
const MANUAL_DATA_TABLE = 'ManualData';
const FILES_TABLE = 'Files';
const FILES_BUCKET = 'files-bucket';
const EVENTS_TABLE = 'Events';

async function start() {
    const tablesResult = await ddb.listTables({}).promise();
    const reset = process.argv.includes('--reset');

    const templateSrc = readFileSync(
        path.resolve(__dirname, '..', 'serverless', 'aws', 'template.yml'),
        { encoding: 'utf8' }
    );
    const template = YAML.parseDocument(templateSrc).toJSON();

    await createOrUpdateTable(
        tablesResult,
        USERS_TABLE,
        reset,
        template.Resources.UsersTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        USER_ADDRESSES_TABLE,
        reset,
        template.Resources.UserAddressesTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        RECORDS_TABLE,
        reset,
        template.Resources.RecordsTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        EMAIL_TABLE,
        reset,
        template.Resources.EmailRulesTable.Properties
    );

    await ddb
        .putItem({
            TableName: EMAIL_TABLE,
            Item: {
                id: { S: 'deny_test' },
                type: { S: 'deny' },
                pattern: { S: '^test@casualsimulation\\.org$' },
            },
        })
        .promise();

    await ddb
        .putItem({
            TableName: EMAIL_TABLE,
            Item: {
                id: { S: 'allow_casualsim' },
                type: { S: 'allow' },
                pattern: { S: '@casualsimulation\\.org$' },
            },
        })
        .promise();

    await createOrUpdateTable(
        tablesResult,
        SMS_TABLE,
        reset,
        template.Resources.SmsRulesTable.Properties
    );

    await ddb
        .putItem({
            TableName: SMS_TABLE,
            Item: {
                id: { S: 'deny_test' },
                type: { S: 'deny' },
                pattern: { S: '^\\+1999' },
            },
        })
        .promise();

    await ddb
        .putItem({
            TableName: SMS_TABLE,
            Item: {
                id: { S: 'allow_usa' },
                type: { S: 'allow' },
                pattern: { S: '^\\+1' },
            },
        })
        .promise();

    await createOrUpdateTable(
        tablesResult,
        PUBLIC_RECORDS_TABLE,
        reset,
        template.Resources.PublicRecordsTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        PUBLIC_RECORDS_KEYS_TABLE,
        reset,
        template.Resources.PublicRecordsKeysTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        DATA_TABLE,
        reset,
        template.Resources.DataTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        MANUAL_DATA_TABLE,
        reset,
        template.Resources.ManualDataTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        FILES_TABLE,
        reset,
        template.Resources.FilesTable.Properties
    );

    await createS3Buckets(reset);

    await createOrUpdateTable(
        tablesResult,
        EVENTS_TABLE,
        reset,
        template.Resources.EventsTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        LOGIN_REQUESTS_TABLE,
        reset,
        template.Resources.LoginRequestsTable.Properties
    );
    await createOrUpdateTable(
        tablesResult,
        SESSIONS_TABLE,
        reset,
        template.Resources.SessionsTable.Properties
    );
}

start();

async function createS3Buckets(reset) {
    try {
        const buckets = await s3.listBuckets().promise();
        const hasRecordsBucket = buckets.Buckets.some(
            (b) => b.Name === RECORDS_BUCKET
        );
        if (!hasRecordsBucket || reset) {
            if (hasRecordsBucket) {
                deleteBucket(RECORDS_BUCKET);
            }

            console.log('Creating Records Bucket');
            await s3
                .createBucket({
                    Bucket: RECORDS_BUCKET,
                })
                .promise();
        } else {
            console.log('Records Bucket already exists');
        }

        const hasFilesBucket = buckets.Buckets.some(
            (b) => b.Name === FILES_BUCKET
        );
        if (!hasFilesBucket || reset) {
            if (hasFilesBucket) {
                await deleteBucket(FILES_BUCKET);
            }

            console.log('Creating Files Bucket');
            await s3
                .createBucket({
                    Bucket: FILES_BUCKET,
                })
                .promise();

            await s3
                .putBucketCors({
                    Bucket: FILES_BUCKET,
                    CORSConfiguration: {
                        CORSRules: [
                            {
                                AllowedHeaders: ['*'],
                                AllowedMethods: ['GET', 'PUT', 'POST'],
                                AllowedOrigins: ['*'],
                                ExposeHeaders: [],
                                MaxAgeSeconds: 3000,
                            },
                        ],
                    },
                })
                .promise();
        } else {
            console.log('Files Bucket already exists');
        }
    } catch (err) {
        console.log('Unable to Create S3 buckets.', err.toString());
    }
}

async function deleteBucket(bucketName) {
    console.log(`Deleting "${bucketName}" Bucket`);
    const objects = await s3
        .listObjects({
            Bucket: bucketName,
        })
        .promise();
    await Promise.all(
        objects.Contents.map(async (object) => {
            await s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: object.Key,
                })
                .promise();
        })
    );
    await s3
        .deleteBucket({
            Bucket: bucketName,
        })
        .promise();
}

async function createOrUpdateTable(tables, tableName, reset, params) {
    const hasTable = tables.TableNames.includes(tableName);
    if (!hasTable || reset) {
        if (hasTable) {
            console.log(`Deleting ${tableName} Table`);
            await ddb
                .deleteTable({
                    TableName: tableName,
                })
                .promise();
        }

        console.log(`Creating ${tableName} Table`);
        await ddb
            .createTable({
                TableName: tableName,
                ...params,
            })
            .promise();
    } else {
        console.log(`${tableName} Table already exists`);
    }
}
