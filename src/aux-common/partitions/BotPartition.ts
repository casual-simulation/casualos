import {
    MemoryPartition,
    BotPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';
import {
    MemoryPartitionConfig,
    PartitionConfig,
    MemoryPartitionInstanceConfig,
    MemoryPartitionStateConfig,
    BotPartitionConfig,
    SearchPartitionClientConfig,
} from './AuxPartitionConfig';
import { Observable, Subject } from 'rxjs';
import {
    DeviceAction,
    StatusUpdate,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    USER_ROLE,
    Action,
} from '@casual-simulation/causal-trees';
import { startWith } from 'rxjs/operators';
import flatMap from 'lodash/flatMap';
import union from 'lodash/union';
import { BotClient } from './BotClient';
import sortBy from 'lodash/sortBy';
import {
    breakIntoIndividualEvents,
    UpdatedBot,
    getActiveObjects,
    hasValue,
    BotAction,
    LoadBotsAction,
    RemoveBotAction,
    AddBotAction,
    UpdateBotAction,
    Bot,
    BotsState,
    asyncResult,
} from '../bots';
import values from 'lodash/values';

/**
 * Attempts to create a BotPartition from the given config.
 * @param config The config.
 */
export function createBotClientPartition(
    config: PartitionConfig
): BotPartition {
    if (config.type === 'bot_client') {
        return new BotPartitionImpl(config.client, config);
    }
    return undefined;
}

export class BotPartitionImpl implements BotPartition {
    private _onBotsAdded = new Subject<Bot[]>();
    private _onBotsRemoved = new Subject<string[]>();
    private _onBotsUpdated = new Subject<UpdatedBot[]>();
    private _onError = new Subject<any>();
    private _onEvents = new Subject<Action[]>();
    private _onStatusUpdated = new Subject<StatusUpdate>();

    type = 'bot' as const;
    state: BotsState;
    private: boolean;
    space: string;

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
        return 'delayed';
    }

    _client: BotClient;
    _story: string;

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded.pipe(startWith(getActiveObjects(this.state)));
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

    constructor(
        client: BotClient,
        config: BotPartitionConfig | SearchPartitionClientConfig
    ) {
        this.private = hasValue(config.private) ? config.private : true;
        this._story = config.story;
        this._client = client;
        this.state = {};
    }

    async applyEvents(events: BotAction[]): Promise<BotAction[]> {
        let finalEvents = flatMap(events, e => {
            if (e.type === 'apply_state') {
                return breakIntoIndividualEvents(this.state, e);
            } else if (e.type === 'add_bot') {
                return [e] as const;
            } else {
                return [];
            }
        });

        this._applyEvents(finalEvents);

        for (let e of events) {
            if (e.type === 'load_bots') {
                this._loadBots(e);
            } else if (e.type === 'clear_space') {
                this._clearBots();
            }
        }

        return events;
    }

    connect(): void {
        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
        });

        this._onStatusUpdated.next({
            type: 'authentication',
            authenticated: true,
        });

        this._onStatusUpdated.next({
            type: 'authorization',
            authorized: true,
        });

        this._onStatusUpdated.next({
            type: 'sync',
            synced: true,
        });
    }

    unsubscribe(): void {
        this.closed = true;
    }
    closed: boolean;

    private _applyEvents(
        events: (AddBotAction | RemoveBotAction | UpdateBotAction)[]
    ) {
        let added = [] as Bot[];
        for (let event of events) {
            if (event.type === 'add_bot') {
                added.push(event.bot);
            }
        }

        if (added.length > 0) {
            this._client.addBots(this._story, added);
        }
    }

    private async _loadBots(event: LoadBotsAction) {
        const bots = await this._client.lookupBots(this._story, event.tags);
        const sorted = sortBy(bots, b => b.id);

        if (bots.length > 0) {
            this.state = Object.assign({}, this.state);
            for (let bot of sorted) {
                bot.space = <any>this.space;
                this.state[bot.id] = bot;
            }
            this._onBotsAdded.next(sorted);
        }

        if (hasValue(event.taskId)) {
            this._onEvents.next([asyncResult(event.taskId, sorted, true)]);
        }
    }

    private async _clearBots() {
        await this._client.clearBots(this._story);

        const ids = sortBy(values(this.state).map(b => b.id));
        this.state = {};

        this._onBotsRemoved.next(ids);
    }
}
