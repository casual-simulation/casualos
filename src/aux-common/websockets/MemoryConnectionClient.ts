import { ConnectionClient, ClientConnectionState } from './ConnectionClient';
import { Observable, Subject, never, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { ConnectionInfo } from '../common/ConnectionInfo';
import { WebsocketErrorInfo, WebsocketMessage } from './WebsocketEvents';

export class MemoryConnectionClient implements ConnectionClient {
    private _connectionState: BehaviorSubject<ClientConnectionState>;
    private _onError: Subject<WebsocketErrorInfo>;
    private _info: ConnectionInfo;

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

    get onError() {
        return this._onError;
    }

    event<T>(name: WebsocketMessage['type']): Observable<T> {
        return (this.events.get(name) as any) || never();
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
        this._info = device;
        this.sentMessages = [];
        this._onError = new Subject();
        this._connectionState = new BehaviorSubject<ClientConnectionState>({
            connected: false,
            info: null,
        });
    }
}
