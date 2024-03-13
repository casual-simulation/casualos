// Create clients and set shared const values outside of the handler.
import {
    GenericHttpRequest,
    GenericHttpHeaders,
} from '@casual-simulation/aux-common';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    EventBridgeEvent,
    S3Event,
} from 'aws-lambda';
import { constructServerBuilder, FILES_BUCKET } from '../LoadServer';

const builder = constructServerBuilder();

const { server, filesStore, websocketController } = builder.build();

async function handleEventBridgeEvent(event: EventBridgeEvent<any, any>) {
    console.log('[Records] Got EventBridge event:', event);
}

async function handleS3Event(event: S3Event) {
    await Promise.all(
        event.Records.map(async (record) => {
            const bucketName = record.s3.bucket.name;

            if (bucketName !== FILES_BUCKET) {
                console.warn(
                    `[Records1] Got event for wrong bucket: ${bucketName}`
                );
                return;
            }

            const key = record.s3.object.key;

            const firstSlash = key.indexOf('/');

            if (firstSlash < 0) {
                console.warn('[Records] Unable to process key:', key);
                return;
            }

            const recordName = key.substring(0, firstSlash);
            const fileName = key.substring(firstSlash + 1);

            const result = await filesStore.setFileRecordAsUploaded(
                recordName,
                fileName
            );

            if (result.success === false) {
                if (result.errorCode === 'file_not_found') {
                    console.error('[Records] File not found:', key);
                }
            } else {
                console.log('[Records] File marked as uploaded:', key);
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

    const response = await server.handleHttpRequest({
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
    await builder.ensureInitialized();
    if ('httpMethod' in event) {
        return handleApiEvent(event);
    } else if ('source' in event) {
        return handleEventBridgeEvent(event);
    } else {
        return handleS3Event(event);
    }
}

export async function savePermanentBranches() {
    await builder.ensureInitialized();
    await websocketController.savePermanentBranches();
}
