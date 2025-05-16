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
import type { AuxConfig } from './AuxConfig';
import type { AuxChannelErrorType } from './AuxChannelErrorTypes';
import type { Observable, SubscriptionLike } from 'rxjs';
import type {
    AuxDevice,
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import type {
    BotAction,
    DeviceAction,
    PartitionAuthMessage,
    StateUpdatedEvent,
    StatusUpdate,
    StoredAux,
} from '@casual-simulation/aux-common';

/**
 * Defines an interface for the static members of an AUX.
 */
export interface AuxStatic {
    /**
     * Creates a new AUX using the given config.
     */
    new (defaultHost: string, config: AuxConfig): AuxChannel;
}

/**
 * Defines an interface for an AUX.
 * That is, a channel that interfaces with the AUX bot format in realtime.
 */
export interface AuxChannel extends SubscriptionLike {
    /**
     * The observable that should be triggered whenever a device event is sent to the AUX.
     */
    onDeviceEvents: Observable<DeviceAction[]>;

    /**
     * The observable that should be triggered whenever a local event is emitted from the AUX.
     */
    onLocalEvents: Observable<RuntimeActions[]>;

    /**
     * The observable that should be triggered whenever the bots state is updated.
     */
    onStateUpdated: Observable<StateUpdatedEvent>;

    /**
     * The observable that should be triggered whenever the state version updated.
     */
    onVersionUpdated: Observable<RuntimeStateVersion>;

    /**
     * The observable that should be triggered whenever the connection state changes.
     */
    onConnectionStateChanged: Observable<StatusUpdate>;

    /**
     * The observable that is resolved whenever an error occurs.
     */
    onError: Observable<AuxChannelErrorType>;

    /**
     * The observable that is resolved whenever an auth message is sent from a partition.
     */
    onAuthMessage: Observable<PartitionAuthMessage>;

    /**
     * The observable that is triggered whenever a sub channel has been added.
     */
    onSubChannelAdded: Observable<AuxSubChannel>;

    /**
     * The observable that is triggered whenever a sub channel has been removed.
     */
    onSubChannelRemoved: Observable<string>;

    /**
     * Initializes the AUX.
     * @param onLocalEvents The callback that should be triggered whenever a local event is emitted from the AUX.
     * @param onDeviceEvents The callback that should be triggered whenever a device event it emitted from the AUX.
     * @param onStateUpdated The callback that should be triggered whenever the bots state is updated.
     * @param onConnectionStateChanged The callback that should be triggered whenever the connection state changes.
     * @param onError The callback that should be triggered whenever an error occurs.
     * @param onSubChannelAdded The callback that should be triggered whenever a sub channel is added.
     * @param onSubChannelRemoved The callback that should be triggered whenever a sub channel is removed.
     * @param onAuthMessage The callback that should be triggered whenever an auth message is sent from a partition.
     */
    init(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void,
        onAuthMessage?: (message: PartitionAuthMessage) => void
    ): Promise<void>;

    /**
     * Initializes the AUX and waits for the connection to be initialized.
     * @param onLocalEvents The callback that should be triggered whenever a local event is emitted from the AUX.
     * @param onDeviceEvents The callback that should be triggered whenever a device event it emitted from the AUX.
     * @param onStateUpdated The callback that should be triggered whenever the bots state is updated.
     * @param onConnectionStateChanged The callback that should be triggered whenever the connection state changes.
     * @param onError The callback that should be triggered whenever an error occurs.
     * @param onSubChannelAdded The callback that should be triggered whenever a sub channel is added.
     * @param onSubChannelRemoved The callback that should be triggered whenever a sub channel is removed.
     * @param onAuthMessage The callback that should be triggered whenever an auth message is sent from a partition.
     */
    initAndWait(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void,
        onAuthMessage?: (message: PartitionAuthMessage) => void
    ): Promise<void>;

    /**
     * Registers the given listeners with the channel.
     * @param onLocalEvents The callback that should be triggered whenever a local event is emitted from the AUX.
     * @param onDeviceEvents The callback that should be triggered whenever a device event it emitted from the AUX.
     * @param onStateUpdated The callback that should be triggered whenever the bots state is updated.
     * @param onConnectionStateChanged The callback that should be triggered whenever the connection state changes.
     * @param onError The callback that should be triggered whenever an error occurs.
     * @param onSubChannelAdded The callback that should be triggered whenever a sub channel is added.
     * @param onSubChannelRemoved The callback that should be triggered whenever a sub channel is removed.
     * @param onAuthMessage The callback that should be triggered whenever an auth message is sent from a partition.
     */
    registerListeners(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void,
        onAuthMessage?: (message: PartitionAuthMessage) => void
    ): Promise<void>;

    /**
     * Sends the given list of bots events to the AUX for processing.
     * @param events The events.
     */
    sendEvents(events: BotAction[]): Promise<void>;

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * Returns the results from the event.
     * @param eventName The name of the event.
     * @param botIds The IDs of the bots that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult>;

    /**
     * Runs the given list of formulas.
     * @param formulas The formulas.
     */
    formulaBatch(formulas: string[]): Promise<void>;

    /**
     * Forks the AUX into the channel with the given ID.
     * @param newId The ID that the new AUX should have.
     */
    forkAux(newId: string): Promise<void>;

    /**
     * Exports the atoms for the given bots.
     * @param botIds The bots to export.
     */
    exportBots(botIds: string[]): Promise<StoredAux>;

    /**
     * Exports the causal tree for the simulation.
     */
    export(): Promise<StoredAux>;

    /**
     * Gets the list of tags that are in use.
     */
    getTags(): Promise<string[]>;

    /**
     * Updates the device information for the simulation.
     * @param device The device.
     */
    updateDevice(device: AuxDevice): Promise<void>;

    /**
     * Sends the given auth message.
     * @param message The message to send.
     */
    sendAuthMessage(message: PartitionAuthMessage): Promise<void>;
}

export interface ChannelActionResult {
    /**
     * The actions that were queued.
     */
    actions: RuntimeActions[];

    /**
     * The results from the scripts that were run.
     */
    results: any[];
}

/**
 * Defines an interface for a subchannel.
 */
export interface AuxSubChannel {
    /**
     * The sub channel.
     */
    getChannel(): Promise<AuxChannel>;

    /**
     * Gets the info for the sub channel.
     */
    getInfo(): Promise<AuxSubChannelInfo>;
}

export interface AuxSubChannelInfo {
    /**
     * The ID of the sub channel.
     */
    id: string;

    /**
     * The ID of the config bot.
     */
    configBotId: string;
}
