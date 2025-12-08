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

import {
    type DeviceAction,
    type StateUpdatedEvent,
    type StatusUpdate,
    type PartitionAuthMessage,
    type BotAction,
    type StoredAux,
    remapProgressPercent,
} from '@casual-simulation/aux-common';
import type {
    RuntimeActions,
    RuntimeStateVersion,
    AuxDevice,
} from '@casual-simulation/aux-runtime';
import type { SimulationOrigin } from '@casual-simulation/aux-vm/managers';
import type {
    AuxChannel,
    AuxChannelErrorType,
    AuxConfig,
    AuxSubChannel,
    AuxSubVM,
    AuxVM,
    ChannelActionResult,
} from '@casual-simulation/aux-vm/vm';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

/**
 * Defines a class that represents an AUX VM that provides no isolation or sandboxing.
 */
export default class AuxNoVM implements AuxVM {
    protected _localEvents: Subject<RuntimeActions[]>;
    protected _deviceEvents: Subject<DeviceAction[]>;
    protected _connectionStateChanged: Subject<StatusUpdate>;
    protected _stateUpdated: Subject<StateUpdatedEvent>;
    protected _versionUpdated: Subject<RuntimeStateVersion>;
    protected _onError: Subject<AuxChannelErrorType>;
    protected _subVMAdded: Subject<AuxSubVM>;
    protected _subVMRemoved: Subject<AuxSubVM>;
    protected _subVMMap: Map<string, AuxSubVM>;
    private _channel: AuxChannel;
    protected _onAuthMessage: Subject<PartitionAuthMessage>;

    protected _configBotId: string;
    protected _id: string;
    protected _origin: SimulationOrigin;

    closed: boolean;

    /**
     * The ID of the simulation.
     */
    get id(): string {
        return this._id;
    }

    get configBotId(): string {
        return this._configBotId;
    }

    /**
     * Creates a new AUX VM that provides no isolation or sandboxing.
     * @param id The ID of the inst.
     * @param origin The origin of the inst.
     * @param config The config that should be used.
     */
    constructor(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: AuxChannel
    ) {
        this._id = id;
        this._origin = origin;
        this._configBotId = configBotId;
        this._channel = channel;
        this._localEvents = new Subject<RuntimeActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._versionUpdated = new Subject<RuntimeStateVersion>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
        this._subVMAdded = new Subject();
        this._subVMRemoved = new Subject();
        this._subVMMap = new Map();
        this._onAuthMessage = new Subject();
    }

    async init(): Promise<void> {
        // if (!this._channel) {

        // }

        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._channel.init(
            (events) => this._localEvents.next(events),
            (events) => this._deviceEvents.next(events),
            (state) => this._stateUpdated.next(state),
            (version) => this._versionUpdated.next(version),
            (state) => this._connectionStateChanged.next(statusMapper(state)),
            (err) => this._onError.next(err),
            // TODO: Support sub channels properly
            (channel) => {}, //this._handleAddedSubChannel(channel),
            (id) => {}, //this._handleRemovedSubChannel(id),
            (message) => this._onAuthMessage.next(message)
        );
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this._channel) {
            this._channel.unsubscribe();
            this._channel = null;
        }
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }

    get origin(): SimulationOrigin {
        return this._origin;
    }

    get subVMAdded(): Observable<AuxSubVM> {
        return this._subVMAdded;
    }

    get subVMRemoved(): Observable<AuxSubVM> {
        return this._subVMRemoved;
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    get onAuthMessage(): Observable<PartitionAuthMessage> {
        return this._onAuthMessage;
    }

    /**
     * The observable list of events that should be produced locally.
     */
    get localEvents(): Observable<RuntimeActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    /**
     * The observable list of bot state updates from this simulation.
     */
    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get versionUpdated(): Observable<RuntimeStateVersion> {
        return this._versionUpdated;
    }

    async sendEvents(events: BotAction[]): Promise<void> {
        return await this._channel.sendEvents(events);
    }

    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        return await this._channel.shout(eventName, botIds, arg);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        return await this._channel.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<void> {
        return await this._channel.forkAux(newId);
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        return await this._channel.exportBots(botIds);
    }

    async export(): Promise<StoredAux> {
        return await this._channel.export();
    }

    async getTags(): Promise<string[]> {
        return await this._channel.getTags();
    }

    async updateDevice(device: AuxDevice): Promise<void> {
        return await this._channel.updateDevice(device);
    }

    async sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return await this._channel.sendAuthMessage(message);
    }

    protected _createSubVM(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: AuxChannel
    ): AuxVM {
        return new AuxNoVM(id, origin, configBotId, channel);
    }

    protected async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, configBotId } = await subChannel.getInfo();
        const channel = await subChannel.getChannel();

        const subVM = {
            id: id,
            vm: this._createSubVM(id, this.origin, configBotId, channel),
            channel,
        };

        this._subVMMap.set(id, subVM);
        this._subVMAdded.next(subVM);
    }

    protected async _handleRemovedSubChannel(channelId: string) {
        const vm = this._subVMMap.get(channelId);
        if (vm) {
            this._subVMMap.delete(channelId);
            this._subVMRemoved.next(vm);
        }
    }
}

export function processPartitions(config: AuxConfig): AuxConfig {
    const processed = { ...config, partitions: { ...config.partitions } };
    for (let key in processed.partitions) {
        const partition = processed.partitions[key];
        if (!partition) {
            delete processed.partitions[key];
        } else if (partition.type === 'proxy') {
            processed.partitions[key] = {
                type: 'injected',
                partition: partition.partition,
            };
        }
    }
    return config;
}
