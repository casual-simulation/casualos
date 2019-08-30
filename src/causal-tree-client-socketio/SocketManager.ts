import io from 'socket.io-client';
import { Observable, BehaviorSubject } from 'rxjs';

export class SocketManager {
    private _socket: SocketIOClient.Socket;

    // Whether this manager has forced the user to be offline or not.
    private _forcedOffline: boolean = false;
    private _url: string;

    private _connectionStateChanged: BehaviorSubject<boolean>;

    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    /**
     * Gets whether the socket manager is forcing the user to be offline or not.
     */
    public get forcedOffline() {
        return this._forcedOffline;
    }

    public set forcedOffline(value: boolean) {
        this._forcedOffline = !this._forcedOffline;
        if (this._forcedOffline) {
            this._socket.disconnect();
        } else {
            this._socket.connect();
        }
    }

    get socket() {
        return this._socket;
    }

    /**
     * Creates a new SocketManager.
     * @param user The user account to use for connecting.
     * @param url The URL to connect to.
     */
    constructor(url?: string) {
        this._connectionStateChanged = new BehaviorSubject<boolean>(false);
        this._url = url;
    }

    init(): void {
        console.log('[SocketManager] Starting...');
        this._socket = io(this._url, {
            transports: ['websocket'],
        });

        this._socket.on('connect', () => {
            console.log('[SocketManager] Connected.');
            this._connectionStateChanged.next(true);
        });

        this._socket.on('connect_timeout', () => {
            console.log('[SocketManager] Connection timeout.');
        });

        this._socket.on('connect_error', (err: any) => {
            console.error('[SocketManager] Connection error.', err);
        });

        this._socket.on('disconnect', (reason: any) => {
            console.log('[SocketManger] Disconnected. Reason:', reason);
            this._connectionStateChanged.next(false);
        });
    }

    /**
     * Toggles whether the socket manager should be forcing the user's
     * connection to the server to be offline.
     */
    toggleForceOffline() {
        this.forcedOffline = !this.forcedOffline;
    }
}
