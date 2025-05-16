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
import type {
    BotsState,
    Bot,
    UpdatedBot,
    ProxyClientPartitionConfig,
    ProxyClientPartition,
    ProxyBridgePartition,
    AuxPartitionRealtimeStrategy,
    StateUpdatedEvent,
    PrecalculatedBotsState,
} from '@casual-simulation/aux-common';
import {
    merge,
    applyUpdates,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import type {
    StatusUpdate,
    Action,
    CurrentVersion,
} from '@casual-simulation/aux-common';
import type { Observable, Subscription } from 'rxjs';
import { BehaviorSubject, Subject } from 'rxjs';
import type { Remote } from 'comlink';
import { wrap, proxy, releaseProxy } from 'comlink';
import { startWith } from 'rxjs/operators';
import { values } from 'lodash';

/**
 * Attempts to create a proxy client partition that is loaded from a remote inst.
 * @param options The options to use.
 * @param config The config to use.
 */
export async function createProxyClientPartition(
    config: ProxyClientPartitionConfig
): Promise<ProxyClientPartitionImpl> {
    if (config.type === 'proxy_client') {
        const partition = new ProxyClientPartitionImpl(config);
        await partition.init();
        return partition;
    }
    return undefined;
}

export class ProxyClientPartitionImpl implements ProxyClientPartition {
    private _bridge: Remote<ProxyBridgePartition>;
    private _onBotsAdded: Subject<Bot[]>;
    private _onBotsRemoved: Subject<string[]>;
    private _onBotsUpdated: Subject<UpdatedBot[]>;
    private _onStateUpdated: Subject<StateUpdatedEvent>;
    private _onVersionUpdated: BehaviorSubject<CurrentVersion>;
    private _onError: Subject<any>;
    private _onEvents: Subject<Action[]>;
    private _onStatusUpdated: Subject<StatusUpdate>;
    private _proxies: readonly any[];
    private _sub: Subscription;
    private _space: string;

    get space(): string {
        return this._space;
    }
    set space(value: string) {
        this._space = value;
        this._bridge.setSpace(value);
    }

    type: 'proxy_client';
    state: BotsState;
    private: boolean;
    realtimeStrategy: AuxPartitionRealtimeStrategy;

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(startWith(values(this.state)));
    }
    get onBotsRemoved(): Observable<string[]> {
        return this._onBotsRemoved;
    }
    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._onBotsUpdated;
    }
    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._onStateUpdated.pipe(
            startWith(stateUpdatedEvent(this.state))
        );
    }
    get onVersionUpdated(): Observable<CurrentVersion> {
        return this._onVersionUpdated;
    }
    get onError(): Observable<any> {
        return this._onError;
    }
    get onEvents(): Observable<Action[]> {
        return this._onEvents;
    }
    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
    }

    constructor(config: ProxyClientPartitionConfig) {
        this._bridge = wrap<ProxyBridgePartition>(config.port);
        this.private = config.private;
        this.realtimeStrategy = config.editStrategy;

        this.state = {};

        this._onBotsAdded = new Subject<Bot[]>();
        this._onBotsRemoved = new Subject<string[]>();
        this._onBotsUpdated = new Subject<UpdatedBot[]>();
        this._onStateUpdated = new Subject<StateUpdatedEvent>();
        this._onVersionUpdated = new BehaviorSubject<CurrentVersion>({
            currentSite: null,
            remoteSite: null,
            vector: {},
        });
        this._onError = new Subject<any>();
        this._onEvents = new Subject<Action[]>();
        this._onStatusUpdated = new Subject<StatusUpdate>();
    }

    async init(): Promise<void> {
        const proxies = [
            proxy((bots: Bot[]) => this._handleOnBotsAdded(bots)),
            proxy((bots: string[]) => this._handleOnBotsRemoved(bots)),
            proxy((bots: UpdatedBot[]) => this._handleOnBotsUpdated(bots)),
            proxy((update: StateUpdatedEvent) =>
                this._handleOnStateUpdated(update)
            ),
            proxy((error: any) => this._onError.next(error)),
            proxy((events: Action[]) => this._onEvents.next(events)),
            proxy((status: StatusUpdate) => this._onStatusUpdated.next(status)),
            proxy((version: CurrentVersion) =>
                this._onVersionUpdated.next(version)
            ),
        ] as const;

        this._proxies = proxies;
        await this._bridge.addListeners(...proxies);
    }

    private _handleOnBotsAdded(bots: Bot[]): void {
        let newState = Object.assign({}, this.state);
        for (let b of bots) {
            newState[b.id] = {
                ...b,
                space: <any>this.space,
            };
        }
        this.state = newState;
        this._onBotsAdded.next(bots);
    }

    private _handleOnBotsRemoved(bots: string[]): void {
        let newState = Object.assign({}, this.state);
        for (let b of bots) {
            delete newState[b];
        }
        this.state = newState;
        this._onBotsRemoved.next(bots);
    }

    private _handleOnBotsUpdated(bots: UpdatedBot[]): void {
        let newState = Object.assign({}, this.state);
        for (let b of bots) {
            const existing = newState[b.bot.id];
            newState[b.bot.id] = merge(existing, b.bot);
        }
        this.state = newState;
        this._onBotsUpdated.next(bots);
    }

    private _handleOnStateUpdated(update: StateUpdatedEvent): void {
        this.state = applyUpdates(<PrecalculatedBotsState>this.state, update);
        this._onStateUpdated.next(update);
    }

    applyEvents(events: any[]): Promise<any[]> {
        // Unwrap the nested promise
        // (technically gets unwrapped automatically, but this
        //  fixes a return type issue)
        return this._bridge.applyEvents(events).then((a) => a);
    }

    async sendRemoteEvents(events: any[]): Promise<void> {
        if (this._bridge.sendRemoteEvents) {
            await this._bridge.sendRemoteEvents(events);
        }
    }

    connect(): void {
        this._bridge.connect();
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this._bridge.unsubscribe();
        for (let p of this._proxies) {
            p[releaseProxy]();
        }
        this.closed = true;
    }

    closed: boolean;
}
