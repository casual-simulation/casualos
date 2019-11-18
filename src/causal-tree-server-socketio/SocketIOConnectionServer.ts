import {
    ConnectionServer,
    Connection,
} from '@casual-simulation/causal-tree-server';
import { Observable, fromEventPattern } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { map, shareReplay } from 'rxjs/operators';

export class SocketIOConnectionServer implements ConnectionServer {
    private _connection: Observable<Connection>;

    get connection(): Observable<Connection> {
        return this._connection;
    }

    constructor(socketServer: Server) {
        const onConnection = fromEventPattern<Socket>(h =>
            socketServer.on('connection', h)
        );
        const connections = onConnection.pipe(
            map(s => new SocketIOConnection(s)),
            shareReplay()
        );
        this._connection = connections;
    }
}

export class SocketIOConnection implements Connection {
    private _socket: Socket;

    get id(): string {
        return this._socket.id;
    }

    get disconnect() {
        return this._socketEvent('disconnect');
    }

    event<T>(name: string) {
        return this._socketEvent<T>(name);
    }

    send(name: string, data: any) {
        this._socket.emit(name, data);
    }

    constructor(socket: Socket) {
        this._socket = socket;
    }

    private _socketEvent<T>(name: string) {
        return fromEventPattern<T>(
            h => this._socket.on(name, h),
            h => this._socket.off(name, h)
        );
    }
}
