import { Socket, Server } from 'socket.io';
import { 
    ChannelInfo, 
    Event, 
    ChannelClient, 
    ChannelConnection, 
    AuxOp
} from '@yeti-cgi/aux-common';
import { AuxCausalTree } from '@yeti-cgi/aux-common/aux-format/AuxCausalTree';
import { RealtimeChannelInfo } from '@yeti-cgi/aux-common/channels-core/RealtimeChannelInfo';
import { SiteVersionInfo } from '@yeti-cgi/aux-common/channels-core/SiteVersionInfo';
import { CausalTreeFactory } from '@yeti-cgi/aux-common/channels-core/CausalTreeFactory';
import { CausalTree } from '@yeti-cgi/aux-common/channels-core/CausalTree';
import { AtomOp } from '@yeti-cgi/aux-common/channels-core/Atom';
import { CausalTreeStore } from '@yeti-cgi/aux-common/channels-core/CausalTreeStore';
import { site } from '@yeti-cgi/aux-common/channels-core/SiteIdInfo';
import { storedTree } from '@yeti-cgi/aux-common/channels-core/StoredCausalTree';

export interface ServerList {
    [key: string]: ChannelConnection<any>;
}

export interface ChannelList {
    [key: string]: CausalTree<AtomOp, any>;
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
    private _treeStore: CausalTreeStore;
    private _causalTreeFactory: CausalTreeFactory;
    private _userCount: number;

    constructor(server: Server, client: ChannelClient, treeStore: CausalTreeStore, causalTreeFactory: CausalTreeFactory) {
        this._serverList = {};
        this._channelList = {};
        this._client = client;
        this._server = server;
        this._treeStore = treeStore;
        this._causalTreeFactory = causalTreeFactory;
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
                socket.join(info.id, async err => {
                    if (err) {
                        console.log(err);
                        callback(err);
                        return;
                    }

                    const tree = await this._getTree(info);

                    const eventName = `event_${info.id}`;
                    socket.on(eventName, async (event) => {
                        tree.add(event);
                        socket.to(info.id).emit(eventName, event);
                        await this._treeStore.update(info.id, tree.export());
                    });

                    socket.on(`info_${info.id}`, (event: SiteVersionInfo, callback: Function) => {
                        const currentVersionInfo: SiteVersionInfo = {
                            site: tree.site,
                            version: tree.weave.getVersion(),
                            knownSites: tree.knownSites
                        };

                        callback(currentVersionInfo);
                    });

                    socket.on('disconnect', () => {
                        // TODO: Implement events for disconnecting
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

    private async _getTree(info: RealtimeChannelInfo): Promise<CausalTree<AtomOp, any>> {
        let tree = this._channelList[info.id];
        if (!tree) {
            const stored = await this._treeStore.get<AuxOp>(info.id);
            tree = this._causalTreeFactory.create(info.type, stored || storedTree(site(1)));
            this._channelList[info.id] = tree;
        }

        return tree;
    }

}