import { ConnectionClient, ClientConnectionState } from './ConnectionClient';
import { Observable, Subject, never, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { DeviceInfo } from '../core/DeviceInfo';

export class MemoryConnectionClient implements ConnectionClient {
    private _connectionState: BehaviorSubject<ClientConnectionState>;
    private _info: DeviceInfo;

    get connectionState(): Observable<ClientConnectionState> {
        return this._connectionState.pipe(distinctUntilChanged());
    }

    get isConnected(): boolean {
        return this._connectionState.value.connected;
    }

    sentMessages: {
        name: string;
        data: any;
    }[];
    events = new Map<string, Subject<any>>();

    event<T>(name: string): Observable<T> {
        return this.events.get(name) || never();
    }

    send(name: string, data: any): void {
        this.sentMessages.push({
            name,
            data,
        });
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

    constructor(device?: DeviceInfo) {
        this._info = device;
        this.sentMessages = [];
        this._connectionState = new BehaviorSubject<ClientConnectionState>({
            connected: false,
            info: null,
        });
    }
}
