import { AuxConfig } from './AuxConfig';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { Observable, SubscriptionLike } from 'rxjs';
import {
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import {
    BotAction,
    ConnectionIndicator,
    DeviceAction,
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
    new (
        defaultHost: string,
        indicator: ConnectionIndicator,
        config: AuxConfig
    ): AuxChannel;
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
     */
    init(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void
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
     */
    initAndWait(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void
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
     */
    registerListeners(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void
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
     * The connection indicator to use for the sub channel.
     */
    indicator: ConnectionIndicator;
}
