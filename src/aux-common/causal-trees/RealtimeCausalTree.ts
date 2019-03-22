import { RealtimeChannel } from "./RealtimeChannel";
import { AtomOp, Atom } from "./Atom";
import { CausalTree, CausalTreeOptions } from "./CausalTree";
import { CausalTreeStore } from "./CausalTreeStore";
import { CausalTreeFactory } from "./CausalTreeFactory";
import { SiteVersionInfo } from "./SiteVersionInfo";
import { SiteInfo, site } from "./SiteIdInfo";
import { SubscriptionLike, Subject, Observable, ReplaySubject } from 'rxjs';
import { filter, flatMap, takeWhile, skipWhile, tap, map, first } from 'rxjs/operators';
import { maxBy } from 'lodash';
import { storedTree, StoredCausalTree } from "./StoredCausalTree";
import { WeaveVersion, versionsEqual } from "./WeaveVersion";

/**
 * Defines a realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class RealtimeCausalTree<TTree extends CausalTree<AtomOp, any, any>> {

    private _tree: TTree;
    private _store: CausalTreeStore;
    private _channel: RealtimeChannel<Atom<AtomOp>[]>;
    private _factory: CausalTreeFactory;
    private _updated: Subject<Atom<AtomOp>[]>;
    private _errors: Subject<any>;
    private _subs: SubscriptionLike[];
    private _options: CausalTreeOptions;

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
     * Creates a new Realtime Causal Tree.
     * @param type The type of the tree.
     * @param factory The factory used to create new trees.
     * @param store The store used to persistently store the tree.
     * @param channel The channel used to communicate with other devices.
     * @param options The options that should be used for the causal tree.
     */
    constructor(factory: CausalTreeFactory, store: CausalTreeStore, channel: RealtimeChannel<Atom<AtomOp>[]>, options?: CausalTreeOptions) {
        this._factory = factory;
        this._store = store;
        this._channel = channel;
        this._updated = new Subject<Atom<AtomOp>[]>();
        this._errors = new Subject<any>();
        this._tree = null;
        this._subs = [];
        this._options = options;

        // TODO: Get the causal tree to store the state
        // without tanking performance.
        this._subs.push(this._updated.pipe(
            flatMap(async atoms => await this._store.add(this.id, atoms))
        ).subscribe(null, err => this._errors.next(err)));
    }

    /**
     * Initializes the realtime causal tree.
     */
    async init(): Promise<void> {
        const stored = await this._store.get(this.id, false);
        if (stored) {
            this._setTree(<TTree>this._factory.create(this.type, stored, this._options));
            if (stored.weave) {
                if (stored.formatVersion === 2) {
                    this._updated.next(stored.weave);
                } else if (stored.formatVersion === 3) {
                    this._updated.next(stored.weave);
                } else if (typeof stored.formatVersion === 'undefined') {
                    this._updated.next(stored.weave.map(a => a.atom));
                }
            }
        }

        this._subs.push(this._channel.connectionStateChanged.pipe(
            filter(connected => connected),
            takeWhile(connected => this.tree === null),
            flatMap(c => this._channel.exchangeInfo(this.getVersion())),
            flatMap(version => this._requestSiteId(version), (version, site) => ({ version, site })),
            map(data => <TTree>this._factory.create(this.type, storedTree(data.site, data.version.knownSites))),
            flatMap(tree => this._channel.exchangeWeaves(tree.export()), (tree, imported) => ({tree, imported})),
            map(data => ({...data, added: this._import(data.tree, data.imported) })),
            flatMap(data => this._store.put(this.id, data.tree.export(), true), (data) => data),
            tap(data => this._setTree(data.tree)),
            tap(data => this._updated.next(data.added))
        ).subscribe(null, err => this._errors.next(err)));

        this._subs.push(this._channel.connectionStateChanged.pipe(
            filter(connected => connected),
            skipWhile(connected => this.tree === null),
            map(c => this.getVersion()),
            flatMap(localVersion => this._channel.exchangeInfo(localVersion), (local, remote) => ({local, remote})),
            filter(versions => !versionsEqual(versions.local.version, versions.remote.version)),
            flatMap(versions => this._channel.exchangeWeaves(this.tree.export()), (versions, weave) => ({ versions, weave })),
            map(data => ({...data, weave: this._import(this.tree, data.weave) })),
            tap(data => this._importKnownSites(data.versions.remote)),
            flatMap(data => this._store.put(this.id, this._tree.export(), true), (data) => data),
            tap(data => this._updated.next(data.weave))
        ).subscribe(null, err => this._errors.next(err)));
        
        this._subs.push(this._channel.events.pipe(
            filter(e => this.tree !== null),
            map(e => this.tree.addMany(e)),
            tap(refs => this._updated.next(refs))
        ).subscribe(null, err => this._errors.next(err)));
    }

    /**
     * Returns a promise that waits to get the tree from the server if it hasn't been retrieved yet.
     */
    async waitToGetTreeFromServer() {
        if (!this.tree) {
            await this.onUpdated.pipe(first()).toPromise();
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
                version: null
            };
        }
    }

    private _import(tree: CausalTree<any, any, any>, weave: StoredCausalTree<AtomOp>): Atom<AtomOp>[] {
        console.log(`[RealtimeCausalTree] Importing ${weave.weave.length} atoms....`);
        const results = tree.import(weave);
        console.log(`[RealtimeCausalTree] Imported ${results.length} atoms.`);
        return results;
    }

    private _setTree(tree: TTree) {
        this._tree = tree;
        this._subs.push(this._tree.atomAdded.pipe(
            map(refs => refs.filter(ref => ref.id.site === this._tree.site.id)),
            filter(refs => refs.length > 0),
            tap(refs => this._channel.emit(refs)),
            tap(ref => this._updated.next(ref))
        ).subscribe(null, error => this._errors.next(error)));
    }

    private _importKnownSites(version: SiteVersionInfo) {
        version.knownSites.forEach(site => {
            this._tree.registerSite(site);
        });
    }

    private async _requestSiteId(serverVersion: SiteVersionInfo): Promise<SiteInfo> {
        let newestSite: SiteInfo = maxBy(serverVersion.knownSites, site => site.id);
        let nextSite: number = newestSite ? newestSite.id : 0;
        let mySite: SiteInfo;
        let success = false;
        while (!success) {
            nextSite += 1;
            mySite = site(nextSite);
            success = await this._channel.requestSiteId(mySite);
        }

        return mySite;
    }
}