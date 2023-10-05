import {
    BehaviorSubject,
    Observable,
    concatMap,
    distinctUntilKeyChanged,
    first,
    map,
    of,
    takeUntil,
    tap,
} from 'rxjs';
import {
    ClientConnectionState,
    ConnectionClient,
    WebsocketType,
} from './ConnectionClient';
import {
    LoginMessage,
    WatchBranchMessage,
    UnwatchBranchMessage,
    AddUpdatesMessage,
    SendActionMessage,
    WatchBranchDevicesMessage,
    UnwatchBranchDevicesMessage,
    ConnectionCountMessage,
    TimeSyncRequestMessage,
    GetUpdatesMessage,
    LoginResultMessage,
    TimeSyncResponseMessage,
    UpdatesReceivedMessage,
    ReceiveDeviceActionMessage,
    ConnectedToBranchMessage,
    DisconnectedFromBranchMessage,
    RateLimitExceededMessage,
    WebsocketMessage,
} from './WebsocketEvents';
import { ConnectionIndicator } from '../common';
import { state } from 'esri/widgets/TableList/TableListViewModel';

/**
 * Defines a connection client that attempts to authenticate before bubbling a connection event.
 */
export class AuthenticatedConnectionClient implements ConnectionClient {
    private _inner: ConnectionClient;
    private _indicator: ConnectionIndicator;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;

    constructor(inner: ConnectionClient, indicator: ConnectionIndicator) {
        this._inner = inner;
        this._indicator = indicator;
        this._connectionStateChanged =
            new BehaviorSubject<ClientConnectionState>({
                connected: false,
                info: null,
            });

        this._inner.connectionState
            .pipe(
                concatMap((state) => this._login(state.connected)),
                distinctUntilKeyChanged('connected')
            )
            .subscribe(this._connectionStateChanged);
    }

    get info() {
        return this._connectionStateChanged.value.info;
    }

    get connectionState(): Observable<ClientConnectionState> {
        return this._connectionStateChanged;
    }

    get onError() {
        return this._inner.onError;
    }

    get isConnected(): boolean {
        return this._inner.isConnected;
    }

    /**
     * Gets an observable for events with the given name.
     * @param name The name of the events.
     */
    event<K extends WebsocketMessage['type']>(
        name: K
    ): Observable<WebsocketType<K>> {
        return this._inner.event(name);
    }

    send(message: WebsocketMessage): void {
        return this._inner.send(message);
    }

    disconnect(): void {
        this._inner.disconnect();
    }

    connect(): void {
        this._inner.connect();
    }

    private _login(connected: boolean): Observable<ClientConnectionState> {
        if (connected) {
            console.log('[AuthencatedConnectionClient] Logging in...');
            const onLoginResult = this._inner.event('login_result');
            this._inner.send({
                type: 'login',
                ...this._indicator,
            });

            return onLoginResult.pipe(
                tap(() =>
                    console.log('[AuthencatedConnectionClient] Logged in.')
                ),
                map((result) => ({
                    connected: true,
                    info: result.info,
                })),
                first(),
                takeUntil(
                    this._inner.connectionState.pipe(
                        first((state) => !state.connected)
                    )
                )
            );
        } else {
            return of({
                connected: false,
                info: null,
            });
        }
    }
}
