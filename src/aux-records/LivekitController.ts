import { AccessToken } from 'livekit-server-sdk';
import { IssueMeetTokenResult } from './LivekitEvents';

/**
 * Defines a class that is able to issue tokens for livekit based meetings.
 */
export class LivekitController {
    private _apiKey: string;
    private _secretKey: string;
    private _endpoint: string;

    /**
     * Creates a new LivekitController that issues tokens using the given API Key, Secret Key, and Endpoint.
     * @param apiKey The API Key that should be used to generate tokens.
     * @param secretKey The secret key that should be used to generate tokens.
     * @param endpoint The HTTP/WebSocket endpoint that the livekit server is available at.
     */
    constructor(apiKey: string, secretKey: string, endpoint: string) {
        this._apiKey = apiKey;
        this._secretKey = secretKey;
        this._endpoint = endpoint;
    }

    /**
     * Attempts to issue a token for the given User ID to join the given room.
     * @param roomName The name of the room.
     * @param userName The username of the user. Simply needs to be a unique identifier and is not attached to an account.
     */
    async issueToken(
        roomName: string,
        userName: string
    ): Promise<IssueMeetTokenResult> {
        if (!this._apiKey || !this._secretKey || !this._endpoint) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Meetings are not supported on this inst.',
            };
        }
        try {
            if (!roomName) {
                return {
                    success: false,
                    errorCode: 'invalid_room_name',
                    errorMessage:
                        'Invalid room name. It must not be null or empty.',
                };
            }
            if (!userName) {
                return {
                    success: false,
                    errorCode: 'invalid_username',
                    errorMessage:
                        'Invalid Username. It must not be null or empty.',
                };
            }

            const token = new AccessToken(this._apiKey, this._secretKey, {
                identity: userName,
            });
            token.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            });

            const jwt = token.toJwt();

            return {
                success: true,
                roomName: roomName,
                token: jwt,
                url: this._endpoint,
            };
        } catch (err) {
            console.error(err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
    }
}
