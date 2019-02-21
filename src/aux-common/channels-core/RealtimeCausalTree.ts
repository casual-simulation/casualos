import { WeaveStore } from "./WeaveStore";
import { RealtimeChannel } from "./RealtimeChannel";
import { WeaveReference } from "./Weave";
import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";

/**
 * Defines a realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class RealtimeCausalTree<TOp extends AtomOp, T> {

    private _tree: CausalTree<TOp, T>;
    private _store: WeaveStore;
    private _channel: RealtimeChannel<WeaveReference<TOp>>;

    /**
     * Creates a new Realtime Causal Tree.
     * @param tree The tree.
     * @param store 
     * @param channel 
     */
    constructor(tree: CausalTree<TOp, T>, store: WeaveStore, channel: RealtimeChannel<WeaveReference<TOp>>) {

    }

}