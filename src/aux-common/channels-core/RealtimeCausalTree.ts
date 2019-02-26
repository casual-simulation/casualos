import { RealtimeChannel } from "./RealtimeChannel";
import { WeaveReference } from "./Weave";
import { AtomOp } from "./Atom";
import { CausalTree } from "./CausalTree";
import { CausalTreeStore } from "./CausalTreeStore";
import { CausalTreeFactory } from "./CausalTreeFactory";

/**
 * Defines a realtime causal tree.
 * That is, an object that is able to keep a causal tree updated
 * based on events from a realtime channel.
 */
export class RealtimeCausalTree<TOp extends AtomOp, T> {

    private _tree: CausalTree<TOp, T>;
    private _store: CausalTreeStore;
    private _channel: RealtimeChannel<WeaveReference<TOp>>;
    private _factory: CausalTreeFactory;

    /**
     * Gets the tree that this class is currently wrapping.
     */
    get tree() {
        return this._tree;
    }

    get id() {
        return this._channel.info.id;
    }

    get type() {
        return this._channel.info.type;
    }

    /**
     * Creates a new Realtime Causal Tree.
     * @param type The type of the tree.
     * @param factory The factory used to create new trees.
     * @param store The store used to persistently store the tree.
     * @param channel The channel used to communicate with other devices.
     */
    constructor(factory: CausalTreeFactory, store: CausalTreeStore, channel: RealtimeChannel<WeaveReference<TOp>>) {
        this._factory = factory;
        this._store = store;
        this._channel = channel;
        this._tree = null;
    }

    async init(): Promise<void> {
        const stored = await this._store.get(this.id);
        if (stored) {
            this._tree = <CausalTree<TOp, T>>this._factory.create(this.type, stored);
        }
    }

}