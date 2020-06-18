import {
    BotsState,
    Bot,
    UpdatedBot,
    merge,
    ProxyClientPartitionConfig,
    ProxyClientPartition,
    ProxyBridgePartition,
    AuxPartitionRealtimeStrategy,
} from '@casual-simulation/aux-common';
import {
    DeviceAction,
    StatusUpdate,
    Action,
} from '@casual-simulation/causal-trees';
import { Observable, Subject, Subscription } from 'rxjs';
import { wrap, proxy, releaseProxy, Remote } from 'comlink';
import { startWith } from 'rxjs/operators';
import values from 'lodash/values';

/**
 * Attempts to create a proxy client partition that is loaded from a remote server.
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
    private _onError: Subject<any>;
    private _onEvents: Subject<Action[]>;
    private _onStatusUpdated: Subject<StatusUpdate>;
    private _proxies: readonly any[];
    private _sub: Subscription;

    space: string;
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
        this._onError = new Subject<any>();
        this._onEvents = new Subject<Action[]>();
        this._onStatusUpdated = new Subject<StatusUpdate>();
    }

    async init(): Promise<void> {
        const proxies = [
            proxy((bots: Bot[]) => this._handleOnBotsAdded(bots)),
            proxy((bots: string[]) => this._handleOnBotsRemoved(bots)),
            proxy((bots: UpdatedBot[]) => this._handleOnBotsUpdated(bots)),
            proxy((error: any) => this._onError.next(error)),
            proxy((events: Action[]) => this._onEvents.next(events)),
            proxy((status: StatusUpdate) => this._onStatusUpdated.next(status)),
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

    applyEvents(events: any[]): Promise<any[]> {
        // Unwrap the nested promise
        // (technically gets unwrapped automatically, but this
        //  fixes a return type issue)
        return this._bridge.applyEvents(events).then(a => a);
    }

    async sendRemoteEvents(events: any[]): Promise<void> {
        if (this._bridge.sendRemoteEvents) {
            await this._bridge.sendRemoteEvents(events);
        }
    }

    async setUser(user: any): Promise<void> {
        if (this._bridge.setUser) {
            await this._bridge.setUser(user);
        }
    }

    async setGrant(grant: string): Promise<void> {
        if (this._bridge.setGrant) {
            await this._bridge.setGrant(grant);
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
