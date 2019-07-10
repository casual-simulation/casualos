import io from 'socket.io-client';
import { User, DeviceInfo } from '@casual-simulation/causal-trees';
import {
    Observable,
    BehaviorSubject,
    SubscriptionLike,
    Subscription,
    Observer,
} from 'rxjs';

export class SocketManager {
    private _socket: SocketIOClient.Socket;

    // Whether this manager has forced the user to be offline or not.
    private _forcedOffline: boolean = false;
    private _user: User;
    private _url: string;

    private _connectionStateChanged: BehaviorSubject<boolean>;
    private _loginStateUpdated: BehaviorSubject<DeviceInfo>;

    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    get loginStateUpdated(): Observable<DeviceInfo> {
        return this._loginStateUpdated;
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
        this._loginStateUpdated = new BehaviorSubject<DeviceInfo>(null);
        this._user = user;
        this._url = url;
    }

    init(): void {
        console.log('[SocketManager] Starting...');
        this._socket = io(this._url);

        this._socket.on('connect', async () => {
            console.log('[SocketManager] Connected.');

            try {
                const info = await this._loginWithUser(this._user);
                this._loginStateUpdated.next(info);
                this._connectionStateChanged.next(true);
            } catch (err) {
                console.log('Socket', err);
                this._connectionStateChanged.error(err);
            }
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
    private _loginWithUser(user: User): Promise<DeviceInfo> {
        console.log('[SocketManager] Login');
        return new Promise<DeviceInfo>((resolve, reject) => {
            this._socket.emit(
                'login',
                user,
                (info: DeviceInfo, error?: any) => {
                    if (error) {
                        reject({
                            type: 'login',
                            reason: error.error,
                        });
                    } else {
                        resolve(info);
                    }
                }
            );
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
