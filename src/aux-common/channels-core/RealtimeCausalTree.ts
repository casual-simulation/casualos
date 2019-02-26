import { RealtimeChannel } from "./RealtimeChannel";
import { WeaveReference } from "./Weave";
import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";
import { CausalTreeStore } from "./CausalTreeStore";

/**
 * Defines a realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class RealtimeCausalTree<TOp extends AtomOp, T> {

    private _tree: CausalTree<TOp, T>;
    private _store: CausalTreeStore;
    private _channel: RealtimeChannel<WeaveReference<TOp>>;

    /**
     * Creates a new Realtime Causal Tree.
     * @param tree The tree.
     * @param store 
     * @param channel 
     */
    constructor(tree: CausalTree<TOp, T>, store: CausalTreeStore, channel: RealtimeChannel<WeaveReference<TOp>>) {

    }

}