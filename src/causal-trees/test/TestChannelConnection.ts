import { Observable, Subject } from 'rxjs';
import { RealtimeChannelConnection } from '../core/RealtimeChannelConnection';
import { ConnectionEvent } from '../core/ConnectionEvent';

export interface TestChannelRequest {
    name: string;
    data: any;
    resolve: (response: any) => void;
    reject: (err: any) => void;
}

export class TestChannelConnection implements RealtimeChannelConnection {
    private _connectionStateChanged: Subject<boolean>;
    knownEventNames: string[];
    events: Subject<ConnectionEvent>;
    emitted: ConnectionEvent[];
    requests: TestChannelRequest[];
    flush: boolean;
    resolve: (name: string, data: any) => any;

    _connected: boolean;
    closed: boolean;

    constructor() {
        this._connectionStateChanged = new Subject<boolean>();
        this.events = new Subject<ConnectionEvent>();
        this.emitted = [];
        this.requests = [];
        this._connected = false;
        this.closed = false;
        this.flush = false;
        this.resolve = null;
    }

    get connected() {
        return this._connected;
    }

    setConnected(value: boolean) {
        if (value !== this.connected) {
            this._connected = value;
            this._connectionStateChanged.next(this._connected);
        }
    }

    init(knownEventNames: string[]): void {
        this.knownEventNames = knownEventNames;
    }

    isConnected(): boolean {
        return this._connected;
    }

    emit(event: ConnectionEvent): void {
        this.emitted.push(event);
    }

    request<TResponse>(name: string, data: any): Promise<TResponse> {
        return new Promise((resolve, reject) => {
            if (this.resolve) {
                this.flush = true;
                resolve(this.resolve(name, data));
            } else {
                this.requests.push({
                    name,
                    data,
                    resolve,
                    reject,
                });
            }
        });
    }

    get connectionStateChanged() {
        return this._connectionStateChanged;
    }

    unsubscribe(): void {
        this.closed = true;
    }

    async flushPromise() {
        this.flush = false;
        await Promise.resolve();
    }

    async flushPromises() {
        // Resolve all the pending promises
        while (this.flush) {
            await this.flushPromise();
        }

        for (let i = 0; i < 5; i++) {
            await this.flushPromise();
        }
    }
}
