import { ProxyBridgePartition, AuxPartitionBase } from './AuxPartition';
import {
    User,
    DeviceAction,
    RemoteAction,
    StatusUpdate,
    Action,
    RemoteActions,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import { Bot, UpdatedBot, BotAction, StateUpdatedEvent } from '../bots';
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
    get onStateUpdated(): Observable<StateUpdatedEvent> {
        return this._partition.onStateUpdated;
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

    get onVersionUpdated(): Observable<CurrentVersion> {
        return this._partition.onVersionUpdated;
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

    async sendRemoteEvents(events: RemoteActions[]): Promise<void> {
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
        onStateUpdated?: (update: StateUpdatedEvent) => void,
        onError?: (error: any) => void,
        onEvents?: (actions: Action[]) => void,
        onStatusUpdated?: (status: StatusUpdate) => void,
        onVersionUpdated?: (version: CurrentVersion) => void
    ): Promise<void> {
        if (onBotsAdded) {
            this._sub.add(
                this.onBotsAdded.subscribe((bots) => onBotsAdded(bots))
            );
        }
        if (onBotsRemoved) {
            this._sub.add(
                this.onBotsRemoved.subscribe((bots) => onBotsRemoved(bots))
            );
        }
        if (onBotsUpdated) {
            this._sub.add(
                this.onBotsUpdated.subscribe((bots) => onBotsUpdated(bots))
            );
        }
        if (onStateUpdated) {
            this._sub.add(
                this.onStateUpdated.subscribe((update) =>
                    onStateUpdated(update)
                )
            );
        }
        if (onError) {
            this._sub.add(this.onError.subscribe((err) => onError(err)));
        }
        if (onEvents) {
            this._sub.add(
                this.onEvents.subscribe((events) => onEvents(events))
            );
        }
        if (onStatusUpdated) {
            this._sub.add(
                this.onStatusUpdated.subscribe((status) =>
                    onStatusUpdated(status)
                )
            );
        }
        if (onVersionUpdated) {
            this._sub.add(
                this.onVersionUpdated.subscribe((version) =>
                    onVersionUpdated(version)
                )
            );
        }
    }

    async setSpace(space: string) {
        this._partition.space = space;
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
