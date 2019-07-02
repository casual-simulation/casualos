import { CausalTree, AtomOp } from '@casual-simulation/causal-trees';
import { SubscriptionLike } from 'rxjs';

/**
 * Defines a class that is able to serve a set causal trees over Socket.io.
 *
 */
export interface CausalTreeServer {
    /**
     * Registers a function that should be called whenever a causal tree is loaded.
     * The function should return a list of subscriptions that should be disposed when the tree is disposed.
     *
     * @param listener The listener to register.
     */
    whileCausalTreeLoaded<TTree extends CausalTree<AtomOp, any, any>>(
        listener: (tree: TTree, id: string) => SubscriptionLike[]
    ): SubscriptionLike;
}
