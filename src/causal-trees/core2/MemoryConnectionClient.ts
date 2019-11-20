import { ConnectionClient } from './ConnectionClient';
import { Observable, Subject, never, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

export class MemoryConnectionClient implements ConnectionClient {
    private _connectionState: BehaviorSubject<boolean>;

    get connectionState(): Observable<boolean> {
        return this._connectionState.pipe(distinctUntilChanged());
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
        this._connectionState.next(false);
    }

    connect(): void {
        this._connectionState.next(true);
    }

    constructor() {
        this.sentMessages = [];
        this._connectionState = new BehaviorSubject<boolean>(false);
    }
}
