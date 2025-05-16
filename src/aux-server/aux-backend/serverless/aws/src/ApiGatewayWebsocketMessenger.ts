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
import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';

import {
    downloadObject,
    getMessageUploadUrl,
    uploadMessage,
} from './WebsocketUtils';
import type { S3 } from '@aws-sdk/client-s3';
import type {
    PresignFileUploadResult,
    WebsocketConnectionStore,
    WebsocketMessenger,
} from '@casual-simulation/aux-records';
import type {
    UploadHttpHeaders,
    WebsocketDownloadRequestEvent,
    WebsocketEvent,
    WebsocketMessage,
    WebsocketMessageEvent,
} from '@casual-simulation/aux-common';
import { WebsocketEventTypes } from '@casual-simulation/aux-common';
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
        const span = trace.getActiveSpan();
        const data = JSON.stringify(message);

        // TODO: Calculate the real message size instead of just assuming that
        // each character is 1 byte
        const sizeInBytes = data.length;

        if (span) {
            span.setAttribute('messageSize', sizeInBytes);
        }

        if (sizeInBytes > MAX_MESSAGE_SIZE) {
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
