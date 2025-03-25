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
