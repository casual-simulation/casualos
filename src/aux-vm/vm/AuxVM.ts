import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    StoredAux,
    ConnectionIndicator,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';
import { StatusUpdate, DeviceAction } from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';
import { Initable } from '../managers/Initable';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { ChannelActionResult } from './AuxChannel';
import {
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 */
export interface AuxVM extends Initable {
    /**
     * The ID of the simulation that the VM is running.
     */
    get id(): string;

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
