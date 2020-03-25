import { MemoryPartition, SearchPartition } from './AuxPartition';
import {
    MemoryPartitionConfig,
    PartitionConfig,
    MemoryPartitionInstanceConfig,
    MemoryPartitionStateConfig,
    SearchPartitionConfig,
    SearchPartitionClientConfig,
} from './AuxPartitionConfig';
import {
    BotsState,
    BotAction,
    Bot,
    UpdatedBot,
    merge,
    tagsOnBot,
    hasValue,
    getActiveObjects,
    AddBotAction,
    RemoveBotAction,
    UpdateBotAction,
    breakIntoIndividualEvents,
} from '@casual-simulation/aux-common';
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
import { SearchClient } from './SearchClient';

/**
 * Attempts to create a SearchPartition from the given config.
 * @param config The config.
 */
export function createSearchPartition(
    config: PartitionConfig
): SearchPartition {
    if (config.type === 'search_client') {
        return new SearchPartitionImpl(config.client, config);
    }
    return undefined;
}

class SearchPartitionImpl implements SearchPartition {
    private _onBotsAdded = new Subject<Bot[]>();
    private _onBotsRemoved = new Subject<string[]>();
    private _onBotsUpdated = new Subject<UpdatedBot[]>();
    private _onError = new Subject<any>();
    private _onEvents = new Subject<Action[]>();
    private _onStatusUpdated = new Subject<StatusUpdate>();

    type = 'search' as const;
    state: BotsState;
    private: boolean;
    _client: SearchClient;
    _universe: string;

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
        client: SearchClient,
        config: SearchPartitionConfig | SearchPartitionClientConfig
    ) {
        this.private = hasValue(config.private) ? config.private : true;
        this._universe = config.universe;
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
            this._client.addBots(this._universe, added);
        }
    }
}
