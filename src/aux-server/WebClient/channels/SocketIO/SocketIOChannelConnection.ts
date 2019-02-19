import { RealtimeChannelConnection } from "aux-common/channels-core/RealtimeChannelConnection";
import { ConnectionEvent } from "aux-common/channels-core/ConnectionEvent";
import * as io from 'socket.io-client';
import { Observable, merge, Subject, BehaviorSubject, SubscriptionLike } from "rxjs";
import { socketEvent } from "./Utils";
import { map, shareReplay } from "rxjs/operators";

export class SocketIOChannelConnection implements RealtimeChannelConnection {

    private _socket: typeof io.Socket;
    private _events: Subject<ConnectionEvent>;
    private _knownEvents: string[];
    private _connected: BehaviorSubject<boolean>;
    private _sub: SubscriptionLike;

    constructor(socket: typeof io.Socket) {
        this.closed = false;
        this._socket = socket;
        this._events = new Subject<ConnectionEvent>();
        this._connected = new BehaviorSubject<boolean>(false);

        const connected = socketEvent<void>(this._socket, 'connect').pipe(map(()=> true));
        const disconnected = socketEvent<void>(this._socket, 'disconnect').pipe(map(() => false));

        this._sub = merge(connected, disconnected)
            .subscribe(this._connected);
    }

    init(knownEventNames: string[]): void {
        this._knownEvents = knownEventNames;
        this._knownEvents.forEach(name => {
            this._socket.on(name, (data: any) => {
                this._events.next({
                    name,
                    data
                });
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

