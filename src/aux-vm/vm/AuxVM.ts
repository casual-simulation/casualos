import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    RuntimeStateVersion,
} from '@casual-simulation/aux-common';
import { StatusUpdate, DeviceAction } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';
import { Initable } from '../managers/Initable';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { AuxUser } from '../AuxUser';
import { StoredAux } from '../StoredAux';
import { ChannelActionResult } from './AuxChannel';
import { PortalEvent } from './PortalEvents';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 */
export interface AuxVM extends Initable {
    /**
     * The ID of the simulation that the VM is running.
     */
    id: string;

    /**
     * Gets the observable list of local events from the simulation.
     */
    localEvents: Observable<LocalActions[]>;

    /**
     * Gets the observable list of device events from the simulation.
     */
    deviceEvents: Observable<DeviceAction[]>;

    /**
     * Gets the observable list of portal events from the simulation.
     */
    portalEvents: Observable<PortalEvent[]>;

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
     * Sets the user that the VM should be using.
     * @param user The user.
     */
    setUser(user: AuxUser): Promise<void>;

    /**
     * Sets the authentication grant that should be used for the user.
     * @param grant The grant to use.
     */
    setGrant(grant: string): Promise<void>;

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
}
