// Create clients and set shared const values outside of the handler.
import {
    formatResponse,
    validateOrigin,
    findHeader,
    parseAuthorization,
} from '../utils';
import { Magic } from '@magic-sdk/admin';
import { MagicAuthProvider } from '../MagicAuthProvider';
import {
    RecordsController,
    DataRecordsController,
    FileRecordsController,
} from '@casual-simulation/aux-records';
import {
    DynamoDBRecordsStore,
    DynamoDBDataStore,
    DynamoDBFileStore,
} from '@casual-simulation/aux-records-aws';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    S3Event,
} from 'aws-lambda';
import AWS from 'aws-sdk';

declare var S3_ENDPOINT: string;
declare var DYNAMODB_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
const PUBLIC_RECORDS_TABLE = process.env.PUBLIC_RECORDS_TABLE;
const DATA_TABLE = process.env.DATA_TABLE;
const MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY;

const REGION = process.env.AWS_REGION;
const FILES_BUCKET = process.env.FILES_BUCKET;
const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
const FILES_TABLE = process.env.FILES_TABLE;

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});
const S3 = require('aws-sdk/clients/s3');
const s3Client = new S3({
    endpoint: S3_ENDPOINT,
    s3ForcePathStyle: DEVELOPMENT,
});

const magic = new Magic(MAGIC_SECRET_KEY);
const recordsStore = new DynamoDBRecordsStore(docClient, PUBLIC_RECORDS_TABLE);
const recordsController = new RecordsController(recordsStore);
const dataStore = new DynamoDBDataStore(docClient, DATA_TABLE);
const dataController = new DataRecordsController(recordsController, dataStore);
const fileStore = new DynamoDBFileStore(
    REGION,
    FILES_BUCKET,
    docClient,
    FILES_TABLE,
    FILES_STORAGE_CLASS,
    undefined,

    // We reference the Vite server in development.
    // since any preflight request with an Origin header is rejected by localstack (see https://github.com/localstack/localstack/issues/4056)
    // This parameter is mostly only used so that the file URLs point to the correct S3 instance. As such,
    // this value is mostly used by browsers trying to upload files.
    DEVELOPMENT ? `http://localhost:3002/s3` : undefined
);
const filesController = new FileRecordsController(recordsController, fileStore);

const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3002',
    'http://player.localhost:3000',
    'https://casualos.com',
    'https://casualos.me',
    'https://ab1.link',
    'https://publicos.com',
]);

// async function postOrDeleteRecord(event: APIGatewayProxyEvent) {
//     if (event.httpMethod !== 'POST') {
//         throw new Error(
//             `postOrDeleteRecord only accept POST method, you tried: ${event.httpMethod}`
//         );
//     }

//     if (event.path.endsWith('/delete')) {
//         return deleteRecord(event);
//     } else {
//         return postRecord(event);
//     }
// }

// async function deleteRecord(event: APIGatewayProxyEvent) {
//     if (!validateOrigin(event, allowedOrigins)) {
//         throw new Error('Invalid origin');
//     }

//     const data = JSON.parse(event.body);
//     const result = await manager.deleteRecord(data);
//     return returnResult(event, result);
// }

// async function postRecord(event: any) {
//     if (!validateOrigin(event, allowedOrigins)) {
//         throw new Error('Invalid origin');
//     }

//     const data = JSON.parse(event.body);
//     const result = await manager.publishRecord(data);
//     return returnResult(event, result);
// }

// async function getRecords(event: APIGatewayProxyEvent) {
//     if (event.httpMethod !== 'GET') {
//         throw new Error(
//             `getRecords only accept GET method, you tried: ${event.httpMethod}`
//         );
//     }

//     if (!validateOrigin(event, allowedOrigins)) {
//         throw new Error('Invalid origin');
//     }

//     if (!event.queryStringParameters.authID) {
//         return formatResponse(
//             event,
//             {
//                 statusCode: 400,
//             },
//             allowedOrigins
//         );
//     }

//     const authorization = findHeader(event, 'authorization');

//     let token;

//     if (authorization && authorization.startsWith('Bearer ')) {
//         token = authorization.slice('Bearer '.length);
//     }

//     let params = {};

//     getQueryParam('authID', 'issuer');
//     getQueryParam('address');
//     getQueryParam('prefix');
//     getQueryParam('cursor');
//     getQueryParam('space');

//     if (token) {
//         params.token = token;
//     }

//     const result = await manager.getRecords(params);

//     return returnResult(event, result);

//     function getQueryParam(param, name = param) {
//         if (event.queryStringParameters[param]) {
//             params[name] = decodeURIComponent(
//                 event.queryStringParameters[param]
//             );
//         }
//     }
// }

async function createRecordKey(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const authorization = findHeader(event, 'authorization');
    const data = JSON.parse(event.body);

    const { recordName } = data;

    if (!recordName || typeof recordName !== 'string') {
        return {
            statusCode: 400,
            body: 'recordName is required and must be a string.',
        };
    }

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const result = await recordsController.createPublicRecordKey(
        recordName,
        userId
    );

    return {
        statusCode: 200,
        body: JSON.stringify(result),
    };
}

async function recordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const authorization = findHeader(event, 'authorization');
    const body = JSON.parse(event.body);

    const { recordKey, address, data } = body;

    if (!recordKey || typeof recordKey !== 'string') {
        return {
            statusCode: 400,
            body: 'recordKey is required and must be a string.',
        };
    }
    if (!address || typeof address !== 'string') {
        return {
            statusCode: 400,
            body: 'address is required and must be a string.',
        };
    }
    if (typeof data === 'undefined') {
        return {
            statusCode: 400,
            body: 'data is required and must be a string.',
        };
    }

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const result = await dataController.recordData(
        recordKey,
        address,
        data,
        userId
    );

    return {
        statusCode: 200,
        body: JSON.stringify(result),
    };
}

async function getRecordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const { recordName, address } = event.queryStringParameters;

    if (!recordName || typeof recordName !== 'string') {
        return {
            statusCode: 400,
            body: 'recordName is required and must be a string.',
        };
    }
    if (!address || typeof address !== 'string') {
        return {
            statusCode: 400,
            body: 'address is required and must be a string.',
        };
    }

    const result = await dataController.getData(recordName, address);

    return {
        statusCode: 200,
        body: JSON.stringify(result),
    };
}

async function recordFile(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const authorization = findHeader(event, 'authorization');
    const body = JSON.parse(event.body);

    const {
        recordKey,
        fileSha256Hex,
        fileByteLength,
        fileMimeType,
        fileDescription,
    } = body;

    if (!recordKey || typeof recordKey !== 'string') {
        return {
            statusCode: 400,
            body: 'recordKey is required and must be a string.',
        };
    }
    if (!fileSha256Hex || typeof fileSha256Hex !== 'string') {
        return {
            statusCode: 400,
            body: 'fileSha256Hex is required and must be a string.',
        };
    }
    if (!fileByteLength || typeof fileByteLength !== 'number') {
        return {
            statusCode: 400,
            body: 'fileByteLength is required and must be a number.',
        };
    }
    if (!fileMimeType || typeof fileMimeType !== 'string') {
        return {
            statusCode: 400,
            body: 'fileMimeType is required and must be a string.',
        };
    }
    if (!!fileDescription && typeof fileDescription !== 'string') {
        return {
            statusCode: 400,
            body: 'fileDescription must be a string.',
        };
    }

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const result = await filesController.recordFile(recordKey, userId, {
        fileSha256Hex,
        fileByteLength,
        fileMimeType,
        fileDescription,
    });

    return {
        statusCode: 200,
        body: JSON.stringify(result),
    };
}

export async function handleS3Event(event: S3Event) {
    await Promise.all(
        event.Records.map(async (record) => {
            const bucketName = record.s3.bucket.name;

            if (bucketName !== FILES_BUCKET) {
                console.warn(
                    `[RecordsV2] Got event for wrong bucket: ${bucketName}`
                );
                return;
            }

            const key = record.s3.object.key;

            const firstSlash = key.indexOf('/');

            if (firstSlash < 0) {
                console.warn('[RecordsV2] Unable to process key:', key);
                return;
            }

            const recordName = key.substring(0, firstSlash);
            const fileName = key.substring(firstSlash + 1);

            const result = await fileStore.setFileRecordAsUploaded(
                recordName,
                fileName
            );

            if (result.success === false) {
                if (result.errorCode === 'file_not_found') {
                    console.error('[RecordsV2] File not found:', key);
                }
            } else {
                console.log('[RecordsV2] File marked as uploaded:', key);
            }
        })
    );
}

export async function handleApiEvent(event: APIGatewayProxyEvent) {
    if (event.httpMethod === 'POST' && event.path === '/api/v2/records/key') {
        return createRecordKey(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/data'
    ) {
        return recordData(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/data'
    ) {
        return getRecordData(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/file'
    ) {
        return recordFile(event);
    }

    return {
        statusCode: 404,
    };
}

export async function handleRecordsV2(event: APIGatewayProxyEvent | S3Event) {
    if ('httpMethod' in event) {
        return handleApiEvent(event);
    } else {
        return handleS3Event(event);
    }
}
