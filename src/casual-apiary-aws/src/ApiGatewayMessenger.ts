import { ApiGatewayManagementApi } from 'aws-sdk';
import { ApiaryConnectionStore } from './ApiaryConnectionStore';
import { ApiaryMessenger, Message } from './ApiaryMessenger';
import {
    AwsDownloadRequest,
    AwsMessageData,
    AwsMessageTypes,
} from './AwsMessages';
import { Packet } from './Events';
import { getS3Client, uploadMessage } from './Utils';

export const MAX_MESSAGE_SIZE = 32_000;

/**
 * Defines a class that implements the ApiaryMessenger interface for AWS API Gateway.
 */
export class ApiGatewayMessenger implements ApiaryMessenger {
    private _api: ApiGatewayManagementApi;
    private _s3: AWS.S3;
    private _connections: ApiaryConnectionStore;

    constructor(endpoint: string, connectionStore: ApiaryConnectionStore) {
        this._api = new ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: endpoint,
        });
        this._s3 = getS3Client();
        this._connections = connectionStore;
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
        await this._api
            .postToConnection({
                ConnectionId: connectionId,
                Data: data,
            })
            .promise();
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
                        await this._api
                            .postToConnection({
                                ConnectionId: id,
                                Data: downloadRequestJson,
                            })
                            .promise();
                    } catch (err) {
                        if (err.code === 'GoneException') {
                            // The connection no longer exists. We should remove it.
                            console.log(
                                `[ApiGatewayMessenger] Connection ${id} missing. Removing.`
                            );
                            await this._connections.clearConnection(id);
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
                        await this._api
                            .postToConnection({
                                ConnectionId: id,
                                Data: messageJson,
                            })
                            .promise();
                    } catch (err) {
                        if (err.code === 'GoneException') {
                            // The connection no longer exists. We should remove it.
                            console.log(
                                `[ApiGatewayMessenger] Connection ${id} missing. Removing.`
                            );
                            await this._connections.clearConnection(id);
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
