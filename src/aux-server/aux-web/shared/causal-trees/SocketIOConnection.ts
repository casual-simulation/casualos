import { RealtimeChannelConnection } from '@casual-simulation/causal-trees';
import { ConnectionEvent } from '@casual-simulation/causal-trees';
import {
    Observable,
    merge,
    Subject,
    BehaviorSubject,
    SubscriptionLike,
} from 'rxjs';
import { socketEvent } from '../socket-io/Utils';
import { map, shareReplay } from 'rxjs/operators';

/**
 * Defines a RealtimeChannelConnection that can use Socket.IO.
 */
export class SocketIOConnection implements RealtimeChannelConnection {
    private _socket: typeof io.Socket;
    private _events: Subject<ConnectionEvent>;
    private _knownEvents: string[];
    private _connected: BehaviorSubject<boolean>;
    private _sub: SubscriptionLike;

    /**
     * Creates a new RealtimeChannelConnection for Socket.IO.
     * @param socket The Socket.IO instance.
     */
    constructor(socket: typeof io.Socket) {
        this.closed = false;
        this._socket = socket;
        this._events = new Subject<ConnectionEvent>();
        this._connected = new BehaviorSubject<boolean>(socket.connected);

        const connected = socketEvent<void>(this._socket, 'connect').pipe(
            map(() => true)
        );
        const disconnected = socketEvent<void>(this._socket, 'disconnect').pipe(
            map(() => false)
        );

        this._sub = merge(connected, disconnected).subscribe(this._connected);
    }

    init(knownEventNames: string[]): void {
        this._knownEvents = knownEventNames;
        this._knownEvents.forEach(name => {
            this._socket.on(name, (data: any) => {
                setTimeout(() => {
                    this._events.next({
                        name,
                        data,
                    });
                }, 0);
            });
        });
    }

    isConnected(): boolean {
        return this._connected.value;
    }

    get events(): Observable<ConnectionEvent> {
        return this._events;
    }

    emit(event: ConnectionEvent): void {
        this._socket.emit(event.name, event.data);
    }

    request<T>(name: string, data: any): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this._socket.emit(name, data, (response: T) => {
                resolve(response);
            });
        });
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._connected;
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._sub.unsubscribe();
            this._knownEvents.forEach(name => {
                this._socket.off(name);
            });
        }
    }

    closed: boolean;
}
