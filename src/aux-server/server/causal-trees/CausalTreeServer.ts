import { Socket, Server } from 'socket.io';
import {
    CausalTreeStore,
    CausalTreeFactory,
    CausalTree,
    AtomOp,
    RealtimeChannelInfo,
    storedTree,
    site,
    SiteVersionInfo,
    SiteInfo,
    Atom,
    StoredCausalTree,
    currentFormatVersion,
    atomIdToString,
    atomId,
    upgrade,
} from '@casual-simulation/causal-trees';
import { find } from 'lodash';
import { bufferTime, flatMap, filter, concatMap, tap } from 'rxjs/operators';
import {
    PrivateCryptoKey,
    PublicCryptoKey,
    SigningCryptoImpl,
} from '@casual-simulation/crypto';
import { NodeSigningCryptoImpl } from '../crypto/NodeSigningCryptoImpl';
import { AtomValidator } from '@casual-simulation/causal-trees';
import { SubscriptionLike } from 'rxjs';

/**
 * Defines a class that is able to serve a set causal trees over Socket.io.
 *
 */
export class CausalTreeServer {
    private _server: Server;
    private _treeStore: CausalTreeStore;
    private _factory: CausalTreeFactory;
    private _treeList: TreeMap;
    private _treePromises: TreePromises;
    private _crypto: SigningCryptoImpl;
    private _cleanupTimeout: number;

    /**
     * Creates a new causal tree factory that uses the given socket server, tree store, and tree factory.
     * @param socketServer The Socket.IO server that should be used.
     * @param treeStore The Causal Tree store that should be used.
     * @param causalTreeFactory The Causal Tree factory that should be used.
     */
    constructor(
        socketServer: Server,
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory
    ) {
        this._server = socketServer;
        this._treeStore = treeStore;
        this._factory = causalTreeFactory;
        this._treeList = {};
        this._treePromises = {};
        this._cleanupTimeout = 10_000;
        this._crypto = new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256');

        this._init();
    }

    private _init() {
        this._server.on('connection', socket => {
            // V2 channels
            socket.on(
                'join_channel',
                (info: RealtimeChannelInfo, callback: Function) => {
                    socket.join(info.id, async err => {
                        if (err) {
                            console.log(err);
                            callback(err);
                            return;
                        }

                        const data = await this._getTree(info);
                        data.users.set(socket.id, socket);
                        console.log(
                            `[CausalTreeServer] User joined ${info.id}. ${
                                data.users.size
                            } remaining.`
                        );
                        if (data.timeoutId) {
                            console.log(
                                `[CausalTreeServer] Clearing timeout for cleanup on ${
                                    info.id
                                }...`
                            );
                            clearTimeout(data.timeoutId);
                            data.timeoutId = null;
                        }
                        const tree = data.tree;
                        const eventName = `event_${info.id}`;
                        socket.on(eventName, async (refs: Atom<AtomOp>[]) => {
                            const { added, rejected } = await tree.addMany(
                                refs,
                                true
                            );
                            if (rejected.length > 0) {
                                console.warn(
                                    `[CausalTreeServer] ${info.id} Rejected ${
                                        rejected.length
                                    } atoms:`
                                );
                                rejected.forEach(r => {
                                    console.warn(
                                        `[CausalTreeServer] ${atomIdToString(
                                            r.atom.id
                                        )}: ${r.reason}`
                                    );
                                });
                            }
                            socket.to(info.id).emit(eventName, added);
                        });

                        socket.on(
                            `info_${info.id}`,
                            async (
                                event: SiteVersionInfo,
                                callback: (resp: SiteVersionInfo) => void
                            ) => {
                                console.log(
                                    '[CausalTreeServer] Getting info for tree:',
                                    info.id
                                );

                                // import the known sites
                                if (event.knownSites) {
                                    console.log(
                                        '[CausalTreeServer] Updating known sites...'
                                    );
                                    event.knownSites.forEach(ks => {
                                        tree.registerSite(ks);
                                    });

                                    await this._treeStore.put(
                                        info.id,
                                        tree.export(),
                                        false
                                    );
                                }

                                console.log(
                                    '[CausalTreeServer] Sending current site info...'
                                );
                                const currentVersionInfo: SiteVersionInfo = {
                                    site: tree.site,
                                    version: tree.weave.getVersion(),
                                    knownSites: tree.knownSites,
                                };

                                callback(currentVersionInfo);
                                console.log(
                                    `[CausalTreeServer] Sent version ${
                                        currentVersionInfo.version.hash
                                    }`
                                );
                            }
                        );

                        socket.on(
                            `siteId_${info.id}`,
                            (site: SiteInfo, callback: Function) => {
                                console.log(
                                    `[CausalTreeServer] Checking site ID (${
                                        site.id
                                    }) for tree (${info.id})`
                                );

                                const knownSite = find(
                                    tree.knownSites,
                                    ks => ks.id === site.id
                                );
                                if (knownSite) {
                                    console.log(
                                        '[CausalTreeServer] Site ID Already Reserved.'
                                    );
                                    callback(false);
                                } else {
                                    console.log(
                                        '[CausalTreeServer] Site ID Granted.'
                                    );
                                    tree.registerSite(site);
                                    socket
                                        .to(info.id)
                                        .emit(`site_${info.id}`, site);
                                    callback(true);
                                }
                            }
                        );

                        socket.on(
                            `weave_${info.id}`,
                            async (
                                event: StoredCausalTree<AtomOp>,
                                callback: (
                                    resp: StoredCausalTree<AtomOp>
                                ) => void
                            ) => {
                                try {
                                    console.log(
                                        `[CausalTreeServer] Exchanging Weaves for tree (${
                                            info.id
                                        }).`
                                    );
                                    const {
                                        added: imported,
                                        rejected,
                                    } = await tree.import(event);
                                    console.log(
                                        `[CausalTreeServer] Imported ${
                                            imported.length
                                        } atoms.`
                                    );

                                    if (rejected.length > 0) {
                                        console.warn(
                                            `[CausalTreeServer] Rejected ${
                                                rejected.length
                                            } atoms:`
                                        );
                                        rejected.forEach(r => {
                                            console.warn(
                                                `[CausalTreeServer] ${atomIdToString(
                                                    r.atom.id
                                                )}: ${r.reason}`
                                            );
                                        });
                                    }
                                    this._treeStore.add(info.id, imported);
                                } catch (e) {
                                    console.log(
                                        '[CausalTreeServer] Could not import atoms from remote.',
                                        e
                                    );
                                }

                                // TODO: If a version is provided then we should
                                // return only the atoms that are needed to sync.
                                const exported = tree.export();

                                console.log(
                                    `[CausalTreeServer] Sending ${
                                        exported.weave.length
                                    } atoms.`
                                );
                                callback(exported);
                            }
                        );

                        socket.on(`leave_${info.id}`, () => {
                            socket.leave(info.id);
                            this._trackUserLeft(data, info, socket);
                        });

                        socket.on('disconnect', () => {
                            this._trackUserLeft(data, info, socket);
                        });

                        callback(null);
                    });
                }
            );

            socket.on('disconnect', () => {
                // TODO:
            });
        });
    }

    private _trackUserLeft(
        data: TreeData,
        info: RealtimeChannelInfo,
        socket: Socket
    ) {
        if (!data.inactive) {
            if (data.users.delete(socket.id)) {
                console.log(
                    `[CausalTreeServer] User left ${info.id}. ${
                        data.users.size
                    } remaining.`
                );
                this._tryCleanupTreeData(data, info);
            }
        }
    }

    private _tryCleanupTreeData(data: TreeData, info: RealtimeChannelInfo) {
        if (
            data.users.size <= 0 &&
            this._treePromises[info.id] &&
            !data.inactive &&
            !data.timeoutId
        ) {
            console.log(
                `[CausalTreeServer] Starting timeout for cleanup on ${
                    info.id
                }...`
            );
            data.timeoutId = setTimeout(() => {
                console.log(
                    `[CausalTreeServer] Cleaning up ${
                        info.id
                    } because no more users are connected...`
                );
                this._treePromises[info.id] = null;
                data.inactive = true;
                data.subs.forEach(s => {
                    s.unsubscribe();
                });
            }, this._cleanupTimeout);
        }
    }

    private async _getTree(info: RealtimeChannelInfo): Promise<TreeData> {
        let tree = this._treeList[info.id];
        if (!tree) {
            let promise = this._treePromises[info.id];
            if (!promise) {
                promise = this._getTreePromise(info);
                this._treePromises[info.id] = promise;
            }

            return await promise;
        }

        return tree;
    }

    private async _getTreePromise(
        info: RealtimeChannelInfo
    ): Promise<TreeData> {
        let tree: CausalTree<AtomOp, any, any>;
        console.log(
            `[CausalTreeServer] Getting tree (${info.id}) from database...`
        );
        const stored = await this._treeStore.get<AtomOp>(info.id, false);
        if (stored && stored.weave.length > 0) {
            tree = await this._createFromExisting(info, stored);
        } else {
            if (stored) {
                console.log(
                    `[CausalTreeServer] Found tree information but it didn't contain any atoms...`
                );
            }
            tree = await this._createNewTree(info);
        }

        let subs = this._registerSubs(info, tree);

        let data = { tree, subs, users: new Map() };
        this._treeList[info.id] = data;
        console.log(`[CausalTreeServer] Done.`);
        return data;
    }

    private async _createFromExisting(
        info: RealtimeChannelInfo,
        stored: StoredCausalTree<AtomOp>
    ) {
        console.log(
            `[CausalTreeServer] Building from stored tree (version ${
                stored.formatVersion
            })...`
        );

        try {
            // Dont generate keys for existing trees because
            // that would suddenly cause atoms created by the server to
            // be rejected by the remotes.
            const tree = await this._createTree(info.id, info.type, false);

            const sub = tree.atomsArchived
                .pipe(
                    flatMap(async refs => {
                        console.log(
                            `[CausalTreeServer] Archiving ${
                                refs.length
                            } atoms...`
                        );
                        const atoms = refs.map(r => r);
                        await this._treeStore.add(info.id, atoms, true);
                    })
                )
                .subscribe(null, err => console.error(err));

            const { added: loaded } = await tree.import(stored);
            sub.unsubscribe();
            console.log(`[CausalTreeServer] ${loaded.length} atoms loaded.`);

            if (stored.formatVersion < currentFormatVersion) {
                // Update the stored data but don't delete archived atoms
                console.log(
                    `[CausalTreeServer] Updating stored atoms from ${
                        stored.formatVersion
                    } to ${currentFormatVersion}...`
                );
                const exported = tree.export();
                await this._treeStore.put(info.id, exported, false);

                const upgraded = upgrade(exported);
                await this._treeStore.add(info.id, upgraded.weave, false);
            }

            return tree;
        } catch (ex) {
            // TODO: Improve to be able to issue an error to the client
            // saying that the data became corrupted somehow.
            console.warn('[CausalTreeServer] Unable to load tree', info.id, ex);
            return await this._createNewTree(info);
        }
    }

    private async _createNewTree(info: RealtimeChannelInfo) {
        console.log(`[CausalTreeServer] Creating new...`);
        const tree = await this._createTree(info.id, info.type, true);
        if (!info.bare) {
            await tree.root();
            console.log(`[CausalTreeServer] Storing initial tree version...`);
            await this._treeStore.put(info.id, tree.export(), true);
        } else {
            console.log(
                `[CausalTreeServer] Skipping root node because a bare tree was requested.`
            );
        }
        return tree;
    }

    private _registerSubs(
        info: RealtimeChannelInfo,
        tree: CausalTree<AtomOp, any, any>
    ): SubscriptionLike[] {
        let subs: SubscriptionLike[] = [];
        subs.push(
            tree.atomsArchived
                .pipe(
                    bufferTime(1000),
                    filter(batch => batch.length > 0),
                    flatMap(batch => batch),
                    concatMap(async refs => {
                        const atoms = refs.map(r => r);
                        await this._treeStore.add(info.id, atoms, true);
                    })
                )
                .subscribe(null, err => console.error(err))
        );

        subs.push(
            tree.atomAdded
                .pipe(
                    bufferTime(1000),
                    filter(batch => batch.length > 0),
                    flatMap(batch => batch),
                    concatMap(async refs => {
                        const atoms = refs.map(r => r);
                        await this._treeStore.add(info.id, atoms, false);
                        let stored = tree.export();
                        stored.weave = [];
                        await this._treeStore.put(info.id, stored, false);
                    })
                )
                .subscribe(null, err => console.error(err))
        );

        subs.push(
            tree.atomRejected
                .pipe(
                    bufferTime(1000),
                    filter(batch => batch.length > 0),
                    flatMap(batch => batch),
                    flatMap(batch => batch),
                    tap(ref => {
                        console.warn(
                            `[CausalTreeSever] ${
                                info.id
                            }: Atom (${atomIdToString(
                                ref.atom.id
                            )}) rejected: ${ref.reason}`
                        );
                    })
                )
                .subscribe(null, err => console.error(err))
        );

        return subs;
    }

    private async _createTree(id: string, type: string, generateKeys: boolean) {
        let keys = await this._treeStore.getKeys(id);
        let signingKey: PrivateCryptoKey = null;
        let treeWithCrypto: StoredCausalTree<AtomOp>;
        if (keys && this._crypto.supported()) {
            // Use the existing keys because we've already created them.
            console.log('[CausalTreeServer] Using existing keys...');

            treeWithCrypto = storedTree(
                site(1, {
                    // TODO: Allow storing the crypto algorithm with the keys
                    signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                    publicKey: keys.publicKey,
                })
            );
            signingKey = await this._crypto.importPrivateKey(keys.privateKey);
            console.log('[CausalTreeServer] Keys imported.');
        } else if (generateKeys && this._crypto.supported()) {
            // Create new keys because we haven't stored any under this ID
            console.log('[CausalTreeServer] Creating new keys...');
            let [pubKey, privKey] = await this._crypto.generateKeyPair();
            signingKey = privKey;

            let publicKey = await this._crypto.exportKey(pubKey);
            let privateKey = await this._crypto.exportKey(privKey);
            await this._treeStore.putKeys(id, privateKey, publicKey);
            treeWithCrypto = storedTree(
                site(1, {
                    // TODO: Allow storing the crypto algorithm with the keys
                    signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                    publicKey: publicKey,
                })
            );
            console.log('[CausalTreeServer] Keys created.');
        } else {
            console.log('[CausalTreeServer] Not generating keys.');
            treeWithCrypto = storedTree(site(1));
        }
        let validator = new AtomValidator(this._crypto);

        return this._factory.create(type, treeWithCrypto, {
            garbageCollect: true,
            validator: validator,
            signingKey: signingKey,
        });
    }
}

/**
 * Defines a list of causal trees mapped by their channel IDs.
 */
export interface TreeMap {
    [key: string]: TreeData;
}

export interface TreePromises {
    [key: string]: Promise<TreeData>;
}

export interface TreeData {
    tree: CausalTree<AtomOp, any, any>;
    subs: SubscriptionLike[];
    users: Map<string, Socket>;
    timeoutId?: any;
    inactive?: boolean;
}
