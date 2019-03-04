import { Socket, Server } from 'socket.io';
import { CausalTreeStore, CausalTreeFactory, CausalTree, AtomOp, RealtimeChannelInfo, storedTree, site, SiteVersionInfo, SiteInfo, ExchangeWeavesResponse, ExchangeWeavesRequest, WeaveReference } from '@yeti-cgi/aux-common/causal-trees';
import { AuxOp } from '@yeti-cgi/aux-common/aux-format';
import { find } from 'lodash';

/**
 * Defines a class that is able to serve a set causal trees over Socket.io.
 * 
 */
export class CausalTreeServer {

    private _server: Server;
    private _treeStore: CausalTreeStore;
    private _factory: CausalTreeFactory;
    private _treeList: TreeMap;

    /**
     * Creates a new causal tree factory that uses the given socket server, tree store, and tree factory.
     * @param socketServer The Socket.IO server that should be used.
     * @param treeStore The Causal Tree store that should be used.
     * @param causalTreeFactory The Causal Tree factory that should be used.
     */
    constructor(socketServer: Server, treeStore: CausalTreeStore, causalTreeFactory: CausalTreeFactory) {
        this._server = socketServer;
        this._treeStore = treeStore;
        this._factory = causalTreeFactory;
        this._treeList = {};

        this._init();
    }

    private _init() {
        this._server.on('connection', socket => {

            // V2 channels
            socket.on('join_channel', (info: RealtimeChannelInfo, callback: Function) => {
                socket.join(info.id, async err => {
                    if (err) {
                        console.log(err);
                        callback(err);
                        return;
                    }

                    const tree = await this._getTree(info);

                    // TODO: Dispose of timeout when all players leave the channel
                    const timeout = setTimeout(async () => {
                        await this._treeStore.update(info.id, tree.export());
                    }, 1000);

                    const eventName = `event_${info.id}`;
                    socket.on(eventName, async (event: WeaveReference<AtomOp>) => {
                        tree.add(event.atom);
                        socket.to(info.id).emit(eventName, event);
                    });

                    socket.on(`info_${info.id}`, async (event: SiteVersionInfo, callback: (resp: SiteVersionInfo) => void) => {
                        // import the known sites
                        if (event.knownSites) {
                            event.knownSites.forEach(ks => {
                                tree.registerSite(ks);
                            });

                            await this._treeStore.update(info.id, tree.export());
                        }

                        const currentVersionInfo: SiteVersionInfo = {
                            site: tree.site,
                            version: tree.weave.getVersion(),
                            knownSites: tree.knownSites
                        };

                        callback(currentVersionInfo);
                    });

                    socket.on(`siteId_${info.id}`, (site: SiteInfo, callback: Function) => {
                         const knownSite = find(tree.knownSites, ks => ks.id === site.id);
                         if (knownSite) {
                             callback(false);
                         } else {
                            tree.registerSite(site);
                            callback(true);
                         }
                    });

                    socket.on(`weave_${info.id}`, (event: ExchangeWeavesRequest<AtomOp>, callback: (resp: ExchangeWeavesResponse<AtomOp>) => void) => {

                        if (event.weave) {
                            tree.importWeave(event.weave);
                        }

                        // TODO: If a version is provided then we should
                        // return only the atoms that are needed to sync.
                        callback(tree.weave.atoms);
                    });

                    socket.on('disconnect', () => {
                        // TODO: Implement events for disconnecting
                    });

                    callback(null);
                });
            });

            socket.on('disconnect', () => {
                // TODO:
            });
        });
    }

    private async _getTree(info: RealtimeChannelInfo): Promise<CausalTree<AtomOp, any>> {
        let tree = this._treeList[info.id];
        if (!tree) {
            const stored = await this._treeStore.get<AtomOp>(info.id);
            if (stored) {
                tree = this._factory.create(info.type, stored);
            } else {
                tree = this._factory.create(info.type, storedTree(site(1)));
                tree.root();
            }
            this._treeList[info.id] = tree;
        }

        return tree;
    }

}

/**
 * Defines a list of causal trees mapped by their channel IDs.
 */
export interface TreeMap {
    [key: string]: CausalTree<AtomOp, any>;
}