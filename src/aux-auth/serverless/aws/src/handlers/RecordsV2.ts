// Create clients and set shared const values outside of the handler.
import {
    formatResponse,
    validateOrigin,
    findHeader,
    getSessionKey,
    getAllowedAPIOrigins,
    allowedOrigins,
    formatStatusCode,
    validateSessionKey,
    getAuthController,
} from '../utils';
import {
    RecordsController,
    DataRecordsController,
    FileRecordsController,
    EventRecordsController,
} from '@casual-simulation/aux-records';
import { AuthController } from '@casual-simulation/aux-records/AuthController';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import {
    DynamoDBRecordsStore,
    DynamoDBDataStore,
    DynamoDBFileStore,
    DynamoDBEventStore,
    DynamoDBAuthStore,
} from '@casual-simulation/aux-records-aws';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    S3Event,
} from 'aws-lambda';
import AWS from 'aws-sdk';
import { LivekitController } from '@casual-simulation/aux-records/LivekitController';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';

declare var S3_ENDPOINT: string;
declare var DYNAMODB_ENDPOINT: string;
declare var DEVELOPMENT: boolean;

// Get the DynamoDB table name from environment variables
const PUBLIC_RECORDS_TABLE = process.env.PUBLIC_RECORDS_TABLE;
const PUBLIC_RECORDS_KEYS_TABLE = process.env.PUBLIC_RECORDS_KEYS_TABLE;
const DATA_TABLE = process.env.DATA_TABLE;
const MANUAL_DATA_TABLE = process.env.MANUAL_DATA_TABLE;

const REGION = process.env.AWS_REGION;
const FILES_BUCKET = process.env.FILES_BUCKET;
const FILES_STORAGE_CLASS = process.env.FILES_STORAGE_CLASS;
const FILES_TABLE = process.env.FILES_TABLE;
const EVENTS_TABLE = process.env.EVENTS_TABLE;

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_SECRET_KEY = process.env.LIVEKIT_SECRET_KEY;
const LIVEKIT_ENDPOINT = process.env.LIVEKIT_ENDPOINT;

const USERS_TABLE = process.env.USERS_TABLE;
const LOGIN_REQUESTS_TABLE = process.env.LOGIN_REQUESTS_TABLE;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE;

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

const recordsStore = new DynamoDBRecordsStore(
    docClient,
    PUBLIC_RECORDS_TABLE,
    PUBLIC_RECORDS_KEYS_TABLE
);
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

const livekitController = new LivekitController(
    LIVEKIT_API_KEY,
    LIVEKIT_SECRET_KEY,
    LIVEKIT_ENDPOINT
);

const authController = getAuthController(docClient);

const allowedApiOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3002',
    'http://player.localhost:3000',
    'https://localhost:3000',
    'https://localhost:3002',
    'https://player.localhost:3000',
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
    if (!validateOrigin(event, allowedApiOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const data = JSON.parse(event.body);

    const { recordName, policy } = data;

    if (!recordName || typeof recordName !== 'string') {
        return {
            statusCode: 400,
            body: 'recordName is required and must be a string.',
        };
    }

    const validation = await validateSessionKey(event, authController);
    if (validation.success === false) {
        return {
            statusCode: formatStatusCode(validation),
            body: JSON.stringify(validation),
        };
    }
    const result = await recordsController.createPublicRecordKey(
        recordName,
        policy,
        validation.userId
    );

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function baseRecordData(
    event: APIGatewayProxyEvent,
    controller: DataRecordsController
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedApiOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const body = JSON.parse(event.body);

    const { recordKey, address, data, updatePolicy, deletePolicy } = body;

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

    const validation = await validateSessionKey(event, authController);
    if (validation.success === false) {
        return {
            statusCode: formatStatusCode(validation),
            body: JSON.stringify(validation),
        };
    }
    const userId = validation.userId;
    const result = await controller.recordData(
        recordKey,
        address,
        data,
        userId,
        updatePolicy,
        deletePolicy
    );

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
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

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function baseEraseRecordData(
    event: APIGatewayProxyEvent,
    controller: DataRecordsController
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedApiOrigins)) {
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

    const validation = await validateSessionKey(event, authController);
    if (validation.success === false) {
        return {
            statusCode: formatStatusCode(validation),
            body: JSON.stringify(validation),
        };
    }
    const userId = validation.userId;
    const result = await controller.eraseData(recordKey, address, userId);

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
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

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
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
    if (!validateOrigin(event, allowedApiOrigins)) {
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

    const validation = await validateSessionKey(event, authController);
    if (validation.success === false) {
        return {
            statusCode: formatStatusCode(validation),
            body: JSON.stringify(validation),
        };
    }
    const userId = validation.userId;
    const result = await filesController.recordFile(recordKey, userId, {
        fileSha256Hex,
        fileByteLength,
        fileMimeType,
        fileDescription,
        headers: {},
    });

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function eraseFile(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedApiOrigins)) {
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

    const validation = await validateSessionKey(event, authController);
    if (validation.success === false) {
        return {
            statusCode: formatStatusCode(validation),
            body: JSON.stringify(validation),
        };
    }
    const userId = validation.userId;

    const key = new URL(fileUrl).pathname.slice(1);
    const firstSlash = key.indexOf('/');

    if (firstSlash < 0) {
        console.warn('[RecordsV2] Unable to process key:', key);
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: false,
                errorCode: 'server_error',
                errorMessage: 'The server encountered an error.',
            }),
        };
    }

    const recordName = key.substring(0, firstSlash);
    const fileName = key.substring(firstSlash + 1);

    const result = await filesController.eraseFile(recordKey, fileName, userId);

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
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

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function addEventCount(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    if (!validateOrigin(event, allowedApiOrigins)) {
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

    const validation = await validateSessionKey(event, authController);
    if (validation.success === false) {
        return {
            statusCode: formatStatusCode(validation),
            body: JSON.stringify(validation),
        };
    }
    const userId = validation.userId;
    const result = await eventsController.addCount(
        recordKey,
        eventName,
        count,
        userId
    );

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function getMeetToken(event: APIGatewayProxyEvent) {
    if (!validateOrigin(event, allowedApiOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const body = JSON.parse(event.body);
    const { roomName, userName } = body;
    const result = await livekitController.issueToken(roomName, userName);

    return {
        statusCode: formatStatusCode(result),
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

async function login(event: APIGatewayProxyEvent) {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const body = JSON.parse(event.body);
    const { address, addressType } = body;
    const result = await authController.requestLogin({
        address,
        addressType,
        ipAddress: event.requestContext.identity.sourceIp,
    });

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function completeLogin(event: APIGatewayProxyEvent) {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const body = JSON.parse(event.body);
    const { userId, requestId, code } = body;

    const result = await authController.completeLogin({
        userId,
        requestId,
        code,
        ipAddress: event.requestContext.identity.sourceIp,
    });

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

async function revokeSession(event: APIGatewayProxyEvent) {
    if (!validateOrigin(event, allowedOrigins)) {
        console.log('[RecordsV2] Invalid origin.');
        return {
            statusCode: 403,
            body: 'Invalid origin.',
        };
    }

    const body = JSON.parse(event.body);
    let { userId, sessionId, sessionKey: sessionKeyToRevoke } = body;

    // Parse the User ID and Session ID from the sessionKey that is provided in
    // session key that should be revoked
    if (!!sessionKeyToRevoke) {
        const parsed = parseSessionKey(sessionKeyToRevoke);
        if (parsed) {
            userId = parsed[0];
            sessionId = parsed[1];
        }
    }

    const authorization = getSessionKey(event);
    const result = await authController.revokeSession({
        userId,
        sessionId,
        sessionKey: authorization,
    });

    return {
        statusCode: formatStatusCode(result),
        body: JSON.stringify(result),
    };
}

function wrapFunctionWithResponse(
    func: (event: APIGatewayProxyEvent) => Promise<any>,
    allowedOrigins: boolean | Set<string>
): (event: APIGatewayProxyEvent) => Promise<any> {
    return async (event) => {
        const response = await func(event);
        return formatResponse(event, response, allowedOrigins);
    };
}

export async function handleApiEvent(event: APIGatewayProxyEvent) {
    if (event.httpMethod === 'POST' && event.path === '/api/v2/records/key') {
        return wrapFunctionWithResponse(
            createRecordKey,
            allowedApiOrigins
        )(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/data'
    ) {
        return wrapFunctionWithResponse(recordData, allowedApiOrigins)(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/data'
    ) {
        return wrapFunctionWithResponse(getRecordData, true)(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/data/list'
    ) {
        return wrapFunctionWithResponse(listData, true)(event);
    } else if (
        event.httpMethod === 'DELETE' &&
        event.path === '/api/v2/records/data'
    ) {
        return wrapFunctionWithResponse(
            eraseRecordData,
            allowedApiOrigins
        )(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/file'
    ) {
        return wrapFunctionWithResponse(recordFile, allowedApiOrigins)(event);
    } else if (
        event.httpMethod === 'DELETE' &&
        event.path === '/api/v2/records/file'
    ) {
        return wrapFunctionWithResponse(eraseFile, allowedApiOrigins)(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/manual/data'
    ) {
        return wrapFunctionWithResponse(
            manualRecordData,
            allowedApiOrigins
        )(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/manual/data'
    ) {
        return wrapFunctionWithResponse(getManualRecordData, true)(event);
    } else if (
        event.httpMethod === 'DELETE' &&
        event.path === '/api/v2/records/manual/data'
    ) {
        return wrapFunctionWithResponse(
            eraseManualRecordData,
            allowedApiOrigins
        )(event);
    } else if (
        event.httpMethod === 'GET' &&
        event.path === '/api/v2/records/events/count'
    ) {
        return wrapFunctionWithResponse(getEventCount, true)(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/records/events/count'
    ) {
        return wrapFunctionWithResponse(
            addEventCount,
            allowedApiOrigins
        )(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/meet/token'
    ) {
        return wrapFunctionWithResponse(getMeetToken, allowedApiOrigins)(event);
    } else if (event.httpMethod === 'POST' && event.path === '/api/v2/login') {
        return wrapFunctionWithResponse(login, allowedApiOrigins)(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/completeLogin'
    ) {
        return wrapFunctionWithResponse(
            completeLogin,
            allowedApiOrigins
        )(event);
    } else if (
        event.httpMethod === 'POST' &&
        event.path === '/api/v2/revokeSession'
    ) {
        return wrapFunctionWithResponse(
            revokeSession,
            allowedApiOrigins
        )(event);
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
