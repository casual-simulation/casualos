import {
    merge,
    Observable,
    Subject,
    Subscription,
    SubscriptionLike,
} from 'rxjs';
import { startWith, tap, map } from 'rxjs/operators';
import { AuxVM } from '../vm/AuxVM';
import {
    BotAction,
    BotActions,
    BotIndex,
    DNA_TAG_PREFIX,
    enqueueAsyncError,
    enqueueAsyncResult,
    hasValue,
    LocalActions,
    PrecalculatedBot,
    tagsOnBot,
    trimPortalScript,
    DefineGlobalBotAction,
} from '@casual-simulation/aux-common';
import { ScriptPrefix } from './PortalBundler';

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
    private _prefixes: Map<string, ScriptPrefix>;

    private _prefixesDiscovered: Subject<ScriptPrefix[]>;
    private _prefixesRemoved: Subject<string[]>;
    private _globalBotsDiscovered: Subject<DefineGlobalBotAction[]>;
    private _globalBots: Map<string, DefineGlobalBotAction> = new Map();
    private _vm: AuxVM;
    private _sub: Subscription;

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

    get globalBotsDiscovered(): Observable<DefineGlobalBotAction[]> {
        return this._globalBotsDiscovered.pipe(
            startWith([...this._globalBots.values()])
        );
    }

    /**
     * Gets an observable that resolves when a portal's bot ID has been updated.
     */
    get portalBotIdUpdated(): Observable<PortalBotData[]> {
        const globalBots = this.globalBotsDiscovered.pipe(
            map((bots) =>
                bots.map(
                    (b) =>
                        ({ portalId: b.name, botId: b.botId } as PortalBotData)
                )
            )
        );

        return merge(globalBots);
    }

    /**
     * Gets the script prefixes that are currently in use.
     */
    get scriptPrefixes(): ScriptPrefix[] {
        return [...this._prefixes.values()];
    }

    /**
     * Gets the map of portals that have been opened.
     */
    get portalBots() {
        return this._globalBots;
    }

    constructor(vm: AuxVM) {
        this._vm = vm;
        this._prefixes = new Map();
        this._prefixesDiscovered = new Subject();
        this._prefixesRemoved = new Subject();
        this._globalBotsDiscovered = new Subject();
        this._sub = new Subscription();

        for (let p of DEFAULT_SCRIPT_PREFIXES) {
            this._prefixes.set(p.prefix, p);
        }

        this._sub.add(
            vm.localEvents.pipe(tap((e) => this._onLocalEvents(e))).subscribe()
        );
    }

    private _onLocalEvents(events: LocalActions[]): void {
        let newPrefixes: ScriptPrefix[] = [];
        let removedPrefixes: Set<string> = new Set();
        let nextEvents: BotActions[] = [];
        let newGlobalBots: DefineGlobalBotAction[] = [];

        for (let event of events) {
            if (event.type === 'register_prefix') {
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
            } else if (event.type === 'define_global_bot') {
                this._globalBots.set(event.name, event);
                newGlobalBots.push(event);
            }
        }

        if (nextEvents.length > 0) {
            this._vm.sendEvents(nextEvents);
        }
        if (newPrefixes.length > 0) {
            this._prefixesDiscovered.next(newPrefixes);
        }
        if (removedPrefixes.size > 0) {
            this._prefixesRemoved.next([...removedPrefixes.values()]);
        }
        if (newGlobalBots.length > 0) {
            this._globalBotsDiscovered.next(newGlobalBots);
        }
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
     * The ID of the portal bot.
     */
    botId: string;

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
     * The ID of the portal bot.
     */
    botId: string;

    /**
     * The CSS styles that the portal iframe should have.
     */
    style: any;
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

/**
 * Contains information about
 */
export interface PortalBotData {
    portalId: string;
    botId: string;
}
