import { Server } from 'socket.io';
import { ChannelInfo, Event, ChannelClient, ChannelConnection } from '../../common/channels-core';

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
            console.log('A user connected!');

            socket.on('join_server', (info: ChannelInfo, callback: Function) => {
                console.log('Joining server ' + info.id);
                socket.join(info.id, (err) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    this._client.getChannel(info).subscribe().then(connection => {
                        if (!this._serverList[info.id]) {
                            this._serverList[info.id] = connection;
                        }
                        const eventName = `new_event_${info.id}`;
    
                        const listener = (event: Event) => {
                            console.log('Emitting event: ', event.type);
                            connection.emit(event);
                            socket.to(info.id).emit(eventName, event);
                        };
                        socket.on(eventName, listener);
                        socket.on('leave_server', (id: string, callback: Function) => {
                            if (id === info.id) {
                                connection.unsubscribe();
                                socket.off(eventName, listener);
                            }
                            callback(null);
                        });
    
                        callback(null, connection.info, connection.store.state());
                    }, err => {
                        callback(err);
                    });
                    
                    
                });
            });
        });
    }

}