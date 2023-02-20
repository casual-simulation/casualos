// Create clients and set shared const values outside of the handler.
import {
    formatResponse,
    validateOrigin,
    findHeader,
    getSessionKey,
    getAllowedAPIOrigins,
    allowedOrigins,
    validateSessionKey,
    getAuthController,
} from '../utils';
import { getStatusCode } from '@casual-simulation/aux-records/Utils';
import {
    RecordsController,
    DataRecordsController,
    FileRecordsController,
    EventRecordsController,
    RecordsHttpServer,
    GenericHttpRequest,
    GenericHttpHeaders,
} from '@casual-simulation/aux-records';
import { AuthController } from '@casual-simulation/aux-records/AuthController';
import { ConsoleAuthMessenger } from '@casual-simulation/aux-records/ConsoleAuthMessenger';
import {
    DynamoDBRecordsStore,
    DynamoDBDataStore,
    DynamoDBFileStore,
    DynamoDBEventStore,
    cleanupObject,
} from '@casual-simulation/aux-records-aws';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    EventBridgeEvent,
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

const EMAIL_TABLE = process.env.EMAIL_TABLE;
const SMS_TABLE = process.env.SMS_TABLE;

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

const httpServer = new RecordsHttpServer(
    allowedOrigins,
    allowedApiOrigins,
    authController,
    livekitController,
    recordsController,
    eventsController,
    dataController,
    manualDataController,
    filesController
);

async function handleEventBridgeEvent(event: EventBridgeEvent<any, any>) {
    console.log('[Records] Got EventBridge event:', event);
}

async function handleS3Event(event: S3Event) {
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

export async function handleApiEvent(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    const query: GenericHttpRequest['query'] = {
        ...event.queryStringParameters,
    };

    const headers: GenericHttpHeaders = {};
    for (let key in event.headers) {
        const value = event.headers[key];
        headers[key.toLowerCase()] = value;
    }

    const response = await httpServer.handleRequest({
        method: event.httpMethod as GenericHttpRequest['method'],
        path: event.path,
        pathParams: event.pathParameters,
        ipAddress: event.requestContext.identity.sourceIp,
        body: event.body,
        query,
        headers,
    });

    return {
        statusCode: response.statusCode,
        body: response.body ?? null,
        headers: response.headers,
    };
}

export async function handleRecords(
    event: APIGatewayProxyEvent | S3Event | EventBridgeEvent<any, any>
) {
    if ('httpMethod' in event) {
        return handleApiEvent(event);
    } else if ('source' in event) {
        return handleEventBridgeEvent(event);
    } else {
        return handleS3Event(event);
    }
}
