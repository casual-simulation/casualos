import { ConnectionClient } from './ConnectionClient';
import io from 'socket.io-client';
import { Observable, fromEventPattern } from 'rxjs';

export class SocketIOConnectionClient implements ConnectionClient {
    private _socket: SocketIOClient.Socket;

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

    constructor(socket: SocketIOClient.Socket) {
        this._socket = socket;
    }
}
