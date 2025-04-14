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
import type {
    ConnectionClient,
    ClientConnectionState,
} from './ConnectionClient';
import type { Observable } from 'rxjs';
import { Subject, NEVER, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import type { ConnectionInfo } from '../common/ConnectionInfo';
import type { WebsocketErrorInfo, WebsocketMessage } from './WebsocketEvents';
import type { ConnectionIndicator } from '../common';

export class MemoryConnectionClient implements ConnectionClient {
    private _connectionState: BehaviorSubject<ClientConnectionState>;
    private _onError: Subject<WebsocketErrorInfo>;
    private _info: ConnectionInfo;
    private _indicator: ConnectionIndicator | null;

    get connectionState(): Observable<ClientConnectionState> {
        return this._connectionState.pipe(distinctUntilChanged());
    }

    get isConnected(): boolean {
        return this._connectionState.value.connected;
    }

    sentMessages: WebsocketMessage[];
    events = new Map<WebsocketMessage['type'], Subject<any>>();

    get info() {
        return this._info;
    }

    set info(value: ConnectionInfo) {
        this._info = value;
    }

    get indicator(): ConnectionIndicator | null {
        return this._indicator;
    }

    set indicator(value: ConnectionIndicator | null) {
        this._indicator = value;
    }

    get onError() {
        return this._onError;
    }

    origin: string;

    event<T>(name: WebsocketMessage['type']): Observable<T> {
        return (this.events.get(name) as any) || NEVER;
    }

    send(message: WebsocketMessage): void {
        this.sentMessages.push(message);
    }

    disconnect(): void {
        this._connectionState.next({
            connected: false,
            info: null,
        });
    }

    connect(): void {
        this._connectionState.next({
            connected: true,
            info: this._info,
        });
    }

    constructor(device?: ConnectionInfo) {
        this.origin = 'http://localhost';
        this._info = device;
        this._indicator = null;
        this.sentMessages = [];
        this._onError = new Subject();
        this._connectionState = new BehaviorSubject<ClientConnectionState>({
            connected: false,
            info: null,
        });
    }
}
