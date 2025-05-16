/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Observable, SubscriptionLike } from 'rxjs';
import { merge, Subject, Subscription } from 'rxjs';
import { startWith, tap, map } from 'rxjs/operators';
import type { AuxVM } from '../vm/AuxVM';
import type {
    BotActions,
    DefineGlobalBotAction,
    RegisterPrefixOptions,
} from '@casual-simulation/aux-common';
import {
    DNA_TAG_PREFIX,
    enqueueAsyncError,
    enqueueAsyncResult,
    hasValue,
    getScriptPrefix,
    KNOWN_TAG_PREFIXES,
    LIBRARY_SCRIPT_PREFIX,
} from '@casual-simulation/aux-common';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

/**
 * Defines an interface that represents a script prefix.
 * That is, a prefix that indicates the value should be treated as a particular language.
 */
export interface ScriptPrefix {
    /**
     * The prefix.
     */
    prefix: string;

    /**
     * The language that values should be treated as.
     */
    language: RegisterPrefixOptions['language'];

    /**
     * Whether the prefix is a builtin value.
     */
    isDefault?: boolean;

    /**
     * Whether the prefix should be treated as a fallback.
     * That is, values that are imported using it will be imported verbatim.
     */
    isFallback?: boolean;

    /**
     * The name of the prefix.
     */
    name?: string;
}

/**
 * The list of default script prefixes.
 */
export const DEFAULT_SCRIPT_PREFIXES: ScriptPrefix[] = [
    {
        prefix: '@',
        language: 'typescript',
        isDefault: true,
    },
    {
        prefix: LIBRARY_SCRIPT_PREFIX,
        language: 'typescript',
        isDefault: true,
    },
    {
        prefix: DNA_TAG_PREFIX,
        language: 'json',
        isDefault: true,
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

    get prefixes(): string[] {
        return [
            ...KNOWN_TAG_PREFIXES,
            ...this.scriptPrefixes.map((p) => p.prefix),
        ];
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

    getScriptPrefix(value: string): string {
        return (
            getScriptPrefix(KNOWN_TAG_PREFIXES, value) ??
            getScriptPrefix(
                this.scriptPrefixes.map((p) => p.prefix),
                value
            )
        );
    }

    private _onLocalEvents(events: RuntimeActions[]): void {
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

                        if (hasValue(event.options.name)) {
                            prefix.name = event.options.name;
                        }
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
