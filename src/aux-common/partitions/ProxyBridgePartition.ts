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
    ProxyBridgePartition,
    AuxPartitionBase,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';
import type { Bot, UpdatedBot, BotAction, StateUpdatedEvent } from '../bots';
import type { Observable } from 'rxjs';
import { Subscription } from 'rxjs';
import type {
    Action,
    CurrentVersion,
    RemoteActions,
    StatusUpdate,
} from '../common';

export class ProxyBridgePartitionImpl implements ProxyBridgePartition {
    get private(): boolean {
        return this._partition.private;
    }

    get realtimeStrategy(): AuxPartitionRealtimeStrategy {
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
