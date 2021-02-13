import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';
import { startWith, tap } from 'rxjs/operators';
import { AuxVM } from '../vm/AuxVM';
import {
    BotAction,
    BotActions,
    BotIndex,
    BuildBundleAction,
    DNA_TAG_PREFIX,
    enqueueAsyncError,
    enqueueAsyncResult,
    hasValue,
    LocalActions,
    PrecalculatedBot,
    tagsOnBot,
    trimPortalScript,
} from '@casual-simulation/aux-common';
import {
    BundleModules,
    CodeBundle,
    ExternalModule,
    LibraryModule,
    PortalBundler,
    ScriptPrefix,
} from './PortalBundler';
import { BotHelper } from './BotHelper';
import { BotWatcher, UpdatedBotInfo } from './BotWatcher';
import { pick, values } from 'lodash';

/**
 * The list of default script prefixes.
 */
export const DEFAULT_SCRIPT_PREFIXES: ScriptPrefix[] = [
    {
        prefix: '@',
        language: 'javascript',
        isDefault: true,
    },
    {
        prefix: DNA_TAG_PREFIX,
        language: 'json',
        isDefault: true,
    },
    {
        prefix: '#',
        language: 'text',
        isDefault: true,
        isFallback: true,
    },
];

/**
 * Defines a class that is able to manage portals and their interactions.
 */
export class PortalManager implements SubscriptionLike {
    private _portals: Map<string, PortalData>;
    private _registeredPortals: Map<string, PortalRegistration>;
    private _prefixes: Map<string, ScriptPrefix>;

    private _portalsDiscovered: Subject<PortalData[]>;
    private _portalsUpdated: Subject<PortalUpdate[]>;
    private _prefixesDiscovered: Subject<ScriptPrefix[]>;
    private _prefixesRemoved: Subject<string[]>;
    private _externalsDiscovered: Subject<ExternalModule[]>;
    private _externalModules: CodeBundle['externals'];
    private _vm: AuxVM;
    private _helper: BotHelper;
    private _watcher: BotWatcher;
    private _bundler: PortalBundler;
    private _sub: Subscription;

    /**
     * Gets an observable that resolves when a new portal is discovered.
     */
    get portalsDiscovered(): Observable<PortalData[]> {
        return this._portalsDiscovered.pipe(
            startWith([...this._portals.values()])
        );
    }

    /**
     * Gets an observable that resolves when a portal is updated.
     */
    get portalsUpdated(): Observable<PortalUpdate[]> {
        return this._portalsUpdated;
    }

    /**
     * Gets an observable that resolves when a script prefix has been discovered.
     */
    get prefixesDiscovered(): Observable<ScriptPrefix[]> {
        return this._prefixesDiscovered.pipe(
            startWith([...this._prefixes.values()])
        );
    }

    /**
     * Gets an observable that resolves when a script prefix has been removed.
     */
    get prefixesRemoved(): Observable<string[]> {
        return this._prefixesRemoved;
    }

    /**
     * Gets an observable that resolves when an external script has been discovered.
     */
    get externalsDiscovered(): Observable<ExternalModule[]> {
        return this._externalsDiscovered.pipe(
            startWith(values(this.externalModules))
        );
    }

    /**
     * Gets the script prefixes that are currently in use.
     */
    get scriptPrefixes(): ScriptPrefix[] {
        return [...this._prefixes.values()];
    }

    /**
     * Gets a map of external modules that have been loaded.
     */
    get externalModules() {
        return this._externalModules;
    }

    constructor(
        vm: AuxVM,
        helper: BotHelper,
        watcher: BotWatcher,
        bundler: PortalBundler
    ) {
        this._vm = vm;
        this._helper = helper;
        this._watcher = watcher;
        this._portals = new Map();
        this._registeredPortals = new Map();
        this._prefixes = new Map();
        this._portalsDiscovered = new Subject();
        this._portalsUpdated = new Subject();
        this._prefixesDiscovered = new Subject();
        this._prefixesRemoved = new Subject();
        this._externalsDiscovered = new Subject();
        this._externalModules = {};
        this._bundler = bundler;
        this._sub = new Subscription();

        for (let p of DEFAULT_SCRIPT_PREFIXES) {
            this._prefixes.set(p.prefix, p);
        }

        this._sub.add(
            vm.localEvents.pipe(tap((e) => this._onLocalEvents(e))).subscribe()
        );
        this._sub.add(
            this._watcher.botsDiscovered
                .pipe(tap((b) => this._onBotsDiscovered(b)))
                .subscribe()
        );
        this._sub.add(
            this._watcher.botsRemoved
                .pipe(tap((b) => this._onBotsRemoved(b)))
                .subscribe()
        );
        this._sub.add(
            this._watcher.botTagsUpdated
                .pipe(tap((b) => this._onBotsUpdated(b)))
                .subscribe()
        );
    }

    addLibrary(module: LibraryModule) {
        return this._bundler.addLibrary(module);
    }

    private _onBotsUpdated(updates: UpdatedBotInfo[]): void {
        let updatedTags = new Set<string>();
        for (let update of updates) {
            updatedTags = new Set([...updatedTags, ...update.tags]);
        }

        for (let [id, portal] of this._registeredPortals) {
            this._checkPortalAgainstUpdatedTags(portal, updatedTags);
        }
    }

    private _onBotsRemoved(removedBots: string[]): void {
        let updatedBots = new Set<string>(removedBots);

        for (let [id, portal] of this._registeredPortals) {
            this._checkPortalAgainstUpdatedBots(portal, updatedBots);
        }
    }

    private _onBotsDiscovered(bots: PrecalculatedBot[]): void {
        let updatedTags = new Set<string>();
        for (let bot of bots) {
            updatedTags = new Set([...updatedTags, ...tagsOnBot(bot)]);
        }

        for (let [id, portal] of this._registeredPortals) {
            this._checkPortalAgainstUpdatedTags(portal, updatedTags);
        }
    }

    private _checkPortalAgainstUpdatedTags(
        portal: PortalRegistration,
        updatedTags: Set<string>
    ) {
        if (portal.tag === null) {
            return false;
        }

        let hasUpdate = false;
        if (!portal.buildInProcess && portal.modules) {
            for (let tag of updatedTags) {
                const botIds = Object.keys(portal.modules);
                if (botIds.length <= 0) {
                    hasUpdate = tag === portal.tag;
                } else {
                    for (let botId of botIds) {
                        const moduleTags = portal.modules[botId];
                        hasUpdate = moduleTags.has(tag);
                        if (hasUpdate) {
                            break;
                        }
                    }
                }

                if (hasUpdate) {
                    break;
                }
            }
        } else if (!portal.modules) {
            hasUpdate = true;
        } else if (portal.buildInProcess) {
            portal.unprocessedTags = new Set([
                ...portal.unprocessedTags,
                ...updatedTags,
            ]);
        }

        if (hasUpdate) {
            this._triggerUpdateForPortal(portal);
        }
    }

    private _checkPortalAgainstUpdatedBots(
        portal: PortalRegistration,
        updatedBots: Set<string>
    ) {
        if (portal.tag === null) {
            return false;
        }
        let hasUpdate = false;
        if (!portal.buildInProcess && portal.modules) {
            for (let botId of updatedBots) {
                if (botId in portal.modules) {
                    const moduleTags = portal.modules[botId];
                    hasUpdate = moduleTags.size > 0;
                    if (hasUpdate) {
                        break;
                    }
                }

                if (hasUpdate) {
                    break;
                }
            }
        } else if (!portal.modules) {
            hasUpdate = true;
        } else if (portal.buildInProcess) {
            portal.unprocessedBots = new Set([
                ...portal.unprocessedBots,
                ...updatedBots,
            ]);
        }

        if (hasUpdate) {
            this._triggerUpdateForPortal(portal);
        }
    }

    private _onLocalEvents(events: LocalActions[]): void {
        let newPrefixes: ScriptPrefix[] = [];
        let removedPrefixes: Set<string> = new Set();
        let nextEvents: BotActions[] = [];

        for (let event of events) {
            if (event.type === 'open_custom_portal') {
                try {
                    const currentPortal: PortalRegistration = this._registeredPortals.get(
                        event.portalId
                    );

                    const isSource = event.options.mode === 'source';
                    if (currentPortal) {
                        currentPortal.entrypoint = event.tagOrSource;
                        currentPortal.tag = isSource
                            ? null
                            : this._getTrimmedPortalTag(event.tagOrSource);
                        currentPortal.style = event.options.style;
                        this._triggerUpdateForPortal(currentPortal);
                    } else {
                        const newPortal: PortalRegistration = {
                            id: event.portalId,
                            entrypoint: event.tagOrSource,
                            tag: isSource
                                ? null
                                : this._getTrimmedPortalTag(event.tagOrSource),
                            style: event.options.style,
                            buildInProcess: false,
                            modules: null,
                            unprocessedTags: new Set(),
                            unprocessedBots: new Set(),
                        };
                        this._registeredPortals.set(event.portalId, newPortal);
                        this._triggerUpdateForPortal(newPortal);
                    }

                    enqueueAsyncResult(nextEvents, event, undefined);
                } catch (err) {
                    enqueueAsyncError(nextEvents, event, err);
                }
            } else if (event.type === 'register_prefix') {
                try {
                    const eventPrefix = event.prefix;
                    if (
                        !this._prefixes.has(event.prefix) &&
                        newPrefixes.every((p) => p.prefix !== eventPrefix)
                    ) {
                        const prefix: ScriptPrefix = {
                            prefix: event.prefix,
                            language: event.options.language || 'javascript',
                        };
                        this._prefixes.set(event.prefix, prefix);
                        newPrefixes.push(prefix);
                    }

                    enqueueAsyncResult(nextEvents, event, undefined);
                } catch (err) {
                    enqueueAsyncError(nextEvents, event, err);
                }
            } else if (event.type === 'build_bundle') {
                this._buildBundle(event);
            }
        }

        if (nextEvents.length > 0) {
            this._vm.sendEvents(nextEvents);
        }
        // if (newPortals.length > 0) {
        //     this._portalsDiscovered.next(newPortals);
        // }
        // if (updatedPortals.size > 0) {
        //     this._portalsUpdated.next([...updatedPortals.values()]);
        // }
        if (newPrefixes.length > 0) {
            this._prefixesDiscovered.next(newPrefixes);
        }
        if (removedPrefixes.size > 0) {
            this._prefixesRemoved.next([...removedPrefixes.values()]);
        }
    }

    private async _triggerUpdateForPortal(portal: PortalRegistration) {
        if (portal.tag === null) {
            // portal has no tag to build - it can be loaded directly as source

            portal.unprocessedBots.clear();
            portal.unprocessedTags.clear();
            portal.modules = null;

            this._sendPortalData(portal, {
                id: portal.id,
                error: null,
                source: portal.entrypoint,
                style: portal.style,
            });
        } else if (!portal.buildInProcess) {
            try {
                portal.buildInProcess = true;
                portal.unprocessedTags.clear();
                portal.unprocessedBots.clear();
                await this._buildPortal(portal);
            } finally {
                portal.buildInProcess = false;

                if (portal.unprocessedTags.size > 0) {
                    this._checkPortalAgainstUpdatedTags(
                        portal,
                        portal.unprocessedTags
                    );
                }
                if (portal.unprocessedBots.size > 0) {
                    this._checkPortalAgainstUpdatedBots(
                        portal,
                        portal.unprocessedBots
                    );
                }
            }
        }
    }

    private async _buildPortal(portal: PortalRegistration) {
        const bundle = await this._bundler.bundleTag(
            this._helper.botsState,
            portal.entrypoint,
            this.scriptPrefixes
        );

        if (portal.tag !== null) {
            portal.modules = bundle?.modules || null;

            let data: PortalData = {
                id: portal.id,
                style: portal.style,
                error: bundle?.error || null,
                source: bundle?.source || null,
            };

            if (this._vm.createEndpoint && bundle?.libraries?.casualos) {
                const port = await this._vm.createEndpoint();
                data.ports = {
                    ...(data.ports || {}),
                    casualos: port,
                };
            }

            this._sendPortalData(portal, data);

            if (bundle?.externals) {
                let newModules: ExternalModule[] = [];
                for (let mod of values(bundle.externals)) {
                    if (!this._externalModules[mod.id]) {
                        this._externalModules[mod.id] = mod;
                        newModules.push(mod);
                    }
                }

                if (newModules.length > 0) {
                    this._externalsDiscovered.next(newModules);
                }
            }
        }
    }

    private _sendPortalData(
        portal: PortalRegistration,
        portalData: PortalData
    ) {
        const oldPortal = this._portals.get(portal.id);

        if (!this._portals.has(portal.id)) {
            this._portals.set(portal.id, portalData);
            this._portalsDiscovered.next([portalData]);
        } else {
            this._portalsUpdated.next([
                {
                    oldPortal,
                    portal: portalData,
                },
            ]);
        }
    }

    private async _buildBundle(event: BuildBundleAction) {
        let events: BotAction[] = [];
        try {
            const bundle = await this._bundler.bundleTag(
                this._helper.botsState,
                event.tag,
                this.scriptPrefixes
            );
            enqueueAsyncResult(events, event, bundle);
        } catch (err) {
            enqueueAsyncError(events, event, err);
        }

        if (events.length > 0) {
            this._vm.sendEvents(events);
        }
    }

    private _getTrimmedPortalTag(
        tag: string,
        scriptPrefixes = this.scriptPrefixes
    ) {
        const prefixes = scriptPrefixes.map((p) => p.prefix);
        return trimPortalScript(prefixes, tag);
    }

    unsubscribe(): void {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}

/**
 * Defines data about a portal.
 */
export interface PortalData {
    /**
     * The ID of the portal.
     */
    id: string;

    /**
     * The source code that the portal should use.
     * Null if the portal currently has no source.
     */
    source: string;

    /**
     * The error the the portal ran into.
     * Null if the portal currently has no errors.
     */
    error: string;

    /**
     * The CSS styles that the portal iframe should have.
     */
    style: any;

    /**
     * The ports that should be set for the portal.
     */
    ports?: {
        [id: string]: MessagePort;
    };
}

/**
 * Defines data about a portal registration.
 */
export interface PortalRegistration {
    /**
     * The ID of the portal.
     */
    id: string;

    /**
     * The tag that should be passed to the bundler.
     */
    entrypoint: string;

    /**
     * The tag that the portal is loaded from.
     */
    tag: string;

    /**
     * The CSS styles that the portal iframe should have.
     */
    style: any;

    /**
     * The modules that affect this portal.
     * Useful for determining which tags will affect the bundle results.
     * If null then the portal has not been built yet.
     */
    modules: BundleModules | null;

    /**
     * The list of tags that have not yet been processed for this portal.
     * Used to keep track of the tags that have changed in between builds.
     */
    unprocessedTags: Set<string>;

    /**
     * The list of bot IDs that have not yet been processed for this portal.
     * Used to keep track of bots that have been removed in between builds.
     */
    unprocessedBots: Set<string>;

    /**
     * Whether there is a build for the portal in progress.
     * Automatically set to false when the current build finishes.
     */
    buildInProcess: boolean;
}

/**
 * Contains information about a portal update.
 */
export interface PortalUpdate {
    /**
     * The updated portal.
     */
    portal: PortalData;

    /**
     * The old portal.
     */
    oldPortal: PortalData;
}
