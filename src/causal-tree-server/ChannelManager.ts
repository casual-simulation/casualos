import { SubscriptionLike } from 'rxjs';
import {
    CausalTree,
    AtomOp,
    RealtimeChannelInfo,
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
    loadChannel<TTree extends CausalTree<AtomOp, any, any>>(
        info: RealtimeChannelInfo
    ): Promise<LoadedChannel<TTree>>;

    /**
     * Registers a function that should be called whenever a causal tree is loaded.
     * The function should return a list of subscriptions that should be disposed when the tree is disposed.
     *
     * @param listener The listener to register.
     */
    whileCausalTreeLoaded<TTree extends CausalTree<AtomOp, any, any>>(
        listener: ChannelLoadedListener
    ): SubscriptionLike;
}

export interface LoadedChannel<TTree> {
    tree: TTree;
    subscription: SubscriptionLike;
}
