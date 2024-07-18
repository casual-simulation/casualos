import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';
import {
    AwsDownloadRequest,
    AwsMessageData,
    AwsMessageTypes,
} from './AwsMessages';
import {
    downloadObject,
    getMessageUploadUrl,
    uploadMessage,
} from './WebsocketUtils';
import { S3 } from '@aws-sdk/client-s3';
import {
    PresignFileUploadResult,
    WebsocketConnectionStore,
    WebsocketMessenger,
    signRequest,
} from '@casual-simulation/aux-records';
import {
    UploadHttpHeaders,
    WebsocketDownloadRequestEvent,
    WebsocketEvent,
    WebsocketEventTypes,
    WebsocketMessage,
    WebsocketMessageEvent,
} from '@casual-simulation/aux-common';
import axios, { Method } from 'axios';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { v4 as uuid } from 'uuid';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';

export const MAX_MESSAGE_SIZE = 32_000;
const TRACE_NAME = 'ApiGatewayMessenger';

/**
 * Defines a class that implements the ApiaryMessenger interface for AWS API Gateway.
 */
export class ApiGatewayWebsocketMessenger implements WebsocketMessenger {
    private _api: ApiGatewayManagementApi;
    private _s3: S3;
    private _connections: WebsocketConnectionStore;
    private _bucket: string;

    constructor(
        endpoint: string,
        bucket: string,
        s3: S3,
        connectionStore: WebsocketConnectionStore
    ) {
        this._api = new ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: endpoint,
        });
        this._s3 = s3;
        this._connections = connectionStore;
        this._bucket = bucket;
    }

    @traced(TRACE_NAME)
    async disconnect(connectionId: string): Promise<void> {
        await this._api.deleteConnection({
            ConnectionId: connectionId,
        });
    }

    @traced(TRACE_NAME)
    async presignMessageUpload(): Promise<PresignFileUploadResult> {
        try {
            const uploadUrl = await getMessageUploadUrl(
                this._s3,
                this._bucket,
                uuid()
            );
            return {
                success: true,
                uploadUrl,
                uploadHeaders: {},
                uploadMethod: 'PUT',
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[ApiGatewayMessenger] Failed to presign message upload.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async downloadMessage(
        url: string,
        method: string,
        headers: UploadHttpHeaders
    ): Promise<string> {
        return await downloadObject(this._s3, this._bucket, url);
    }

    @traced(TRACE_NAME)
    async sendMessage(
        connectionIds: string[],
        data: WebsocketMessage,
        excludeConnection?: string
    ): Promise<void> {
        console.log(`[ApiGatewayMessenger] [${data.type}] Send Message`);

        try {
            await this._sendMessage(connectionIds, data, excludeConnection);
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error('[ApiGatewayMessenger] Failed to send message.', err);
        }
    }

    @traced(TRACE_NAME)
    async sendEvent(
        connectionId: string,
        event: WebsocketEvent
    ): Promise<void> {
        console.log(`[ApiGatewayMessenger] Send Event Type: ${event[0]}`);

        await this._api.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(event),
        });
    }

    @traced(TRACE_NAME)
    async sendRaw(connectionId: string, data: string) {
        await this._api.postToConnection({
            ConnectionId: connectionId,
            Data: data,
        });
    }

    @traced(TRACE_NAME)
    private async _sendMessage(
        connectionIds: string[],
        message: WebsocketMessage,
        excludeConnection?: string
    ) {
        const data = JSON.stringify(message);

        // TODO: Calculate the real message size instead of just assuming that
        // each character is 1 byte
        if (data.length > MAX_MESSAGE_SIZE) {
            const url = await uploadMessage(this._s3, this._bucket, data);

            // Request download
            const event: WebsocketDownloadRequestEvent = [
                WebsocketEventTypes.DownloadRequest,
                -1,
                url,
                'GET',
                {},
            ];
            const promises = connectionIds.map(async (id) => {
                if (id !== excludeConnection) {
                    try {
                        await this.sendEvent(id, event);
                    } catch (err) {
                        if (err.name === 'GoneException') {
                            // The connection no longer exists. We should remove it.
                            console.log(
                                `[ApiGatewayMessenger] Connection ${id} missing. Expiring.`
                            );
                            await this._connections.expireConnection(id);
                        } else {
                            throw err;
                        }
                    }
                }
            });
            await Promise.all(promises);
        } else {
            const event: WebsocketMessageEvent = [
                WebsocketEventTypes.Message,
                0,
                message,
            ];
            const promises = connectionIds.map(async (id) => {
                if (id !== excludeConnection) {
                    try {
                        await this.sendEvent(id, event);
                    } catch (err) {
                        if (err.name === 'GoneException') {
                            // The connection no longer exists. We should remove it.
                            console.log(
                                `[ApiGatewayMessenger] Connection ${id} missing. Expiring.`
                            );
                            await this._connections.expireConnection(id);
                        } else {
                            throw err;
                        }
                    }
                }
            });
            await Promise.all(promises);
        }
    }
}
