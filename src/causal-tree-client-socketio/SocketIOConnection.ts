import {
    RealtimeChannelConnection,
    RealtimeChannelInfo,
    Atom,
    AtomOp,
    SiteInfo,
    StoredCausalTree,
    SiteVersionInfo,
    DeviceInfo,
    User,
    ConnectionEvent,
    RealtimeChannelResult,
    LoginErrorReason,
    Event,
} from '@casual-simulation/causal-trees';
import {
    Observable,
    merge,
    Subject,
    BehaviorSubject,
    SubscriptionLike,
    Subscription,
    Observer,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { socketEvent } from './Utils';

/**
 * Defines a RealtimeChannelConnection that can use Socket.IO.
 */
export class SocketIOConnection implements RealtimeChannelConnection {
    private _socket: typeof io.Socket;
    private _events: Subject<Atom<AtomOp>[]>;
    private _sites: Subject<SiteInfo>;
    private _connected: BehaviorSubject<boolean>;
    private _connectionStateChanged: Observable<boolean>;
    private _sub: Subscription;

    info: RealtimeChannelInfo;

    /**
     * Creates a new RealtimeChannelConnection for Socket.IO.
     * @param socket The Socket.IO instance.
     */
    constructor(
        socket: typeof io.Socket,
        connectionStateChanged: Observable<boolean>,
        info: RealtimeChannelInfo
    ) {
        this.info = info;
        this.closed = false;
        this._socket = socket;
        this._connectionStateChanged = connectionStateChanged;
        this._events = new Subject<Atom<AtomOp>[]>();
        this._sites = new Subject<SiteInfo>();
        this._connected = new BehaviorSubject<boolean>(socket.connected);
    }

    login(user: User): Observable<RealtimeChannelResult<DeviceInfo>> {
        let loginResults = socketEvent(
            this._socket,
            'login_result',
            (err: any, info: DeviceInfo) => ({
                error: err,
                info: info,
            })
        );

        this._socket.emit('login', user);

        return loginResults.pipe(
            map(({ error, info }) => {
                if (error) {
                    return <RealtimeChannelResult<DeviceInfo>>{
                        success: false,
                        value: null,
                        error: {
                            type: 'not_authenticated',
                            reason: error.error,
                        },
                    };
                }
                return {
                    success: true,
                    value: info,
                };
            })
        );
    }

    joinChannel(): Observable<RealtimeChannelResult<void>> {
        let joinResults = socketEvent(
            this._socket,
            `join_channel_result_${this.info.id}`,
            (err: any) => ({
                error: err,
            })
        );

        this._socket.emit('join_channel', this.info);

        return joinResults.pipe(
            map(({ error }) => {
                if (error) {
                    return {
                        success: false,
                        value: null,
                        error: {
                            type: 'not_authorized',
                            reason: error,
                        },
                    };
                }
                return {
                    success: true,
                    value: null,
                };
            })
        );
    }

    async exchangeInfo(
        version: SiteVersionInfo
    ): Promise<RealtimeChannelResult<SiteVersionInfo>> {
        const info = await this._request<SiteVersionInfo>(
            `info_${this.info.id}`,
            version
        );

        return {
            success: true,
            value: info,
        };
    }

    async requestSiteId(
        site: SiteInfo
    ): Promise<RealtimeChannelResult<boolean>> {
        const allowed = await this._request<boolean>(
            `siteId_${this.info.id}`,
            site
        );

        return {
            success: true,
            value: allowed,
        };
    }

    async exchangeWeaves<T extends AtomOp>(
        message: StoredCausalTree<T>
    ): Promise<RealtimeChannelResult<StoredCausalTree<T>>> {
        const tree = await this._request<StoredCausalTree<T>>(
            `weave_${this.info.id}`,
            message
        );

        return {
            success: true,
            value: tree,
        };
    }

    connect(): void {
        this._sub = this._connectionStateChanged.subscribe(this._connected);

        let eventListener = (event: Atom<AtomOp>[]) => {
            this._events.next(event);
        };
        this._socket.on(`event_${this.info.id}`, eventListener);

        let siteListener = (event: SiteInfo) => {
            this._sites.next(event);
        };
        this._socket.on(`site_${this.info.id}`, siteListener);

        this._sub.add(() => {
            this._socket.off(`event_${this.info.id}`, eventListener);
            this._socket.off(`site_${this.info.id}`, siteListener);
        });
    }

    isConnected(): boolean {
        return this._connected.value;
    }

    get events(): Observable<Atom<AtomOp>[]> {
        return this._events;
    }

    get sites(): Observable<SiteInfo> {
        return this._sites;
    }

    async emit(event: Atom<AtomOp>[]): Promise<RealtimeChannelResult<void>> {
        this._socket.emit(`event_${this.info.id}`, event);

        return {
            success: true,
            value: null,
        };
    }

    async sendEvents(events: Event[]): Promise<void> {
        this._socket.emit(`remote_event_${this.info.id}`, events);
    }

    _request<T>(name: string, data: any): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this._socket.emit(name, data, (err: any, response: T) => {
                if (err) {
                    reject(err);
                }
                resolve(response);
            });
        });
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._connected;
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._sub.unsubscribe();
        }
    }

    closed: boolean;
}
