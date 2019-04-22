import { RealtimeChannel } from './RealtimeChannel';
import { AtomOp, Atom } from './Atom';
import { CausalTree, CausalTreeOptions } from './CausalTree';
import { CausalTreeStore } from './CausalTreeStore';
import { CausalTreeFactory } from './CausalTreeFactory';
import { SiteVersionInfo } from './SiteVersionInfo';
import { SiteInfo, site, SiteInfoCrypto } from './SiteIdInfo';
import { SubscriptionLike, Subject, Observable, ReplaySubject } from 'rxjs';
import {
    filter,
    flatMap,
    takeWhile,
    skipWhile,
    tap,
    map,
    first,
    concatMap,
    bufferTime,
} from 'rxjs/operators';
import { maxBy } from 'lodash';
import { storedTree, StoredCausalTree } from './StoredCausalTree';
import { WeaveVersion, versionsEqual } from './WeaveVersion';
import { PrivateCryptoKey } from '../crypto';
import { RejectedAtom } from './RejectedAtom';
import { LoadingProgressCallback } from './LoadingProgress';

/**
 * Defines an interface for options that a realtime causal tree can accept.
 */
export interface RealtimeCausalTreeOptions extends CausalTreeOptions {
    /**
     * Specifies that the tree should not use the locally stored causal tree
     * and instead should always request a new one from the server.
     * For now, this is a useful way to ensure that clients always get new IDs.
     * Defaults to false.
     */
    alwaysRequestNewSiteId?: boolean;

    /**
     * Specifies whether the realtime causal tree should validate the signatures of all the atoms
     * that are added to the tree. If false, then only atoms added via realtime.tree.add() will be verified.
     * If true, then atoms that are imported from the remote will be verified.
     *
     * Defaults to false.
     */
    verifyAllSignatures?: boolean;

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
 * Defines a realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class RealtimeCausalTree<TTree extends CausalTree<AtomOp, any, any>>
    implements SubscriptionLike {
    closed: boolean = false;

    private _tree: TTree;
    private _store: CausalTreeStore;
    private _channel: RealtimeChannel<Atom<AtomOp>[]>;
    private _factory: CausalTreeFactory;
    private _updated: Subject<Atom<AtomOp>[]>;
    private _rejected: Subject<RejectedAtom<AtomOp>[]>;
    private _errors: Subject<any>;
    private _subs: SubscriptionLike[];
    private _options: RealtimeCausalTreeOptions;
    private _storeAtoms: boolean;
    private _bufferTime: number;
    private _loadingCallback: LoadingProgressCallback;

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
        return this._channel.info.id;
    }

    /**
     * Gets the type of the tree.
     */
    get type() {
        return this._channel.info.type;
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
        channel: RealtimeChannel<Atom<AtomOp>[]>,
        options?: RealtimeCausalTreeOptions
    ) {
        this._factory = factory;
        this._store = store;
        this._channel = channel;
        this._updated = new Subject<Atom<AtomOp>[]>();
        this._errors = new Subject<any>();
        this._rejected = new Subject<RejectedAtom<AtomOp>[]>();
        this._tree = null;
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
    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        this._loadingCallback = loadingCallback || (() => {});

        // Skip using the stored tree if
        // we should always load from the server.
        if (!this._alwaysRequestNewSiteId) {
            this._loadingCallback({
                message: 'Checking for stored causal tree...',
            });
            const stored = await this._store.get(this.id, false);

            if (stored) {
                this._loadingCallback({
                    message: 'Retrieving stored keys...',
                });
                const keys = await this._store.getKeys(this.id);

                let tree: TTree;
                if (keys) {
                    this._loadingCallback({
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
                    this._loadingCallback({
                        message: 'Creating new casual tree...',
                    });

                    tree = <TTree>(
                        this._factory.create(this.type, stored, this._options)
                    );
                }
                this._listenForRejectedAtoms(tree);

                this._loadingCallback({
                    message: 'Importing stored tree...',
                });
                await tree.import(stored, undefined, status => {
                    this._loadingCallback({
                        progressPercent: status.progressPercent,
                    });
                });

                this._setTree(tree);

                this._loadingCallback({
                    message: 'Updating stored tree...',
                });
                await this._putTree(tree, true);
            }
        }

        this._subs.push(
            this._channel.connectionStateChanged
                .pipe(
                    filter(connected => connected),
                    takeWhile(connected => this.tree === null),
                    // tap(connected => { if (this._loadingProgress) { this._loadingProgress(0, 'Exchanging version info with remote...', null); }}),
                    concatMap(c =>
                        this._channel.exchangeInfo(this.getVersion())
                    ),
                    concatMap(
                        version => this._requestSiteId(this.id, version),
                        (version, site) => ({ version, site })
                    ),
                    map(data =>
                        this._createTree(data.site, data.version.knownSites)
                    ),
                    tap(tree => this._listenForRejectedAtoms(tree)),
                    concatMap(
                        tree => this._channel.exchangeWeaves(tree.export()),
                        (tree, imported) => ({ tree, imported })
                    ),
                    concatMap(
                        data => this._import(data.tree, data.imported),
                        (data, imported) => ({ ...data, added: imported })
                    ),
                    concatMap(
                        data => this._putTree(data.tree, false),
                        data => data
                    ),
                    tap(data => this._setTree(data.tree)),
                    tap(data => this._updated.next(data.added))
                )
                .subscribe(null, err => this._errors.next(err))
        );

        this._subs.push(
            this._channel.connectionStateChanged
                .pipe(
                    filter(connected => connected),
                    skipWhile(connected => this.tree === null),
                    map(c => this.getVersion()),
                    concatMap(
                        localVersion =>
                            this._channel.exchangeInfo(localVersion),
                        (local, remote) => ({ local, remote })
                    ),
                    filter(
                        versions =>
                            !versionsEqual(
                                versions.local.version,
                                versions.remote.version
                            )
                    ),
                    concatMap(
                        versions =>
                            this._channel.exchangeWeaves(this.tree.export()),
                        (versions, weave) => ({ versions, weave })
                    ),
                    concatMap(
                        data => this._import(this.tree, data.weave),
                        (data, imported) => ({ ...data, added: imported })
                    ),
                    tap(data => this._importKnownSites(data.versions.remote)),
                    concatMap(
                        data => this._putTree(this._tree, true),
                        data => data
                    ),
                    tap(data => this._updated.next(data.added))
                )
                .subscribe(null, err => this._errors.next(err))
        );

        this._subs.push(
            this._channel.events
                .pipe(
                    filter(e => this.tree !== null),
                    concatMap(e => this.tree.addMany(e)),
                    tap(refs => this._updated.next(refs.added))
                )
                .subscribe(null, err => this._errors.next(err))
        );

        this._subs.push(
            this._channel.sites
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
    }

    /**
     * Returns a promise that waits to get the tree from the server if it hasn't been retrieved yet.
     */
    async waitToGetTreeFromServer() {
        if (!this.tree) {
            await this.onUpdated.pipe(first()).toPromise();
            this._loadingCallback({
                message: 'Tree initialization complete.',
                progressPercent: 1,
            });
        }
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

        this._loadingCallback({
            message: `Importing ${weave.weave.length} atoms...`,
        });

        const { added: results } = await tree.import(
            weave,
            this._options.verifyAllSignatures || false,
            this._loadingCallback
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
                    tap(refs => this._channel.emit(refs)),
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
                this._loadingCallback({
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
                this._loadingCallback({
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
            this._loadingCallback({
                message: `Requesting side id ${mySite.id} from remote...`,
            });
            success = await this._channel.requestSiteId(mySite);
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
