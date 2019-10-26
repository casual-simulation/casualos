import { AtomOp, Atom } from './Atom';
import { CausalTree, CausalTreeOptions } from './CausalTree';
import { SiteVersionInfo } from './SiteVersionInfo';
import { SubscriptionLike, Observable } from 'rxjs';
import { RejectedAtom } from './RejectedAtom';
import { StatusUpdate } from './StatusUpdate';
import { DeviceAction } from './Event';

/**
 * Defines an interface for options that a realtime causal tree can accept.
 */
export interface RealtimeCausalTreeOptions extends CausalTreeOptions {
    /**
     * Specifies whether the realtime causal tree should validate the signatures of all the atoms
     * that are added to the tree. If false, then only atoms added via realtime.tree.add() will be verified.
     * If true, then atoms that are imported from the remote will be verified.
     *
     * Defaults to false.
     */
    verifyAllSignatures?: boolean;

    /**
     * The causal tree that should be loaded initially.
     */
    tree?: CausalTree<AtomOp, any, any>;
}

/**
 * Defines an interface for realtime causal trees.
 * That is, objects that can notify other components when a causal tree is updated.
 */
export interface RealtimeCausalTree<TTree extends CausalTree<AtomOp, any, any>>
    extends SubscriptionLike {
    /**
     * Gets the tree that this class is currently wrapping.
     */
    tree: TTree;

    /**
     * Gets an observable that resolves whenever this tree is updated.
     */
    onUpdated: Observable<Atom<AtomOp>[]>;

    /**
     * Gets an observable that resolves whenever an error happens in this tree.
     */
    onError: Observable<any>;

    /**
     * Gets an observable that resolves whenever an atom is rejected.
     */
    onRejected: Observable<RejectedAtom<AtomOp>[]>;

    /**
     * Gets an observable that resolves whenever the causal tree's connection status is updated.
     */
    statusUpdated: Observable<StatusUpdate>;

    /**
     * Gets an observable that resolves whenever one or more device events are recieved.
     */
    events: Observable<DeviceAction[]>;

    /**
     * Connects the causal tree.
     */
    connect(): Promise<void>;

    /**
     * Returns a promise that waits for the tree to become synced.
     */
    waitUntilSynced(): Promise<void>;

    /**
     * Gets the version info from the tree.
     */
    getVersion(): SiteVersionInfo;
}
