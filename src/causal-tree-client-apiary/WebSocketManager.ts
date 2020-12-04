import { Observable, BehaviorSubject, Subject, pipe } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { ReconnectableSocket } from './ReconnectableSocket';

const RECONNECT_TIME = 5000;

export class SocketManager {
    private _socket: ReconnectableSocket;

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
            this._socket.close();
        } else {
            this._socket.open();
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
        console.log('[WebSocketManager] Starting...');
        this._socket = new ReconnectableSocket(this._url);

        this._socket.onClose
            .pipe(
                filter((e) => e.type === 'other'),
                debounceTime(RECONNECT_TIME),
                tap(() => {
                    console.log('[WebSocketManager] Reconnecting...');
                    this._socket.open();
                })
            )
            .subscribe();

        this._socket.onError.subscribe((event) => {
            console.log('[WebSocketManager] Error:', event);
        });

        this._socket.onOpen.subscribe(() => {
            console.log('[WebSocketManager] Connected.');
            this._connectionStateChanged.next(true);
        });

        this._socket.onClose.subscribe(() => {
            console.log('[WebSocketManager] Closed.');
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
