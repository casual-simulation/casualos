/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import '../Instrumentation';
import {
    type GenericHttpRequest,
    type GenericHttpHeaders,
    tryParseJson,
} from '@casual-simulation/aux-common';
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    EventBridgeEvent,
    S3Event,
    S3EventRecord,
    SNSEvent,
    SNSEventRecord,
} from 'aws-lambda';
import {
    constructServerlessAwsServerBuilder,
    FILES_BUCKET,
} from '../../../../shared/LoadServer';
import { S3FileRecordsStore } from '@casual-simulation/aux-records-aws';
import type { S3BatchEvent } from './S3Batch';
import { z } from 'zod';
import type { SearchSyncQueueEvent } from '@casual-simulation/aux-records';
import { SEARCH_SYNC_QUEUE_EVENT_SCHEMA } from '@casual-simulation/aux-records';

const builder = constructServerlessAwsServerBuilder();

const {
    server,
    filesStore,
    websocketController,
    moderationController,
    searchSyncProcessor,
} = builder.build();

async function handleEventBridgeEvent(event: EventBridgeEvent<any, any>) {
    console.log('[Records] Got EventBridge event:', event);
}

async function handleSnsJob(record: SNSEventRecord) {
    const job = record.Sns;
    const json = tryParseJson(job.Message);

    if (!json.success) {
        throw new Error('Invalid job payload! It must be valid JSON.');
    }

    const data = json.value;

    const parseResult = SEARCH_SYNC_QUEUE_EVENT_SCHEMA.safeParse(data);

    if (!parseResult.success) {
        console.error('[jobs] Invalid job payload:', parseResult);
        throw new Error('Invalid job payload!');
    }

    await searchSyncProcessor.process(parseResult.data as SearchSyncQueueEvent);
}

async function handleS3Job(record: S3EventRecord) {
    const bucketName = record.s3.bucket.name;

    if (bucketName !== FILES_BUCKET) {
        console.warn(`[Records1] Got event for wrong bucket: ${bucketName}`);
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
}

async function handleS3OrSNSEvent(event: S3Event | SNSEvent) {
    await Promise.allSettled(
        event.Records.map(async (record) => {
            if ('s3' in record) {
                return await handleS3Job(record);
            } else {
                return await handleSnsJob(record);
            }
        })
    );
}

async function handleS3BatchEvent(event: S3BatchEvent) {
    console.log('[Records] Got S3 Batch event:', event);

    if (!(filesStore instanceof S3FileRecordsStore)) {
        console.error('[Records] Files store is not an S3 store:', filesStore);
        return;
    }

    const userArgumentsSchema = z.object({
        jobId: z.string(),
    });

    const { jobId } = userArgumentsSchema.parse(event.job.userArguments);

    return {
        invocationSchemaVersion: event.invocationSchemaVersion,
        treatMissingKeysAs: 'PermanentFailure',
        invocationId: event.invocationId,
        results: await Promise.all(
            event.tasks.map(async (task) => {
                try {
                    const key = task.s3Key;
                    const bucket = task.s3Bucket;

                    const fileName = await filesStore.getFileInfo(bucket, key);
                    if (fileName.success === false) {
                        console.error(
                            '[Records] Unable to get file info:',
                            bucket,
                            key,
                            fileName
                        );
                        return;
                    }

                    const result = await moderationController.scanFile({
                        recordName: fileName.recordName,
                        fileName: fileName.fileName,
                        jobId: jobId,
                    });

                    if (result.success === true) {
                        console.log(
                            '[Records] Scanned file:',
                            fileName,
                            result.result
                        );
                        return {
                            taskId: task.taskId,
                            resultCode: 'Succeeded',
                            resultString: `Scanned file: ${fileName.recordName}/${fileName.fileName}`,
                        };
                    } else {
                        console.error(
                            '[Records] Failed to scan file:',
                            fileName,
                            result
                        );
                        return {
                            taskId: task.taskId,
                            resultCode: 'PermanentFailure',
                            resultString: `Error scanning file (${fileName.recordName}/${fileName.fileName}): ${result.errorCode}\n${result.errorMessage}`,
                        };
                    }
                } catch (err) {
                    console.error('[Records] Error scanning file:', err);
                    return {
                        taskId: task.taskId,
                        resultCode: 'PermanentFailure',
                        resultString: `Error scanning file: ${err}`,
                    };
                }
            })
        ),
    };
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

    if (
        typeof response.body === 'object' &&
        Symbol.asyncIterator in response.body
    ) {
        let buffer = '';
        for await (const chunk of response.body) {
            buffer += chunk;
        }
        return {
            statusCode: response.statusCode,
            body: buffer,
            headers: response.headers,
        };
    } else {
        return {
            statusCode: response.statusCode,
            body: response.body ?? null,
            headers: response.headers,
        };
    }
}

export async function handleRecords(
    event:
        | APIGatewayProxyEvent
        | S3Event
        | S3BatchEvent
        | SNSEvent
        | EventBridgeEvent<any, any>
) {
    await builder.ensureInitialized();
    if ('httpMethod' in event) {
        return handleApiEvent(event);
    } else if ('source' in event) {
        return handleEventBridgeEvent(event);
    } else if ('job' in event) {
        return handleS3BatchEvent(event);
    } else {
        return handleS3OrSNSEvent(event);
    }
}

export async function savePermanentBranches() {
    await builder.ensureInitialized();

    // 15 minute timeout to match the lambda timeout.
    await websocketController.savePermanentBranches(900 * 1000);
}

export async function scheduleModerationScans() {
    await builder.ensureInitialized();

    const result = await moderationController.scheduleModerationScans();
    console.log('[Records] Scheduled moderation scans result:', result);
}
