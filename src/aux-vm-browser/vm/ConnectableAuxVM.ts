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
    BotAction,
    PartitionAuthMessage,
    StateUpdatedEvent,
    StoredAux,
} from '@casual-simulation/aux-common';
import type {
    AuxDevice,
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import type {
    AuxVM,
    AuxChannel,
    AuxChannelErrorType,
    ChannelActionResult,
} from '@casual-simulation/aux-vm/vm';
import { RemoteAuxVM } from '@casual-simulation/aux-vm-client/vm';
import type { AuxSubChannel, AuxSubVM } from '@casual-simulation/aux-vm/vm';
import type { DeviceAction, StatusUpdate } from '@casual-simulation/aux-common';
import type { Remote } from 'comlink';
import { proxy, releaseProxy, wrap } from 'comlink';
import type { Observable } from 'rxjs';
import { Subject, Subscription } from 'rxjs';
import type { SimulationOrigin } from '@casual-simulation/aux-vm/managers';

/**
 * Gets an AUX VM that is able to communicate with a proxied aux channel.
 */
export class ConnectableAuxVM implements AuxVM {
    private _localEvents: Subject<RuntimeActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _onError: Subject<AuxChannelErrorType>;
    private _subVMAdded: Subject<AuxSubVM>;
    private _subVMRemoved: Subject<AuxSubVM>;
    private _subVMMap: Map<
        string,
        AuxSubVM & {
            channel: Remote<AuxChannel>;
        }
    >;
    private _onAuthMessage: Subject<PartitionAuthMessage>;
    private _id: string;
    private _configBotId: string;

    private _proxy: Remote<AuxChannel>;
    private _port: MessagePort;
    private _sub: Subscription;
    private _origin: SimulationOrigin;

    get id() {
        return this._id;
    }

    get origin() {
        return this._origin;
    }

    get configBotId() {
        return this._configBotId;
    }

    constructor(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        port: MessagePort
    ) {
        this._id = id;
        this._origin = origin;
        this._configBotId = configBotId;
        this._proxy = wrap(port);
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

        this._sub = new Subscription(() => {
            this._proxy[releaseProxy]();
        });
    }

    get subVMAdded(): Observable<AuxSubVM> {
        return this._subVMAdded;
    }

    get subVMRemoved(): Observable<AuxSubVM> {
        return this._subVMRemoved;
    }

    createEndpoint?(): Promise<MessagePort> {
        throw new Error('Method not implemented.');
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

    async init(): Promise<void> {
        await this._proxy.registerListeners(
            proxy((events) => this._localEvents.next(events)),
            proxy((events) => this._deviceEvents.next(events)),
            proxy((state) => this._stateUpdated.next(state)),
            proxy((version) => this._versionUpdated.next(version)),
            proxy((state) => this._connectionStateChanged.next(state)),
            proxy((err) => this._onError.next(err)),
            proxy((channel) => this._handleAddedSubChannel(channel)),
            proxy((id) => this._handleRemovedSubChannel(id)),
            proxy((message) => this._onAuthMessage.next(message))
        );
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
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

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    async sendEvents(events: BotAction[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.sendEvents(events);
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * Returns the results from the event.
     * @param eventName The name of the event.
     * @param botIds The IDs of the bots that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        if (!this._proxy) return null;
        return await this._proxy.shout(eventName, botIds, arg);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.forkAux(newId);
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.export();
    }

    async getTags(): Promise<string[]> {
        if (!this._proxy) return null;
        return await this._proxy.getTags();
    }

    async updateDevice(device: AuxDevice): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.updateDevice(device);
    }

    protected _createSubVM(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: Remote<AuxChannel>
    ): AuxVM {
        return new RemoteAuxVM(id, origin, configBotId, channel);
    }

    sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return this._proxy.sendAuthMessage(message);
    }

    private async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, configBotId } = await subChannel.getInfo();
        const channel =
            (await subChannel.getChannel()) as unknown as Remote<AuxChannel>;

        const subVM = {
            id,
            vm: this._createSubVM(id, this.origin, configBotId, channel),
            channel,
        };

        this._subVMMap.set(id, subVM);
        this._subVMAdded.next(subVM);
    }

    private async _handleRemovedSubChannel(channelId: string) {
        const vm = this._subVMMap.get(channelId);
        if (vm) {
            this._subVMMap.delete(channelId);
            this._subVMRemoved.next(vm);
        }
    }
}
