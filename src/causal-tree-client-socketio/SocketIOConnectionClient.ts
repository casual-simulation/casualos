import { ConnectionClient } from './ConnectionClient';
import io from 'socket.io-client';
import { Observable, fromEventPattern } from 'rxjs';

export class SocketIOConnectionClient implements ConnectionClient {
    private _socket: SocketIOClient.Socket;
    private _connectionStateChanged: Observable<boolean>;

    event<T>(name: string): Observable<T> {
        return fromEventPattern<T>(
            h => this._socket.on(name, h),
            h => this._socket.off(name, h)
        );
    }

    disconnect() {
        this._socket.disconnect();
    }

    send(name: string, data: any) {
        this._socket.emit(name, data);
    }

    constructor(
        socket: SocketIOClient.Socket,
        connectionStateChanged: Observable<boolean>
    ) {
        this._socket = socket;
        this._connectionStateChanged = connectionStateChanged;
    }

    get connectionState(): Observable<boolean> {
        return this._connectionStateChanged;
    }
}
