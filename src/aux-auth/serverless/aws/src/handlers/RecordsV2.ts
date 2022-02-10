// Create clients and set shared const values outside of the handler.
import {
    formatResponse,
    validateOrigin,
    findHeader,
    parseAuthorization,
    getAllowedAPIOrigins,
} from '../utils';
import { Magic } from '@magic-sdk/admin';
import { MagicAuthProvider } from '../MagicAuthProvider';
import {
    RecordsController,
    DataRecordsController,
    FileRecordsController,
    EventRecordsController,
} from '@casual-simulation/aux-records';
import {
    DynamoDBRecordsStore,
    DynamoDBDataStore,
    DynamoDBFileStore,
    DynamoDBEventStore,
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
const MANUAL_DATA_TABLE = process.env.MANUAL_DATA_TABLE;
const MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY;

const REGION = process.env.AWS_REGION;
const FILES_BUCKET = process.env.FILES_BUCKET;
const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
const FILES_TABLE = process.env.FILES_TABLE;
const EVENTS_TABLE = process.env.EVENTS_TABLE;

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = new dynamodb.DocumentClient({
    endpoint: DYNAMODB_ENDPOINT,
});
const S3 = require('aws-sdk/clients/s3');
const s3Options: AWS.S3.ClientConfiguration = {
    endpoint: S3_ENDPOINT,
    s3ForcePathStyle: DEVELOPMENT,
};
const s3Client = new S3(s3Options);

const magic = new Magic(MAGIC_SECRET_KEY);
const recordsStore = new DynamoDBRecordsStore(docClient, PUBLIC_RECORDS_TABLE);
const recordsController = new RecordsController(recordsStore);

const dataStore = new DynamoDBDataStore(docClient, DATA_TABLE);
const dataController = new DataRecordsController(recordsController, dataStore);

const eventsStore = new DynamoDBEventStore(docClient, EVENTS_TABLE);
const eventsController = new EventRecordsController(
    recordsController,
    eventsStore
);

const manualDataStore = new DynamoDBDataStore(docClient, MANUAL_DATA_TABLE);
const manualDataController = new DataRecordsController(
    recordsController,
    manualDataStore
);

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
    DEVELOPMENT ? `http://localhost:3002/s3` : undefined,
    s3Options
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
    'https://alpha.casualos.com',
    'https://static.casualos.com',
    'https://stable.casualos.com',
    ...getAllowedAPIOrigins(),
]);

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

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        allowedOrigins
    );
}

async function baseRecordData(
    event: APIGatewayProxyEvent,
    controller: DataRecordsController
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
            body: 'data is required.',
        };
    }

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const result = await controller.recordData(
        recordKey,
        address,
        data,
        userId
    );

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        allowedOrigins
    );
}

async function baseGetRecordData(
    event: APIGatewayProxyEvent,
    controller: DataRecordsController
): Promise<APIGatewayProxyResult> {
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

    const result = await controller.getData(recordName, address);

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        true
    );
}

async function baseEraseRecordData(
    event: APIGatewayProxyEvent,
    controller: DataRecordsController
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

    const { recordKey, address } = body;

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

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const result = await controller.eraseData(recordKey, address);

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        allowedOrigins
    );
}

async function recordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return baseRecordData(event, dataController);
}

async function getRecordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return baseGetRecordData(event, dataController);
}

async function listData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    const { recordName, address } = event.queryStringParameters;

    if (!recordName || typeof recordName !== 'string') {
        return {
            statusCode: 400,
            body: 'recordName is required and must be a string.',
        };
    }
    if (
        address !== null &&
        typeof address !== 'undefined' &&
        typeof address !== 'string'
    ) {
        return {
            statusCode: 400,
            body: 'address must be null or a string.',
        };
    }

    const result = await dataController.listData(recordName, address || null);

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        true
    );
}

async function eraseRecordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return baseEraseRecordData(event, dataController);
}

async function manualRecordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return baseRecordData(event, manualDataController);
}

async function getManualRecordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return baseGetRecordData(event, manualDataController);
}

async function eraseManualRecordData(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return baseEraseRecordData(event, manualDataController);
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
        headers: {},
    });

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        allowedOrigins
    );
}

async function eraseFile(
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

    const { recordKey, fileUrl } = body;

    if (!recordKey || typeof recordKey !== 'string') {
        return {
            statusCode: 400,
            body: 'recordKey is required and must be a string.',
        };
    }
    if (!fileUrl || typeof fileUrl !== 'string') {
        return {
            statusCode: 400,
            body: 'fileUrl is required and must be a string.',
        };
    }

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const key = new URL(fileUrl).pathname.slice(1);
    const firstSlash = key.indexOf('/');

    if (firstSlash < 0) {
        console.warn('[RecordsV2] Unable to process key:', key);
        return formatResponse(
            event,
            {
                statusCode: 200,
                body: JSON.stringify({
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'The server encountered an error.',
                }),
            },
            allowedOrigins
        );
    }

    const recordName = key.substring(0, firstSlash);
    const fileName = key.substring(firstSlash + 1);

    const result = await filesController.eraseFile(recordKey, fileName);

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        allowedOrigins
    );
}

async function getEventCount(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    const { recordName, eventName } = event.queryStringParameters;

    if (!recordName || typeof recordName !== 'string') {
        return {
            statusCode: 400,
            body: 'recordName is required and must be a string.',
        };
    }
    if (!eventName || typeof eventName !== 'string') {
        return {
            statusCode: 400,
            body: 'eventName is required and must be a string.',
        };
    }

    const result = await eventsController.getCount(recordName, eventName);

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        true
    );
}

async function addEventCount(
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

    const { recordKey, eventName, count } = body;

    if (!recordKey || typeof recordKey !== 'string') {
        return {
            statusCode: 400,
            body: 'recordKey is required and must be a string.',
        };
    }
    if (!eventName || typeof eventName !== 'string') {
        return {
            statusCode: 400,
            body: 'eventName is required and must be a string.',
        };
    }
    if (typeof count !== 'number') {
        return {
            statusCode: 400,
            body: 'count is required and must be a number.',
        };
    }

    const userId = parseAuthorization(magic, authorization);
    if (!userId) {
        return {
            statusCode: 401,
            body: 'The Authorization header must be set.',
        };
    }

    const result = await eventsController.addCount(recordKey, eventName, count);

    return formatResponse(
        event,
        {
            statusCode: 200,
            body: JSON.stringify(result),
        },
        allowedOrigins
    );
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
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/data/list'
    ) {
        return listData(event);
    } else if (
        event.httpMethod === 'DELETE' &&
        event.path === '/api/v2/records/data'
    ) {
        return eraseRecordData(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/file'
    ) {
        return recordFile(event);
    } else if (
        event.httpMethod === 'DELETE' &&
        event.path === '/api/v2/records/file'
    ) {
        return eraseFile(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/manual/data'
    ) {
        return manualRecordData(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/manual/data'
    ) {
        return getManualRecordData(event);
    } else if (
        event.httpMethod === 'DELETE' &&
        event.path === '/api/v2/records/manual/data'
    ) {
        return eraseManualRecordData(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/events/count'
    ) {
        return getEventCount(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/events/count'
    ) {
        return addEventCount(event);
    }

    return formatResponse(
        event,
        {
            statusCode: 404,
        },
        true
    );
}

export async function handleRecordsV2(event: APIGatewayProxyEvent | S3Event) {
    if ('httpMethod' in event) {
        return handleApiEvent(event);
    } else {
        return handleS3Event(event);
    }
}
