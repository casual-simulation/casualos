/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import {
    BehaviorSubject,
    NEVER,
    Observable,
    concat,
    concatMap,
    defer,
    distinctUntilChanged,
    distinctUntilKeyChanged,
    filter,
    first,
    firstValueFrom,
    from,
    map,
    mergeMap,
    mergeWith,
    of,
    share,
    shareReplay,
    skip,
    startWith,
    switchMap,
    takeUntil,
    tap,
} from 'rxjs';
import type {
    ClientConnectionState,
    ConnectionClient,
    WebsocketType,
} from './ConnectionClient';
import type { WebsocketMessage } from './WebsocketEvents';
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
} from './WebsocketEvents';
import type { ConnectionIndicator } from '../common';
import type {
    PartitionAuthResponse,
    PartitionAuthResponseSuccess,
    PartitionAuthSource,
} from '../partitions';

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
                switchMap((state) => this._login(state.connected)),

                // Only deduplicate disconnected events
                distinctUntilChanged(
                    (previous, current) =>
                        !current.connected &&
                        current.connected === previous.connected
                )
            )
            .subscribe(this._connectionStateChanged);

        this._authSource.onAuthPermissionRequest.subscribe((request) => {
            if (request.origin === this.origin) {
                this._inner.send({
                    type: 'permission/request/missing',
                    reason: request.reason,
                });
            }
        });

        this._authSource.onAuthPermissionResult.subscribe((result) => {
            if (result.origin === this.origin) {
                this._inner.send({
                    ...result,
                    type: 'permission/request/missing/response',
                });
            }
        });

        this._inner.event('permission/request/missing').subscribe((request) => {
            this._authSource.sendAuthExternalPermissionRequest({
                type: 'external_permission_request',
                origin: this.origin,
                reason: request.reason,
                user: request.user,
            });
        });

        this._inner
            .event('permission/request/missing/response')
            .subscribe((response) => {
                this._authSource.sendAuthExternalPermissionResult({
                    ...response,
                    type: 'external_permission_result',
                    origin: this.origin,
                });
            });
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

            let responses = this._authSource.onAuthResponseForOrigin(
                this.origin
            );

            if (indicator) {
                responses = responses.pipe(
                    startWith({
                        type: 'response',
                        success: true,
                        indicator,
                        origin: this.origin,
                    } as PartitionAuthResponse)
                );
            } else {
                this._authSource.sendAuthRequest({
                    type: 'request',
                    origin: this.origin,
                    kind: 'need_indicator',
                });
            }

            const loginStates = responses.pipe(
                filter(
                    (r): r is PartitionAuthResponseSuccess => r.success === true
                ),
                map((r) => r.indicator),
                switchMap((indicator) => this._loginWithIndicator(indicator)),
                switchMap((v) => v)
            );

            return loginStates;
        } else {
            return of({
                connected: false,
                info: null,
            });
        }
    }

    private async _loginWithIndicator(
        indicator: ConnectionIndicator
    ): Promise<Observable<ClientConnectionState>> {
        const onLoginResult = this._inner.event('login_result');
        this._inner.send({
            type: 'login',
            ...indicator,
        });

        const result = await firstValueFrom(onLoginResult);
        if (result.success === true) {
            console.log('[AuthencatedConnectionClient] Logged in.');
            return of({
                connected: true,
                info: result.info,
            });
        } else {
            // handle login failure
            console.error(
                '[AuthenticatedConnectionClient] Login failed:',
                result
            );

            // Resend request for indicator
            this._authSource.sendAuthRequest({
                type: 'request',
                origin: this.origin,
                kind: 'invalid_indicator',
                indicator: indicator,
                errorCode: result.errorCode,
                errorMessage: result.errorMessage,
                reason: result.reason,
            });

            return NEVER;
        }
    }
}

function onSubscribe<T>(
    onSubscribe: () => void
): (source: Observable<T>) => Observable<T> {
    return function inner(source: Observable<T>): Observable<T> {
        return new Observable((observer) => {
            const sub = source.subscribe(observer);
            onSubscribe();
            return sub;
        });
    };
}
