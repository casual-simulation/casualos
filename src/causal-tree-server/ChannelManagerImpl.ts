import {
    ChannelManager,
    LoadedChannel,
    ChannelLoadedListener,
} from './ChannelManager';
import {
    CausalTree,
    AtomOp,
    RealtimeChannelInfo,
    CausalTreeStore,
    CausalTreeFactory,
    StoredCausalTree,
    upgrade,
    currentFormatVersion,
    site,
    storedTree,
    AtomValidator,
} from '@casual-simulation/causal-trees';
import { SubscriptionLike, Subscription } from 'rxjs';
import { flatMap as rxFlatMap } from 'rxjs/operators';
import { SigningCryptoImpl, PrivateCryptoKey } from '@casual-simulation/crypto';

export class ChannelManagerImpl implements ChannelManager {
    private _store: CausalTreeStore;
    private _factory: CausalTreeFactory;
    private _crypto: SigningCryptoImpl;
    private _loadedTrees: Map<string, Promise<CausalTree<AtomOp, any, any>>>;
    private _treeSubscriptions: Map<string, SubscriptionLike[]>;
    private _listenerScriptions: Map<string, SubscriptionLike[]>;
    private _listeners: ChannelLoadedListener<any>[];

    constructor(
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory,
        crypto: SigningCryptoImpl
    ) {
        this._store = treeStore;
        this._factory = causalTreeFactory;
        this._crypto = crypto;
        this._loadedTrees = new Map();
        this._treeSubscriptions = new Map();
        this._listenerScriptions = new Map();
        this._listeners = [];
    }

    async loadChannel<TTree extends CausalTree<AtomOp, any, any>>(
        info: RealtimeChannelInfo
    ): Promise<LoadedChannel<TTree>> {
        let tree = await this._loadTree<TTree>(info);

        const result = {
            tree,
            subscription: this._addSubscription(info),
        };

        this._registerListeners(info, tree);

        return result;
    }

    whileCausalTreeLoaded<TTree extends CausalTree<AtomOp, any, any>>(
        listener: ChannelLoadedListener<TTree>
    ): SubscriptionLike {
        this._listeners.push(listener);
        return new Subscription(() => {
            const index = this._listeners.indexOf(listener);
            if (index >= 0) {
                this._listeners.splice(index, 1);
            }
        });
    }

    private _registerListeners(
        info: RealtimeChannelInfo,
        tree: CausalTree<AtomOp, any, any>
    ) {
        let list = this._listenerScriptions.get(info.id);
        if (!list) {
            list = [];
            this._listenerScriptions.set(info.id, list);
        }
        for (let listener of this._listeners) {
            const subs = listener(tree, info);
            list.push(...subs);
        }
    }

    private _unloadChannel(info: RealtimeChannelInfo) {
        console.log(
            `[ChannelManagerImpl] Cleaning up ${
                info.id
            } because nothing is using it anymore...`
        );
        this._loadedTrees.delete(info.id);
        let listenerSubs = this._listenerScriptions.get(info.id);
        if (listenerSubs) {
            for (let sub of listenerSubs) {
                sub.unsubscribe();
            }
            listenerSubs.length = 0;
        }
    }

    private _addSubscription(info: RealtimeChannelInfo): SubscriptionLike {
        let list = this._treeSubscriptions.get(info.id);
        if (!list) {
            list = [];
            this._treeSubscriptions.set(info.id, list);
        }
        let sub = new Subscription(() => {
            const index = list.indexOf(sub);
            if (index >= 0) {
                list.splice(index, 1);

                if (list.length === 0) {
                    this._unloadChannel(info);
                }
            }
        });
        list.push(sub);
        return sub;
    }

    private _loadTree<TTree extends CausalTree<AtomOp, any, any>>(
        info: RealtimeChannelInfo
    ): Promise<TTree> {
        let promise = <Promise<TTree>>this._loadedTrees.get(info.id);
        if (!promise) {
            promise = this._loadTreeCore<TTree>(info);
            this._loadedTrees.set(info.id, promise);
        }

        return promise;
    }

    private async _loadTreeCore<TTree extends CausalTree<AtomOp, any, any>>(
        info: RealtimeChannelInfo
    ): Promise<TTree> {
        let tree: TTree;
        console.log(
            `[ChannelManagerImpl] Getting tree (${info.id}) from database...`
        );
        const stored = await this._store.get<AtomOp>(info.id, false);
        if (stored && stored.weave.length > 0) {
            tree = <TTree>await this._createFromExisting(info, stored);
        } else {
            if (stored) {
                console.log(
                    `[ChannelManagerImpl] Found tree information but it didn't contain any atoms...`
                );
            }
            tree = <TTree>await this._createNewTree(info);
        }

        console.log(`[ChannelManagerImpl] Done.`);
        return tree;
    }

    private async _createFromExisting(
        info: RealtimeChannelInfo,
        stored: StoredCausalTree<AtomOp>
    ) {
        console.log(
            `[ChannelManagerImpl] Building from stored tree (version ${
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
                    rxFlatMap(async refs => {
                        console.log(
                            `[ChannelManagerImpl] Archiving ${
                                refs.length
                            } atoms...`
                        );
                        const atoms = refs.map(r => r);
                        await this._store.add(info.id, atoms, true);
                    })
                )
                .subscribe(null, err => console.error(err));

            const { added: loaded } = await tree.import(stored);
            sub.unsubscribe();
            console.log(`[ChannelManagerImpl] ${loaded.length} atoms loaded.`);

            if (stored.formatVersion < currentFormatVersion) {
                // Update the stored data but don't delete archived atoms
                console.log(
                    `[ChannelManagerImpl] Updating stored atoms from ${
                        stored.formatVersion
                    } to ${currentFormatVersion}...`
                );
                const exported = tree.export();
                await this._store.put(info.id, exported, false);

                const upgraded = upgrade(exported);
                await this._store.add(info.id, upgraded.weave, false);
            }

            return tree;
        } catch (ex) {
            // TODO: Improve to be able to issue an error to the client
            // saying that the data became corrupted somehow.
            console.warn(
                '[ChannelManagerImpl] Unable to load tree',
                info.id,
                ex
            );
            return await this._createNewTree(info);
        }
    }

    private async _createNewTree(info: RealtimeChannelInfo) {
        console.log(`[ChannelManagerImpl] Creating new...`);
        const tree = await this._createTree(info.id, info.type, true);
        if (!info.bare) {
            const { added, rejected } = await tree.root();
            if (rejected) {
                throw new Error(
                    '[ChannelManagerImpl] Unable to add a root atom to the tree: ' +
                        rejected.reason
                );
            }
            console.log(`[ChannelManagerImpl] Storing initial tree version...`);
            await this._store.put(info.id, tree.export(), true);
        } else {
            console.log(
                `[ChannelManagerImpl] Skipping root node because a bare tree was requested.`
            );
        }
        return tree;
    }

    private async _createTree(id: string, type: string, generateKeys: boolean) {
        let keys = await this._store.getKeys(id);
        let signingKey: PrivateCryptoKey = null;
        let treeWithCrypto: StoredCausalTree<AtomOp>;
        if (keys && this._crypto.supported()) {
            // Use the existing keys because we've already created them.
            console.log('[ChannelManagerImpl] Using existing keys...');

            treeWithCrypto = storedTree(
                site(1, {
                    // TODO: Allow storing the crypto algorithm with the keys
                    signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                    publicKey: keys.publicKey,
                })
            );
            signingKey = await this._crypto.importPrivateKey(keys.privateKey);
            console.log('[ChannelManagerImpl] Keys imported.');
        } else if (generateKeys && this._crypto.supported()) {
            // Create new keys because we haven't stored any under this ID
            console.log('[ChannelManagerImpl] Creating new keys...');
            let [pubKey, privKey] = await this._crypto.generateKeyPair();
            signingKey = privKey;

            let publicKey = await this._crypto.exportKey(pubKey);
            let privateKey = await this._crypto.exportKey(privKey);
            await this._store.putKeys(id, privateKey, publicKey);
            treeWithCrypto = storedTree(
                site(1, {
                    // TODO: Allow storing the crypto algorithm with the keys
                    signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                    publicKey: publicKey,
                })
            );
            console.log('[ChannelManagerImpl] Keys created.');
        } else {
            console.log('[ChannelManagerImpl] Not generating keys.');
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
