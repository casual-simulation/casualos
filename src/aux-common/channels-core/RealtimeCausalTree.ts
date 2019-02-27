import { RealtimeChannel } from "./RealtimeChannel";
import { WeaveReference } from "./Weave";
import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";
import { CausalTreeStore } from "./CausalTreeStore";
import { CausalTreeFactory } from "./CausalTreeFactory";
import { SiteVersionInfo } from "./SiteVersionInfo";
import { SiteInfo, site } from "./SiteIdInfo";
import { SubscriptionLike } from 'rxjs';
import { filter, flatMap, takeWhile, skipWhile, tap, map } from 'rxjs/operators';
import { maxBy } from 'lodash';
import { storedTree } from "./StoredCausalTree";
import { WeaveVersion, versionsEqual } from "./WeaveVersion";

/**
 * Defines a realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class RealtimeCausalTree<TOp extends AtomOp, T> {

    private _tree: CausalTree<TOp, T>;
    private _store: CausalTreeStore;
    private _channel: RealtimeChannel<WeaveReference<TOp>>;
    private _factory: CausalTreeFactory;
    private _subs: SubscriptionLike[];

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
     * Creates a new Realtime Causal Tree.
     * @param type The type of the tree.
     * @param factory The factory used to create new trees.
     * @param store The store used to persistently store the tree.
     * @param channel The channel used to communicate with other devices.
     */
    constructor(factory: CausalTreeFactory, store: CausalTreeStore, channel: RealtimeChannel<WeaveReference<TOp>>) {
        this._factory = factory;
        this._store = store;
        this._channel = channel;
        this._tree = null;
        this._subs = [];
    }

    /**
     * Initializes the realtime causal tree.
     */
    async init(): Promise<void> {
        const stored = await this._store.get(this.id);
        if (stored) {
            this._setTree(<CausalTree<TOp, T>>this._factory.create(this.type, stored));
        }

        this._subs.push(this._channel.connectionStateChanged.pipe(
            filter(connected => connected),
            takeWhile(connected => this.tree === null),
            flatMap(c => this._channel.exchangeInfo(this.getVersion())),
            flatMap(version => this._requestSiteId(version), (version, site) => ({ version, site })),
            map(data => <CausalTree<TOp, T>>this._factory.create(this.type, storedTree(data.site, data.version.knownSites))),
            flatMap(tree => this._channel.exchangeWeaves<TOp>([], tree.weave.getVersion()), (tree, weave) => ({tree, weave})),
            tap(data => data.tree.importWeave(data.weave)),
            tap(data => this._setTree(data.tree))
        ).subscribe());

        this._subs.push(this._channel.connectionStateChanged.pipe(
            filter(connected => connected),
            skipWhile(connected => this.tree === null),
            map(c => this.getVersion()),
            flatMap(localVersion => this._channel.exchangeInfo(localVersion), (local, remote) => ({local, remote})),
            filter(versions => !versionsEqual(versions.local.version, versions.remote.version)),
            flatMap(versions => this._channel.exchangeWeaves<TOp>(this._tree.weave.atoms, versions.local.version), (versions, weave) => ({ versions, weave })),
            tap(data => this._tree.importWeave(data.weave)),
            tap(data => this._importKnownSites(data.versions.remote))
        ).subscribe());
        
        this._subs.push(this._channel.events.pipe(
            tap(e => this.tree.add(e.atom))
        ).subscribe());
    }

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

    private _setTree(tree: CausalTree<TOp, T>) {
        this._tree = tree;
        this._subs.push(this._tree.atomAdded.pipe(
            filter(ref => ref.atom.id.site === this._tree.site.id),
            tap(ref => {
                this._channel.emit(ref)
            })
        ).subscribe());
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