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
    BotIndex,
    StoredAux,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';

import type { BotWatcher } from './BotWatcher';
import type { Observable } from 'rxjs';
import type { DeviceAction } from '@casual-simulation/aux-common';
import type { Initable } from './Initable';
import type { BotHelper } from './BotHelper';
import type { ConnectionManager } from './ConnectionManager';
import type { AuxChannelErrorType } from '../vm/AuxChannelErrorTypes';
import type { CodeLanguageManager } from './CodeLanguageManager';
import type { BotDimensionManager } from './BotDimensionManager';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

export interface SimulationOrigin {
    /**
     * The name of the record that the simulation should be loaded from.
     */
    recordName: string | null;

    /**
     * The name of the inst that the simulation should be loaded from.
     */
    inst: string | null;

    /**
     * The host for the simulation.
     */
    host?: string;

    /**
     * The kind of the simulation.
     *
     * - "default": A regular simulation with persistence over the network.
     * - "static": A simulation that persists only locally.
     * - "temp": A temporary simulation that does not persist at all.
     *
     * Defaults to "default".
     */
    kind?: 'default' | 'static' | 'temp';
}

/**
 * Defines an interface for objects that represent bot simulations.
 */
export interface Simulation extends Initable {
    /**
     * Gets the ID of the simulation that is currently being used.
     */
    id: string;

    /**
     * Gets the config bot ID for the simulation.
     */
    get configBotId(): string;

    /**
     * Whether the simulation is a sub-simulation.
     */
    get isSubSimulation(): boolean;

    /**
     * Gets whether the app is connected to the inst but may
     * or may not be synced to the inst.
     */
    isOnline: boolean;

    /**
     * Gets whether the app is synced to the inst.
     */
    isSynced: boolean;

    /**
     * Gets the bot helper.
     */
    helper: BotHelper;

    /**
     * Gets the index for the bots.
     */
    index: BotIndex;

    /**
     * Gets a helper that makes it easy to search for
     * and receive updates on dimensions.
     */
    dimensions: BotDimensionManager;

    /**
     * Gets the bot watcher.
     */
    watcher: BotWatcher;

    /**
     * Gets the manager in charge of the inst connection status.
     */
    connection: ConnectionManager;

    /**
     * Gets the manager in charge of code services.
     */
    code: CodeLanguageManager;

    /**
     * Gets the observable list of events that should have an effect on the UI.
     */
    localEvents: Observable<RuntimeActions>;

    /**
     * Gets the observable list of events that were received from a remote device.
     */
    deviceEvents: Observable<DeviceAction>;

    /**
     * Gets the observable list of errors from the simulation.
     */
    onError: Observable<AuxChannelErrorType>;

    /**
     * Gets the observable list of auth messages to and from the simulation.
     */
    onAuthMessage: Observable<PartitionAuthMessage>;

    /**
     * Gets the observable list of sub simulations that have been added.
     */
    onSubSimulationAdded: Observable<Simulation>;

    /**
     * Gets the observable list of sub simulations that have been removed.
     */
    onSubSimulationRemoved: Observable<Simulation>;

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    forkAux(forkName: string): Promise<void>;

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
     * Sends the given auth message to the simulation.
     * @param message The message.
     */
    sendAuthMessage(message: PartitionAuthMessage): Promise<void>;
}
