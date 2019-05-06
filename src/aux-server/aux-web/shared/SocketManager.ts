import io from 'socket.io-client';

export class SocketManager {
    private _socket: SocketIOClient.Socket;

    // Whether this manager has forced the user to be offline or not.
    private _forcedOffline: boolean = false;

    /**
     * Gets whether the socket manager is forcing the user to be offline or not.
     */
    public get forcedOffline() {
        return this._forcedOffline;
    }

    get socket() {
        return this._socket;
    }

    constructor(host?: string) {
        console.log('[SocketManager] Starting...');
        this._socket = io(host ? `https://${host}` : undefined);

        this._socket.on('connect', () => {
            console.log('[SocketManager] Connected.');
        });

        this._socket.on('disconnect', () => {
            console.log('[SocketManger] Disconnected.');
        });
    }

    /**
     * Toggles whether the socket manager should be forcing the user's
     * connection to the server to be offline.
     */
    toggleForceOffline() {
        if (!this._forcedOffline) {
            this._socket.disconnect();
        } else {
            this._socket.connect();
        }
        this._forcedOffline = !this._forcedOffline;
    }
}
