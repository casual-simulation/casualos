import { ConnectionClient } from './ConnectionClient';
import io from 'socket.io-client';
import { Observable, fromEventPattern, BehaviorSubject } from 'rxjs';

export class SocketIOConnectionClient implements ConnectionClient {
    private _socket: SocketIOClient.Socket;
    private _connectionStateChanged: BehaviorSubject<boolean>;

    event<T>(name: string): Observable<T> {
        return fromEventPattern<T>(
            h => this._socket.on(name, h),
            h => this._socket.off(name, h)
        );
    }

    disconnect() {
        this._socket.disconnect();
    }

    connect() {
        this._socket.connect();
    }

    send(name: string, data: any) {
        this._socket.emit(name, data);
    }

    constructor(socket: SocketIOClient.Socket) {
        this._socket = socket;
        this._connectionStateChanged = new BehaviorSubject(false);

        this._socket.on('connect', () => {
            console.log('[SocketManager] Connected.');
            this._connectionStateChanged.next(true);
        });

        this._socket.on('disconnect', (reason: any) => {
            console.log('[SocketManger] Disconnected. Reason:', reason);
            this._connectionStateChanged.next(false);
        });
    }

    get connectionState(): Observable<boolean> {
        return this._connectionStateChanged;
    }
}
