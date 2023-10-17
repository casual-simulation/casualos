import {
    BehaviorSubject,
    Observable,
    concatMap,
    distinctUntilKeyChanged,
    filter,
    first,
    from,
    map,
    of,
    switchMap,
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
import {
    PartitionAuthResponse,
    PartitionAuthResponseSuccess,
    PartitionAuthSource,
} from 'partitions';

/**
 * Defines a connection client that attempts to authenticate before bubbling a connection event.
 */
export class AuthenticatedConnectionClient implements ConnectionClient {
    private _inner: ConnectionClient;
    private _authSource: PartitionAuthSource;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;

    constructor(inner: ConnectionClient, authSource: PartitionAuthSource) {
        this._inner = inner;
        this._authSource = authSource;
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

    get origin() {
        return this._inner.origin;
    }

    get info() {
        return this._connectionStateChanged.value.info;
    }

    get indicator() {
        return this._authSource.getConnectionIndicatorForOrigin(this.origin);
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
            const indicator = this.indicator;

            if (!indicator) {
                const promise = this._authSource.sendAuthRequest({
                    type: 'request',
                    origin: this.origin,
                });

                return from(promise).pipe(
                    filter(
                        (r): r is PartitionAuthResponseSuccess =>
                            r.success === true
                    ),
                    map((r) => r.indicator),
                    switchMap((indicator) =>
                        this._loginWithIndicator(indicator)
                    )
                );
            } else {
                return this._loginWithIndicator(indicator);
            }
        } else {
            return of({
                connected: false,
                info: null,
            });
        }
    }

    private _loginWithIndicator(indicator: ConnectionIndicator) {
        const onLoginResult = this._inner.event('login_result');
        this._inner.send({
            type: 'login',
            ...indicator,
        });

        return onLoginResult.pipe(
            tap(() => console.log('[AuthencatedConnectionClient] Logged in.')),
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
    }
}
