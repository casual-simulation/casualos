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
} from '@casual-simulation/aux-records';
import {
    DynamoDBRecordsStore,
    DynamoDBDataStore,
} from '@casual-simulation/aux-records-aws';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

declare var S3_ENDPOINT: string;
declare var DYNAMODB_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
const PUBLIC_RECORDS_TABLE = process.env.PUBLIC_RECORDS_TABLE;
const DATA_TABLE = process.env.DATA_TABLE;
const MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY;

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

export async function handleRecordsV2(event: APIGatewayProxyEvent) {
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
    }

    return {
        statusCode: 404,
    };
}
