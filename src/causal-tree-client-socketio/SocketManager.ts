import io from 'socket.io-client';
import { User } from '@casual-simulation/causal-trees';
import { Observable, BehaviorSubject } from 'rxjs';
import { connectableObservableDescriptor } from 'rxjs/internal/observable/ConnectableObservable';

export class SocketManager {
    private _socket: SocketIOClient.Socket;

    // Whether this manager has forced the user to be offline or not.
    private _forcedOffline: boolean = false;
    private _user: User;

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
    constructor(user: User, url?: string) {
        this._connectionStateChanged = new BehaviorSubject<boolean>(false);
        this._user = user;

        console.log('[SocketManager] Starting...');
        this._socket = io(url);

        this._socket.on('connect', async () => {
            console.log('[SocketManager] Connected.');

            // TODO: Add some way to catch login errors
            await this.login(this._user);
            this._connectionStateChanged.next(true);
        });

        this._socket.on('disconnect', () => {
            console.log('[SocketManger] Disconnected.');
            this._connectionStateChanged.next(false);
        });
    }

    /**
     * Logs the user in.
     * @param user The user to log in.
     */
    login(user: User): Promise<void> {
        console.log('[SocketManager] Login');
        return new Promise<void>((resolve, reject) => {
            this._socket.emit('login', user, (error?: string) => {
                if (error) {
                    reject(new Error(error));
                } else {
                    resolve();
                }
            });
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
