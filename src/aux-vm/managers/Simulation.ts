import {
    SimulationIdParseSuccess,
    LocalActions,
    BotIndex,
} from '@casual-simulation/aux-common';
import { BotWatcher } from './BotWatcher';
import { Observable } from 'rxjs';
import { DeviceAction } from '@casual-simulation/causal-trees';
import { Initable } from './Initable';
import { BotHelper } from './BotHelper';
import { ConnectionManager } from './ConnectionManager';
import { AuxChannelErrorType } from '../vm/AuxChannelErrorTypes';
import { CodeLanguageManager } from './CodeLanguageManager';
import { BotDimensionManager } from './BotDimensionManager';
import { StoredAux } from '../StoredAux';
import { PortalManager } from './PortalManager';

/**
 * Defines an interface for objects that represent bot simulations.
 */
export interface Simulation extends Initable {
    /**
     * Gets the ID of the simulation that is currently being used.
     */
    id: string;

    /**
     * Gets the parsed ID of the simulation.
     */
    parsedId: SimulationIdParseSuccess;

    /**
     * Gets whether the app is connected to the server but may
     * or may not be synced to the serer.
     */
    isOnline: boolean;

    /**
     * Gets whether the app is synced to the server.
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
     * Gets the manager in charge of the server connection status.
     */
    connection: ConnectionManager;

    /**
     * Gets the manager in charge of code services.
     */
    code: CodeLanguageManager;

    /**
     * Gets the manager in charge of custom portals.
     */
    portals: PortalManager;

    /**
     * Gets the observable list of events that should have an effect on the UI.
     */
    localEvents: Observable<LocalActions>;

    /**
     * Gets the observable list of events that were received from a remote device.
     */
    deviceEvents: Observable<DeviceAction>;

    /**
     * Gets the observable list of errors from the simulation.
     */
    onError: Observable<AuxChannelErrorType>;

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
}
