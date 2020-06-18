import { ProxyBridgePartition, AuxPartitionBase } from './AuxPartition';
import {
    User,
    DeviceAction,
    RemoteAction,
    StatusUpdate,
    Action,
} from '@casual-simulation/causal-trees';
import { Bot, UpdatedBot, BotAction } from '../bots';
import { Observable, Subscription } from 'rxjs';

export class ProxyBridgePartitionImpl implements ProxyBridgePartition {
    get private(): boolean {
        return this._partition.private;
    }

    get realtimeStrategy() {
        return this._partition.realtimeStrategy;
    }

    get onBotsAdded(): Observable<any[]> {
        return this._partition.onBotsAdded;
    }
    get onBotsRemoved(): Observable<string[]> {
        return this._partition.onBotsRemoved;
    }
    get onBotsUpdated(): Observable<UpdatedBot[]> {
        return this._partition.onBotsUpdated;
    }
    get onError(): Observable<any> {
        return this._partition.onError;
    }
    get onEvents(): Observable<Action[]> {
        return this._partition.onEvents;
    }
    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._partition.onStatusUpdated;
    }

    get space(): string {
        return this._partition.space;
    }

    set space(value: string) {
        this._partition.space = value;
    }

    private _sub: Subscription;
    private _partition: AuxPartitionBase;

    constructor(partition: AuxPartitionBase) {
        this._partition = partition;
        this._sub = new Subscription();
    }

    applyEvents(events: BotAction[]): Promise<BotAction[]> {
        return this._partition.applyEvents(events);
    }

    async sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        if (this._partition.sendRemoteEvents) {
            await this._partition.sendRemoteEvents(events);
        }
    }

    async setUser(user: User): Promise<void> {
        if (this._partition.setUser) {
            await this._partition.setUser(user);
        }
    }

    async setGrant(grant: string): Promise<void> {
        if (this._partition.setGrant) {
            await this._partition.setGrant(grant);
        }
    }

    connect(): void {
        return this._partition.connect();
    }

    async addListeners(
        onBotsAdded?: (bot: Bot[]) => void,
        onBotsRemoved?: (bot: string[]) => void,
        onBotsUpdated?: (bots: UpdatedBot[]) => void,
        onError?: (error: any) => void,
        onEvents?: (actions: Action[]) => void,
        onStatusUpdated?: (status: StatusUpdate) => void
    ): Promise<void> {
        if (onBotsAdded) {
            this._sub.add(
                this.onBotsAdded.subscribe(bots => onBotsAdded(bots))
            );
        }
        if (onBotsRemoved) {
            this._sub.add(
                this.onBotsRemoved.subscribe(bots => onBotsRemoved(bots))
            );
        }
        if (onBotsUpdated) {
            this._sub.add(
                this.onBotsUpdated.subscribe(bots => onBotsUpdated(bots))
            );
        }
        if (onError) {
            this._sub.add(this.onError.subscribe(err => onError(err)));
        }
        if (onEvents) {
            this._sub.add(this.onEvents.subscribe(events => onEvents(events)));
        }
        if (onStatusUpdated) {
            this._sub.add(
                this.onStatusUpdated.subscribe(status =>
                    onStatusUpdated(status)
                )
            );
        }
    }

    get closed(): boolean {
        return this._partition.closed;
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this._sub.unsubscribe();
        return this._partition.unsubscribe();
    }
}
