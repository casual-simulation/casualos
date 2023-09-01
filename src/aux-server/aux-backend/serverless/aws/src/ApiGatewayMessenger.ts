import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';
import {
    Packet,
    ApiaryConnectionStore,
    ApiaryMessenger,
    Message,
} from '@casual-simulation/casual-apiary';
import {
    AwsDownloadRequest,
    AwsMessageData,
    AwsMessageTypes,
} from './AwsMessages';
import { getS3Client, uploadMessage } from './WebsocketUtils';
import { S3 } from '@aws-sdk/client-s3';
import { Subscription, SubscriptionLike } from 'rxjs';

export const MAX_MESSAGE_SIZE = 32_000;

/**
 * Defines a class that implements the ApiaryMessenger interface for AWS API Gateway.
 */
export class ApiGatewayMessenger implements ApiaryMessenger, SubscriptionLike {
    private _api: ApiGatewayManagementApi;
    private _s3: S3;
    private _connections: ApiaryConnectionStore;
    private _sub: Subscription;

    constructor(endpoint: string, connectionStore: ApiaryConnectionStore) {
        this._api = new ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: endpoint,
        });
        this._s3 = getS3Client();
        this._connections = connectionStore;
        this._sub = new Subscription();

        this._sub.add(() => {
            this._api.destroy();
            this._s3.destroy();
        });
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    async sendMessage(
        connectionIds: string[],
        data: Message,
        excludeConnection?: string
    ): Promise<void> {
        console.log(`[ApiGatewayMessenger] [${data.name}] Send Message`);
        const packet: Packet = {
            type: 'message',
            channel: data.name,
            data: data.data,
        };
        const jsonData = JSON.stringify(packet);
        try {
            await this._sendData(connectionIds, jsonData, excludeConnection);
        } catch (err) {
            console.error('[ApiGatewayMessenger] Failed to send message.', err);
        }
    }

    async sendPacket(connectionId: string, packet: Packet) {
        const jsonData = JSON.stringify(packet);
        await this._sendData([connectionId], jsonData);
    }

    async sendRaw(connectionId: string, data: string) {
        await this._api.postToConnection({
            ConnectionId: connectionId,
            Data: data,
        });
    }

    private async _sendData(
        connectionIds: string[],
        data: string,
        excludeConnection?: string
    ) {
        // TODO: Calculate the real message size instead of just assuming that
        // each character is 1 byte
        if (data.length > MAX_MESSAGE_SIZE) {
            const url = await uploadMessage(this._s3, data);

            // Request download
            const downloadRequest: AwsDownloadRequest = [
                AwsMessageTypes.DownloadRequest,
                url,
            ];
            const downloadRequestJson = JSON.stringify(downloadRequest);

            const promises = connectionIds.map(async (id) => {
                if (id !== excludeConnection) {
                    try {
                        await this._api.postToConnection({
                            ConnectionId: id,
                            Data: downloadRequestJson,
                        });
                    } catch (err) {
                        if (err.code === 'GoneException') {
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
            const message: AwsMessageData = [AwsMessageTypes.Message, data];
            const messageJson = JSON.stringify(message);

            const promises = connectionIds.map(async (id) => {
                if (id !== excludeConnection) {
                    try {
                        await this._api.postToConnection({
                            ConnectionId: id,
                            Data: messageJson,
                        });
                    } catch (err) {
                        if (err.code === 'GoneException') {
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
