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
    AuxVM,
    AuxChannelErrorType,
    ChannelActionResult,
    AuxSubVM,
    AuxChannel,
    AuxSubChannel,
} from '@casual-simulation/aux-vm/vm';
import type { SimulationOrigin } from '@casual-simulation/aux-vm';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type {
    BotAction,
    StateUpdatedEvent,
    StoredAux,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';
import type {
    LoadingProgressCallback,
    StatusUpdate,
    DeviceAction,
} from '@casual-simulation/aux-common';
import type {
    RuntimeActions,
    RuntimeStateVersion,
    AuxDevice,
} from '@casual-simulation/aux-runtime';

export class AuxVMNode implements AuxVM {
    private _channel: AuxChannel;
    private _localEvents: Subject<RuntimeActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _onError: Subject<AuxChannelErrorType>;
    private _subVMAdded: Subject<AuxSubVM>;
    private _subVMRemoved: Subject<AuxSubVM>;
    private _subVMMap: Map<
        string,
        AuxSubVM & {
            channel: AuxChannel;
        }
    >;
    private _onAuthMessage: Subject<PartitionAuthMessage>;
    private _id: string;
    private _configBotId: string;
    private _origin: SimulationOrigin;

    get id(): string {
        return this._id;
    }

    get configBotId(): string {
        return this._configBotId;
    }

    get origin() {
        return this._origin;
    }

    get localEvents(): Observable<RuntimeActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get versionUpdated(): Observable<RuntimeStateVersion> {
        return this._versionUpdated;
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

    get subVMAdded(): Observable<AuxSubVM> {
        return this._subVMAdded;
    }

    get subVMRemoved(): Observable<AuxSubVM> {
        return this._subVMRemoved;
    }

    get channel() {
        return this._channel;
    }

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
        this._onAuthMessage = new Subject();
        this._onError = new Subject<AuxChannelErrorType>();
        this._subVMAdded = new Subject();
        this._subVMRemoved = new Subject();
        this._subVMMap = new Map();
        this._onAuthMessage = new Subject();
    }

    sendEvents(events: BotAction[]): Promise<void> {
        return this._channel.sendEvents(events);
    }

    shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        return this._channel.shout(eventName, botIds, arg);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._channel.formulaBatch(formulas);
    }

    forkAux(newId: string): Promise<void> {
        return this._channel.forkAux(newId);
    }

    exportBots(botIds: string[]): Promise<StoredAux> {
        return this._channel.exportBots(botIds);
    }

    export(): Promise<StoredAux> {
        return this._channel.export();
    }

    getTags(): Promise<string[]> {
        return this._channel.getTags();
    }

    async updateDevice(device: AuxDevice): Promise<void> {
        return await this._channel.updateDevice(device);
    }

    sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return this._channel.sendAuthMessage(message);
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        return await this._channel.initAndWait(
            (e) => this._localEvents.next(e),
            (e) => this._deviceEvents.next(e),
            (state) => this._stateUpdated.next(state),
            (version) => this._versionUpdated.next(version),
            (connection) => this._connectionStateChanged.next(connection),
            (err) => this._onError.next(err),
            (channel) => this._handleAddedSubChannel(channel),
            (id) => this._handleRemovedSubChannel(id),
            (message) => this._onAuthMessage.next(message)
        );
    }

    unsubscribe(): void {
        this.closed = true;
        this._channel.unsubscribe();
    }
    closed: boolean;

    protected _createSubVM(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: AuxChannel
    ): AuxVM {
        return new AuxVMNode(id, origin, configBotId, channel);
    }

    private async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, configBotId } = await subChannel.getInfo();
        const channel = await subChannel.getChannel();

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
