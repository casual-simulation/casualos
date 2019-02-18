import { Socket, Server } from 'socket.io';
import { ChannelInfo, Event, ChannelClient, ChannelConnection } from '../../common/channels-core';
import { RealtimeChannel } from 'common/channels-core/RealtimeChannel';
import { SocketIOChannelConnection } from './SocketIOChannelConnection';
import { RealtimeChannelServer } from './RealtimeChannelServer';
import { AuxCausalTree } from 'common/aux-format/AuxCausalTree';
import { RealtimeChannelInfo } from 'common/channels-core/RealtimeChannelInfo';

export interface ServerList {
    [key: string]: ChannelConnection<any>;
}

export interface ChannelList {
    [key: string]: AuxCausalTree;
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
    private _channelList: ChannelList;
    private _userCount: number;

    constructor(server: Server, client: ChannelClient) {
        this._serverList = {};
        this._channelList = {};
        this._client = client;
        this._server = server;
        this._userCount = 0;
        
        this._server.on('connection', socket => {
            this._userCount += 1;
            console.log('[SocketIOChannelServer] A user connected! There are now', this._userCount, 'users connected.');

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

            // V2 channels
            socket.on('join_channel', (info: ChannelInfo, callback: Function) => {
                socket.join(info.id, err => {
                    if (err) {
                        console.log(err);
                        callback(err);
                        return;
                    }

                    const tree = this._getTree(info);

                    const eventName = `event_${info.id}`;
                    socket.on(eventName, (event) => {
                        tree.add(event);
                        socket.to(info.id).emit(eventName, event);
                    });

                    socket.on(`info_${info.id}`, (event, callback) => {

                    });

                    socket.on('disconnect', () => {
                        // TODO: Implement events for 
                    });

                    callback(null);
                });
            });

            socket.on('disconnect', () => {
                this._userCount -= 1;
                console.log('[SocketIOChannelServer] A user disconnected! There are now', this._userCount, 'users connected.');
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

    private _getTree(info: RealtimeChannelInfo): AuxCausalTree {
        let tree = this._channelList[info.id];
        if (!tree) {
            tree = new AuxCausalTree(1);
            this._channelList[info.id] = tree;
        }

        return tree;
    }

}