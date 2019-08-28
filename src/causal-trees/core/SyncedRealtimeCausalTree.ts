import { AtomOp, Atom } from './Atom';
import { CausalTree } from './CausalTree';
import { CausalTreeStore } from './CausalTreeStore';
import { CausalTreeFactory } from './CausalTreeFactory';
import { SiteVersionInfo } from './SiteVersionInfo';
import { SiteInfo, site, SiteInfoCrypto } from './SiteIdInfo';
import { SubscriptionLike, Subject, Observable } from 'rxjs';
import { filter, tap, map, first, concatMap, bufferTime } from 'rxjs/operators';
import { maxBy } from 'lodash';
import { storedTree, StoredCausalTree } from './StoredCausalTree';
import { versionsEqual } from './WeaveVersion';
import { PrivateCryptoKey } from '@casual-simulation/crypto';
import { RejectedAtom } from './RejectedAtom';
import {
    RealtimeCausalTreeOptions,
    RealtimeCausalTree,
} from './RealtimeCausalTree';
import { StatusUpdate, ProgressMessage } from './StatusUpdate';
import { RealtimeChannel } from './RealtimeChannel';
import { remapProgressPercent } from './StatusUpdateUtils';
import { DeviceEvent } from './Event';

/**
 * Defines an interface for options that a realtime causal tree can accept.
 */
export interface SyncedRealtimeCausalTreeOptions
    extends RealtimeCausalTreeOptions {
    /**
     * Specifies that the tree should not use the locally stored causal tree
     * and instead should always request a new one from the server.
     * For now, this is a useful way to ensure that clients always get new IDs.
     * Defaults to false.
     */
    alwaysRequestNewSiteId?: boolean;

    /**
     * Whether the realtime causal tree should save atoms in the store.
     * Defaults to true.
     */
    storeAtoms?: boolean;

    /**
     * The number of miliseconds that new atoms should be buffered for before saving them.
     * Defaults to 1000.
     */
    bufferTimeSpan?: number;
}

/**
 * Defines a synced realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class SyncedRealtimeCausalTree<
    TTree extends CausalTree<AtomOp, any, any>
> implements RealtimeCausalTree<TTree> {
    closed: boolean = false;

    private _tree: TTree;
    private _store: CausalTreeStore;
    private _channel: RealtimeChannel;
    private _factory: CausalTreeFactory;
    private _updated: Subject<Atom<AtomOp>[]>;
    private _rejected: Subject<RejectedAtom<AtomOp>[]>;
    private _status: Subject<StatusUpdate>;
    private _errors: Subject<any>;
    private _subs: SubscriptionLike[];
    private _options: SyncedRealtimeCausalTreeOptions;
    private _storeAtoms: boolean;

    private _bufferTime: number;
    private _synced: boolean = false;

    /**
     * Gets the realtime channel that this tree is using.
     */
    get channel() {
        return this._channel;
    }

    /**
     * Gets the tree that this class is currently wrapping.
     */
    get tree() {
        return this._tree;
    }

    /**
     * Gets the ID of the tree.
     */
    get id() {
        return this._channel.connection.info.id;
    }

    /**
     * Gets the type of the tree.
     */
    get type() {
        return this._channel.connection.info.type;
    }

    /**
     * Gets an observable that resolves whenever this tree is updated.
     */
    get onUpdated(): Observable<Atom<AtomOp>[]> {
        return this._updated;
    }

    /**
     * Gets an observable that resolves whenever an error happens in this tree.
     */
    get onError(): Observable<any> {
        return this._errors;
    }

    /**
     * Gets an observable that resolves whenever an atom is rejected.
     */
    get onRejected(): Observable<RejectedAtom<AtomOp>[]> {
        return this._rejected;
    }

    get statusUpdated(): Observable<StatusUpdate> {
        return this._status;
    }

    get events(): Observable<DeviceEvent[]> {
        return this._channel.connection.events;
    }

    /**
     * Creates a new Realtime Causal Tree.
     * @param type The type of the tree.
     * @param factory The factory used to create new trees.
     * @param store The store used to persistently store the tree.
     * @param channel The channel used to communicate with other devices.
     * @param options The options that should be used for the causal tree.
     */
    constructor(
        factory: CausalTreeFactory,
        store: CausalTreeStore,
        channel: RealtimeChannel,
        options?: SyncedRealtimeCausalTreeOptions
    ) {
        this._factory = factory;
        this._store = store;
        this._channel = channel;
        this._updated = new Subject<Atom<AtomOp>[]>();
        this._errors = new Subject<any>();
        this._rejected = new Subject<RejectedAtom<AtomOp>[]>();
        this._status = new Subject<StatusUpdate>();
        this._tree = <TTree>((options ? options.tree : null) || null);
        this._subs = [];
        this._options = options || {};
        this._storeAtoms =
            typeof this._options.storeAtoms === 'undefined'
                ? true
                : this._options.storeAtoms;
        this._bufferTime =
            typeof this._options.bufferTimeSpan === 'undefined'
                ? 1000
                : this._options.bufferTimeSpan;

        this._channel.statusUpdated.subscribe(this._status);

        if (this._storeAtoms) {
            this._subs.push(
                this._updated
                    .pipe(
                        filter(a => a.length > 0),
                        bufferTime(1000),
                        concatMap(atoms => atoms),
                        concatMap(
                            async atoms => await this._store.add(this.id, atoms)
                        )
                    )
                    .subscribe(null, err => this._errors.next(err))
            );
        }
    }

    /**
     * Initializes the realtime causal tree.
     */
    async connect(): Promise<void> {
        // Skip using the stored tree if
        // we should always load from the server.
        if (!this._tree && !this._alwaysRequestNewSiteId) {
            await this._loadTreeFromStore();
        } else {
            console.log(`[RealtimeCausalTree] Using pre-configured tree.`);
        }

        this._subs.push(
            this._channel.statusUpdated.subscribe(
                status => this._channelStatusUpdated(status),
                err => this._errors.next(err)
            )
        );

        this._subs.push(
            this._channel.connection.atoms
                .pipe(
                    filter(e => this.tree !== null),
                    concatMap(e => this.tree.addMany(e)),
                    tap(refs => this._updated.next(refs.added))
                )
                .subscribe(null, err => this._errors.next(err))
        );

        this._subs.push(
            this._channel.connection.sites
                .pipe(
                    filter(e => this.tree !== null),
                    tap(site => {
                        console.log(
                            `[RealtimeCausalTree] ${
                                this.id
                            }: Discovered new site from server:`,
                            site
                        );
                        this.tree.registerSite(site);
                    })
                )
                .subscribe(null, err => this._errors.next(err))
        );

        this._status.next({
            type: 'progress',
            message: 'Opening channel stream...',
            progress: 0.1,
        });
        this.channel.connect();
    }

    async waitUntilSynced() {
        if (this._synced) {
            return;
        }
        await this._status
            .pipe(first(a => a.type === 'sync' && a.synced))
            .toPromise();
    }

    private async _channelStatusUpdated(status: StatusUpdate): Promise<void> {
        if (status.type === 'authorization') {
            if (status.authorized) {
                console.log(
                    '[SyncedRealtimeCausalTree] Syncing with the server...'
                );
                await this._sync();
                this._synced = true;
                this._updateSyncedStatus();
                return;
            } else {
                this._synced = false;
                this._updateSyncedStatus();
            }
        }
    }

    private async _loadTreeFromStore() {
        this._updateStatus({
            type: 'message',
            source: 'SyncedRealtimeCausalTree',
            message: 'Checking for stored causal tree...',
        });
        const stored = await this._store.get(this.id, false);

        if (stored) {
            this._updateStatus({
                type: 'message',
                source: 'SyncedRealtimeCausalTree',
                message: 'Retrieving stored keys...',
            });
            const keys = await this._store.getKeys(this.id);

            let tree: TTree;
            if (keys) {
                this._updateStatus({
                    type: 'message',
                    source: 'SyncedRealtimeCausalTree',
                    message: 'Importing private signing key...',
                });
                const signingKey = await this._options.validator.impl.importPrivateKey(
                    keys.privateKey
                );

                tree = this._createTree(
                    {
                        site: site(stored.site.id, {
                            signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                            publicKey: keys.publicKey,
                        }),
                        signingKey: signingKey,
                    },
                    stored.knownSites
                );
            } else {
                this._updateStatus({
                    type: 'message',
                    source: 'SyncedRealtimeCausalTree',
                    message: 'Creating new casual tree...',
                });

                tree = <TTree>(
                    this._factory.create(this.type, stored, this._options)
                );
            }
            this._listenForRejectedAtoms(tree);

            this._updateStatus({
                type: 'message',
                source: 'SyncedRealtimeCausalTree',
                message: 'Importing stored tree...',
            });
            await tree.import(stored, undefined);

            this._setTree(tree);

            this._updateStatus({
                type: 'message',
                source: 'SyncedRealtimeCausalTree',
                message: 'Updating stored tree...',
            });
            await this._putTree(tree, true);
        }
    }

    private async _sync() {
        if (this.tree === null) {
            this._status.next({
                type: 'progress',
                message: 'Streaming channel data...',
                progress: 0.2,
            });
            await this._loadTreeFromServer();
        } else {
            await this._updateTreeFromServer();
        }

        return true;
    }

    private async _loadTreeFromServer() {
        const versionResponse = await this._channel.connection.exchangeInfo(
            this.getVersion()
        );
        const version = versionResponse.value;
        const site = await this._requestSiteId(this.id, version);
        const tree = this._createTree(site, version.knownSites);

        this._listenForRejectedAtoms(tree);

        const imported = await this._channel.connection.exchangeWeaves(
            tree.export()
        );
        const added = await this._import(tree, imported.value);

        await this._putTree(tree, false);
        this._setTree(tree);

        this._updated.next(added);
    }

    private async _updateTreeFromServer() {
        const localVersion = this.getVersion();
        const versionResponse = await this._channel.connection.exchangeInfo(
            localVersion
        );

        const remoteVersion = versionResponse.value;
        if (versionsEqual(localVersion.version, remoteVersion.version)) {
            return;
        }

        const weaveResponse = await this._channel.connection.exchangeWeaves(
            this.tree.export()
        );
        const weave = weaveResponse.value;
        const added = await this._import(this.tree, weave);

        this._importKnownSites(remoteVersion);

        await this._putTree(this._tree, true);

        this._updated.next(added);
    }

    private _updateSyncedStatus() {
        this._status.next({
            type: 'sync',
            synced: this._synced,
        });
    }

    private _updateStatus(status: StatusUpdate) {
        this._status.next(status);
    }

    /**
     * Returns a promise that waits to get the tree from the server if it hasn't been retrieved yet.
     */
    async waitToGetTreeFromServer() {
        if (!this.tree) {
            await this.waitForUpdateFromServer();
            this._updateStatus({
                type: 'message',
                source: 'SyncedRealtimeCausalTree',
                message: 'Tree initialization complete.',
            });
        }
    }

    /**
     * Returns a promise that waits for an update from the server.
     */
    async waitForUpdateFromServer() {
        await this.onUpdated.pipe(first()).toPromise();
    }

    /**
     * Gets the version info from the tree.
     */
    getVersion(): SiteVersionInfo {
        if (this.tree) {
            return this.tree.getVersion();
        } else {
            return {
                site: null,
                knownSites: null,
                version: null,
            };
        }
    }

    async _putTree(tree: TTree, fullUpdate: boolean) {
        if (this._storeAtoms) {
            await this._store.put(this.id, tree.export(), fullUpdate);
        }
    }

    private get _alwaysRequestNewSiteId(): boolean {
        if (this._options) {
            return this._options.alwaysRequestNewSiteId || false;
        }
        return false;
    }

    private _createTree(site: GrantedSite, knownSites: SiteInfo[]) {
        const tree = <TTree>this._factory.create(
            this.type,
            storedTree(site.site, knownSites),
            {
                ...this._options,
                signingKey: site.signingKey,
            }
        );
        return tree;
    }

    private async _import(
        tree: CausalTree<any, any, any>,
        weave: StoredCausalTree<AtomOp>
    ): Promise<Atom<AtomOp>[]> {
        console.log(
            `[RealtimeCausalTree] ${this.id}: Importing ${
                weave.weave.length
            } atoms....`
        );

        let mapper = remapProgressPercent(0.4, 0.1);
        let percent: number = 0;

        const { added: results } = await tree.import(
            weave,
            this._options.verifyAllSignatures || false,
            progress => {
                if (progress.progressPercent) {
                    percent = progress.progressPercent;
                }
                let msg: ProgressMessage = {
                    type: 'progress',
                    progress: percent,
                    message:
                        progress.message ||
                        `[RealtimeCausalTree] ${this.id}: Importing ${
                            weave.weave.length
                        } atoms....`,
                };

                this._status.next(mapper(msg));
            }
        );
        console.log(
            `[RealtimeCausalTree] ${this.id}: Imported ${results.length} atoms.`
        );
        return results;
    }

    private _setTree(tree: TTree) {
        this._tree = tree;
        this._subs.push(
            this._tree.atomAdded
                .pipe(
                    map(refs =>
                        refs.filter(ref => ref.id.site === this._tree.site.id)
                    ),
                    filter(refs => refs.length > 0),
                    tap(refs => this._channel.connection.emit(refs)),
                    tap(ref => this._updated.next(ref))
                )
                .subscribe(null, error => this._errors.next(error))
        );
    }

    private _listenForRejectedAtoms(tree: TTree) {
        this._subs.push(
            tree.atomRejected
                .pipe(
                    filter(refs => refs.length > 0),
                    tap(refs => this._rejected.next(refs))
                )
                .subscribe(null, ex => this._errors.next(ex))
        );
    }

    private _importKnownSites(version: SiteVersionInfo) {
        version.knownSites.forEach(site => {
            this._tree.registerSite(site);
        });
    }

    private async _requestSiteId(
        id: string,
        serverVersion: SiteVersionInfo
    ): Promise<GrantedSite> {
        let crypto: SiteInfoCrypto;
        let signingKey: PrivateCryptoKey;
        if (
            this._options.validator &&
            this._options.validator.impl.supported()
        ) {
            let keys = await this._store.getKeys(id);
            if (!keys && this._options.validator) {
                console.log(
                    `[RealtimeCausalTree] ${id}: Generating crypto keys...`
                );
                this._updateStatus({
                    type: 'message',
                    source: 'SyncedRealtimeCausalTree',
                    message: 'Generating crypto keys...',
                });
                const [
                    pubKey,
                    privKey,
                ] = await this._options.validator.impl.generateKeyPair();
                const publicKey = await this._options.validator.impl.exportKey(
                    pubKey
                );
                const privateKey = await this._options.validator.impl.exportKey(
                    privKey
                );
                crypto = {
                    publicKey: publicKey,
                    signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                };
                signingKey = privKey;

                await this._store.putKeys(id, privateKey, publicKey);
            } else if (keys) {
                console.log(
                    `[RealtimeCausalTree] ${id}: Using existing keys...`
                );
                this._updateStatus({
                    type: 'message',
                    source: 'SyncedRealtimeCausalTree',
                    message: 'Using exisiting crypto keys...',
                });
                crypto = {
                    publicKey: keys.publicKey,
                    signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                };

                signingKey = await this._options.validator.impl.importPrivateKey(
                    keys.privateKey
                );
            }
        }
        if (!crypto) {
            console.log(`[RealtimeCausalTree] ${id}: Not using crypto.`);
        }

        let newestSite: SiteInfo = maxBy(
            serverVersion.knownSites,
            site => site.id
        );
        let nextSite: number = newestSite ? newestSite.id : 0;
        let mySite: SiteInfo;
        let success = false;
        while (!success) {
            nextSite += 1;
            mySite = site(nextSite, crypto);
            this._updateStatus({
                type: 'message',
                source: 'SyncedRealtimeCausalTree',
                message: `Requesting permissions...`,
            });
            this._status.next({
                type: 'progress',
                message: `Requesting permissions...`,
                progress: 0.3,
            });
            const result = await this._channel.connection.requestSiteId(mySite);
            success = result.value;
        }

        return {
            site: mySite,
            signingKey: signingKey,
        };
    }

    unsubscribe(): void {
        this._channel.unsubscribe();
        this._subs.forEach(s => s.unsubscribe());
        this.closed = true;
    }
}

interface GrantedSite {
    site: SiteInfo;
    signingKey: PrivateCryptoKey;
}
