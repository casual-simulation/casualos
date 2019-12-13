import { ProxyBridgePartition, AuxPartitionBase } from './AuxPartition';
import {
    User,
    DeviceAction,
    RemoteAction,
    StatusUpdate,
} from '@casual-simulation/causal-trees';
import { Bot, UpdatedBot, BotAction } from '@casual-simulation/aux-common';
import { Observable, Subscription } from 'rxjs';

export class ProxyBridgePartitionImpl implements ProxyBridgePartition {
    get private(): boolean {
        return this._partition.private;
    }

    get onBotsAdded(): Observable<any[]> {
        return this._partition.onBotsAdded;
    }
    get onBotsRemoved(): Observable<string[]> {
        return this._partition.onBotsRemoved;
    }
    get onBotsUpdated(): Observable<Bot[]> {
        return this._partition.onBotsUpdated;
    }
    get onError(): Observable<any> {
        return this._partition.onError;
    }
    get onEvents(): Observable<DeviceAction[]> {
        return this._partition.onEvents;
    }
    get onStatusUpdated(): Observable<StatusUpdate> {
        return this._partition.onStatusUpdated;
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
        onEvents?: (actions: any[]) => void,
        onStatusUpdated?: (status: StatusUpdate) => void
    ): Promise<void> {
        if (onBotsAdded) {
            this._sub.add(this.onBotsAdded.subscribe(onBotsAdded));
        }
        if (onBotsRemoved) {
            this._sub.add(this.onBotsRemoved.subscribe(onBotsRemoved));
        }
        if (onBotsUpdated) {
            this._sub.add(this.onBotsUpdated.subscribe(onBotsUpdated));
        }
        if (onError) {
            this._sub.add(this.onError.subscribe(onError));
        }
        if (onEvents) {
            this._sub.add(this.onEvents.subscribe(onEvents));
        }
        if (onStatusUpdated) {
            this._sub.add(this.onStatusUpdated.subscribe(onStatusUpdated));
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
