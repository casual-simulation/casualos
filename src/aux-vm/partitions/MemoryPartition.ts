import { MemoryPartition } from './AuxPartition';
import { MemoryPartitionConfig, PartitionConfig } from './AuxPartitionConfig';
import {
    BotsState,
    BotAction,
    Bot,
    UpdatedBot,
    merge,
    tagsOnBot,
    AuxObject,
    hasValue,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { DeviceAction, StatusUpdate } from '@casual-simulation/causal-trees';

/**
 * Attempts to create a MemoryPartition from the given config.
 * @param config The config.
 */
export function createMemoryPartition(
    config: PartitionConfig
): MemoryPartition {
    if (config.type === 'memory') {
        return new MemoryPartitionImpl(config);
    }
    return undefined;
}

class MemoryPartitionImpl implements MemoryPartition {
    private _onBotsAdded = new Subject<Bot[]>();
    private _onBotsRemoved = new Subject<string[]>();
    private _onBotsUpdated = new Subject<UpdatedBot[]>();
    private _onError = new Subject<any>();
    private _onEvents = new Subject<DeviceAction[]>();
    private _onStatusUpdated = new Subject<StatusUpdate>();

    type = 'memory' as const;
    state: BotsState;

    get onBotsAdded(): Observable<Bot[]> {
        return this._onBotsAdded;
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

    get onEvents(): Observable<DeviceAction[]> {
        return this._onEvents;
    }

    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._onStatusUpdated;
    }

    constructor(config: MemoryPartitionConfig) {
        this.state = config.initialState;
    }

    async applyEvents(events: BotAction[]): Promise<void> {
        let added: Bot[] = [];
        let removed: string[] = [];
        let updated: UpdatedBot[] = [];
        for (let event of events) {
            if (event.type === 'add_bot') {
                this.state = Object.assign({}, this.state, {
                    [event.bot.id]: event.bot,
                });
                added.push(event.bot);
            } else if (event.type === 'remove_bot') {
                let { [event.id]: removedBot, ...state } = this.state;
                this.state = state;
                removed.push(event.id);
            } else if (event.type === 'update_bot') {
                if (!event.update.tags) {
                    continue;
                }

                let newBot = Object.assign({}, this.state[event.id]);
                let changedTags: string[] = [];
                for (let tag of tagsOnBot(event.update)) {
                    const newVal = event.update.tags[tag];
                    const oldVal = newBot.tags[tag];

                    if (newVal !== oldVal) {
                        changedTags.push(tag);
                    }

                    if (hasValue(newVal)) {
                        newBot.tags[tag] = newVal;
                    } else {
                        delete newBot.tags[tag];
                    }
                }

                this.state[event.id] = newBot;

                updated.push({
                    bot: <AuxObject>newBot,
                    tags: changedTags,
                });
            }
        }

        if (added.length > 0) {
            this._onBotsAdded.next(added);
        }
        if (removed.length > 0) {
            this._onBotsRemoved.next(removed);
        }
        if (updated.length > 0) {
            this._onBotsUpdated.next(updated);
        }
    }

    connect(): void {
        this._onStatusUpdated.next({
            type: 'connection',
            connected: true,
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
}
