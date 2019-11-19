import { ConnectionClient } from './ConnectionClient';
import { Observable, Subject, never, BehaviorSubject } from 'rxjs';

export class MemoryConnectionClient implements ConnectionClient {
    private _connectionState: BehaviorSubject<boolean>;

    get connectionState(): Observable<boolean> {
        return this._connectionState;
    }

    connected: boolean;
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
        this.connected = false;
    }

    constructor() {
        this.connected = true;
        this.sentMessages = [];
        this._connectionState = new BehaviorSubject<boolean>(false);
    }

    setConnected(connected: boolean) {
        this._connectionState.next(connected);
    }
}
