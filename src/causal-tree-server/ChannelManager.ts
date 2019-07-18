import { SubscriptionLike, Observable } from 'rxjs';
import {
    CausalTree,
    AtomOp,
    RealtimeChannelInfo,
    SiteVersionInfo,
    Atom,
    SiteInfo,
    StoredCausalTree,
    DeviceInfo,
    Event,
} from '@casual-simulation/causal-trees';

export type ChannelLoadedListener<
    TTree extends CausalTree<AtomOp, any, any>
> = (tree: TTree, info: RealtimeChannelInfo) => SubscriptionLike[];

/**
 * Defines an interface for objects that help a server manage loaded channels.
 */
export interface ChannelManager {
    /**
     * Loads the channel for the given info and returns a subscription that can be used to disconnect from the tree.
     * @param info The info that describes the channel that should be loaded.
     */
    loadChannel(info: RealtimeChannelInfo): Promise<LoadedChannel>;

    /**
     * Adds the given list of atoms to the channel and returns the ones that were added.
     * @param channel The channel.
     * @param atoms The atoms to add.
     */
    addAtoms(
        channel: LoadedChannel,
        atoms: Atom<AtomOp>[]
    ): Promise<Atom<AtomOp>[]>;

    /**
     * Sends the given list of custom events to the channel.
     * @param device The device that the events should be executed for.
     * @param channel The channel.
     * @param events The events to process.
     */
    sendEvents(
        device: DeviceInfo,
        channel: LoadedChannel,
        events: Event[]
    ): Promise<void>;

    /**
     * Updates the site version info for the given channel.
     * @param info The information about the channel.
     * @param versionInfo The version info to add.
     */
    updateVersionInfo(
        channel: LoadedChannel,
        versionInfo: SiteVersionInfo
    ): Promise<SiteVersionInfo>;

    /**
     * Requests the given site for the given channel.
     * @param channel The channel.
     * @param site The site.
     */
    requestSiteId(channel: LoadedChannel, site: SiteInfo): Promise<boolean>;

    /**
     * Requests that the given tree be imported to the server and that the server returns the full tree.
     * @param channel The channel.
     * @param stored The tree to import.
     */
    exchangeWeaves(
        channel: LoadedChannel,
        stored: StoredCausalTree<AtomOp>
    ): Promise<StoredCausalTree<AtomOp>>;

    /**
     * Registers a function that should be called whenever a causal tree is loaded.
     * The function should return a list of subscriptions that should be disposed when the tree is disposed.
     *
     * @param listener The listener to register.
     */
    whileCausalTreeLoaded<TTree extends CausalTree<AtomOp, any, any>>(
        listener: ChannelLoadedListener<TTree>
    ): SubscriptionLike;
}

export interface LoadedChannel {
    info: RealtimeChannelInfo;
    tree: CausalTree<AtomOp, any, any>;
    subscription: SubscriptionLike;
}
