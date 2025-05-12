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
    StateUpdatedEvent,
    StoredAux,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';

import type { StatusUpdate, DeviceAction } from '@casual-simulation/aux-common';
import type { Observable } from 'rxjs';
import type { Initable } from '../managers/Initable';
import type { AuxChannelErrorType } from './AuxChannelErrorTypes';
import type { ChannelActionResult } from './AuxChannel';
import type {
    AuxDevice,
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import type { SimulationOrigin } from '../managers/Simulation';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 */
export interface AuxVM extends Initable {
    /**
     * The ID of the simulation that the VM is running.
     */
    get id(): string;

    /**
     * Gets the origin of the simulation.
     */
    get origin(): SimulationOrigin;

    /**
     * The ID of the config bot that the VM will create.
     */
    get configBotId(): string;

    /**
     * Gets the observable list of local events from the simulation.
     */
    localEvents: Observable<RuntimeActions[]>;

    /**
     * Gets the observable list of device events from the simulation.
     */
    deviceEvents: Observable<DeviceAction[]>;

    /**
     * Gets the observable list of state updates from the simulation.
     */
    stateUpdated: Observable<StateUpdatedEvent>;

    /**
     * Gets the observable list of version updates from the simulation.
     */
    versionUpdated: Observable<RuntimeStateVersion>;

    /**
     * Gets an observable that resolves whenever the connection state changes.
     */
    connectionStateChanged: Observable<StatusUpdate>;

    /**
     * Gets an observable that resolves whenever an error occurs inside the VM.
     */
    onError: Observable<AuxChannelErrorType>;

    /**
     * Gets an observable that resolves whenever an auth message is sent from a partition.
     */
    onAuthMessage: Observable<PartitionAuthMessage>;

    /**
     * Gets an observable that resolves whenever a VM is added.
     */
    subVMAdded: Observable<AuxSubVM>;

    /**
     * Gets an observable that resolves whenever a VM is removed.
     */
    subVMRemoved: Observable<AuxSubVM>;

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
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
     * Runs the given list of formulas as actions in a batch.
     * @param formulas The formulas to run.
     */
    formulaBatch(formulas: string[]): Promise<void>;

    /**
     * Forks the current AUX into the channel with the given ID.
     * @param newId The ID of the new AUX>
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
     * Gets the list of tags that are currently in use.
     */
    getTags(): Promise<string[]>;

    /**
     * Updates information about the device that is running the simulation.
     * @param device The device info.
     */
    updateDevice(device: AuxDevice): Promise<void>;

    /**
     * Creates a new MessagePort that can be used to connect to the internal aux channel.
     */
    createEndpoint?(): Promise<MessagePort>;

    /**
     * Sends the given auth message.
     * @param message The message to send.
     */
    sendAuthMessage(message: PartitionAuthMessage): Promise<void>;
}

/**
 * Defines an interface for a Sub VM.
 */
export interface AuxSubVM {
    /**
     * The sub vm.
     */
    vm: AuxVM;

    /**
     * The ID of the sub vm.
     */
    id: string;
}
