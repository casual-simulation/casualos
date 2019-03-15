import { Socket, Server } from 'socket.io';
import { 
    ChannelInfo, 
    Event, 
    ChannelClient, 
    ChannelConnection, 
    AuxOp
} from '@yeti-cgi/aux-common';

export interface ServerList {
    [key: string]: ChannelConnection<any>;
}

/**
 * Defines a class which acts as a server for SocketIO channels such that 
 * any ChannelClient (whether running on the server or on a client) which uses a SocketIOChannelConnector
 * is able to connect to channels.
 */
export class SocketIOChannelServer {

    private _server: Server;
    private _client: ChannelClient;
    private _serverList: ServerList;

    constructor(server: Server, client: ChannelClient) {
        this._serverList = {};
        this._client = client;
        this._server = server;
        
        this._server.on('connection', socket => {

            // V1 channels
            socket.on('join_server', (info: ChannelInfo, callback: Function) => {
                console.log('[SocketIOChannelServer] Joining user to server', info.id);
                socket.join(info.id, async (err) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    
                    try {
                        const connection = await this._getConnection(info, socket);
                        callback(null, connection.info, connection.store.state());
                    } catch(err) {
                        callback(err);
                    }
                });
            });

            socket.on('disconnect', () => {
            });
        });
    }

    private async _getConnection(info: ChannelInfo, socket: SocketIO.Socket) {
        let connection = this._serverList[info.id];
        if (!connection) {
            connection = await this._client.getChannel(info).subscribe();
        }
        if (!this._serverList[info.id]) {
            this._serverList[info.id] = connection;
        }
        const eventName = `new_event_${info.id}`;

        const listener = (event: Event, cb: Function) => {
            connection.emit(event);
            socket.to(info.id).emit(eventName, event);
            if (cb && typeof cb === 'function') {
                cb();
            }
        };
        socket.on(eventName, listener);
        socket.on('leave_server', (id: string, callback: Function) => {
            if (id === info.id) {
                connection.unsubscribe();
                socket.off(eventName, listener);
            }
            callback(null);
        });
        return connection;
    }

}