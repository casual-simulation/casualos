import { Socket, Server } from 'socket.io';
import { CausalTreeStore, CausalTreeFactory, CausalTree, AtomOp, RealtimeChannelInfo, storedTree, site, SiteVersionInfo, SiteInfo, Atom, StoredCausalTree, currentFormatVersion } from '@yeti-cgi/aux-common/causal-trees';
import { AuxOp } from '@yeti-cgi/aux-common/aux-format';
import { find } from 'lodash';
import { bufferTime, flatMap, filter } from 'rxjs/operators';
import { ExecSyncOptionsWithStringEncoding } from 'child_process';

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
                    

                    const sub = tree.atomAdded.pipe(
                        bufferTime(1000),
                        filter(batch => batch.length > 0),
                        flatMap(batch => batch),
                        flatMap(async refs => {
                            const atoms = refs.map(r => r);
                            await this._treeStore.add(info.id, atoms);
                            await this._treeStore.put(info.id, tree.export(), false);
                        })
                    ).subscribe(null, err => console.error(err));

                    const eventName = `event_${info.id}`;
                    socket.on(eventName, async (refs: Atom<AtomOp>[]) => {
                        const added = tree.addMany(refs);
                        socket.to(info.id).emit(eventName, added);
                    });

                    socket.on(`info_${info.id}`, async (event: SiteVersionInfo, callback: (resp: SiteVersionInfo) => void) => {

                        console.log('[CausalTreeServer] Getting info for tree:', info.id);

                        // import the known sites
                        if (event.knownSites) {
                            console.log('[CausalTreeServer] Updating known sites...');
                            event.knownSites.forEach(ks => {
                                tree.registerSite(ks);
                            });

                            await this._treeStore.put(info.id, tree.export(), false);
                        }

                        console.log('[CausalTreeServer] Sending current site info...');
                        const currentVersionInfo: SiteVersionInfo = {
                            site: tree.site,
                            version: tree.weave.getVersion(),
                            knownSites: tree.knownSites
                        };

                        callback(currentVersionInfo);
                        console.log(`[CausalTreeServer] Sent version ${currentVersionInfo.version.hash}`);
                    });

                    socket.on(`siteId_${info.id}`, (site: SiteInfo, callback: Function) => {
                        console.log(`[CausalTreeServer] Checking site ID (${site.id}) for tree (${info.id})`);

                         const knownSite = find(tree.knownSites, ks => ks.id === site.id);
                         if (knownSite) {
                            console.log('[CausalTreeServer] Site ID Already Reserved.');
                             callback(false);
                         } else {
                            console.log('[CausalTreeServer] Site ID Granted.');
                            tree.registerSite(site);
                            callback(true);
                         }
                    });

                    socket.on(`weave_${info.id}`, (event: StoredCausalTree<AtomOp>, callback: (resp: StoredCausalTree<AtomOp>) => void) => {
                        console.log(`[CausalTreeServer] Exchanging Weaves for tree (${info.id}).`);
                        const imported = tree.import(event);
                        console.log(`[CausalTreeServer] Imported ${imported.length} atoms.`);

                        this._treeStore.add(info.id, imported);

                        // TODO: If a version is provided then we should
                        // return only the atoms that are needed to sync.
                        const exported = tree.export();

                        console.log(`[CausalTreeServer] Sending ${exported.weave.length} atoms.`);
                        callback(exported);
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

    private async _getTree(info: RealtimeChannelInfo): Promise<CausalTree<AtomOp, any, any>> {
        let tree = this._treeList[info.id];
        if (!tree) {
            console.log(`[CausalTreeServer] Getting tree (${info.id}) from database...`);
            const stored = await this._treeStore.get<AtomOp>(info.id);
            if (stored) {
                console.log(`[CausalTreeServer] Building from stored tree (version ${stored.formatVersion})...`);
                tree = this._factory.create(info.type, stored);
                console.log(`[CausalTreeServer] ${tree.weave.atoms.length} atoms loaded.`);
            } else {
                console.log(`[CausalTreeServer] Creating new...`);
                tree = this._factory.create(info.type, storedTree(site(1)));
                if (!info.bare) {
                    tree.root();
                    console.log(`[CausalTreeServer] Storing initial tree version...`);
                    await this._treeStore.put(info.id, tree.export(), true);
                } else {
                    console.log(`[CausalTreeServer] Skipping root node because a bare tree was requested.`);
                }
            }
            
            if (stored.formatVersion < currentFormatVersion) {
                // Update the stored data
                console.log(`[CausalTreeServer] Updating stored atoms from ${stored.formatVersion} to ${currentFormatVersion}...`);
                await this._treeStore.put(info.id, tree.export(), true);
            }

            // TODO: Implement the ability to keep old atoms around while
            //       preserving performance provided by garbage collection.
            tree.garbageCollect = true;
            this._treeList[info.id] = tree;
            console.log(`[CausalTreeServer] Done.`);
        }

        return tree;
    }

}

/**
 * Defines a list of causal trees mapped by their channel IDs.
 */
export interface TreeMap {
    [key: string]: CausalTree<AtomOp, any, any>;
}