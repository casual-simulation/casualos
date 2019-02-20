import { AtomOp, Atom, AtomId } from "./Atom";
import { Weave, WeaveReference } from "./Weave";
import { AtomFactory } from "./AtomFactory";
import { AtomReducer } from "./AtomReducer";

/**
 * Defines a class that represents a Causal Tree.
 * That is, a conflict-free replicated data type. (CRDT)
 */
export class CausalTree<TOp extends AtomOp, TValue> {
    private _site: number;
    private _weave: Weave<TOp>;
    private _factory: AtomFactory<TOp>;
    private _reducer: AtomReducer<TOp, TValue>;
    private _value: TValue;

    /**
     * Gets the site that this causal tree represents.
     */
    get site() {
        return this._site;
    }

    /**
     * Gets the most recent time that this causal tree 
     * has observed.
     */
    get time() {
        return this.factory.time;
    }

    /**
     * Gets the weave stored by this tree.
     */
    get weave() {
        return this._weave;
    }

    /**
     * Gets the atom factory used by this tree.
     */
    get factory() {
        return this._factory;
    }

    /**
     * Gets the currently stored value in the tree.
     */
    get value() {
        if (this._value === null) {
            this._value = this._reducer.eval(this.weave);
        }
        return this._value;
    }

    /**
     * Creates a new Causal Tree with the given site ID.
     * @param site The ID of this site.
     * @param reducer The reducer used to convert a list of operations into a single value.
     */
    constructor(site: number, reducer: AtomReducer<TOp, TValue>) {
        this._site = site;
        this._weave = new Weave<TOp>();
        this._factory = new AtomFactory<TOp>(this._site);
        this._reducer = reducer;
        this._value = null;
    }

    /**
     * Adds the given atom to this Causal Tree's history.
     * @param atom The atom to add to the tree.
     */
    add<T extends TOp>(atom: Atom<T>): WeaveReference<T> {
        if (atom.id.site !== this._site) {
            this.factory.updateTime(atom.id.timestamp);
        }
        const ref = this.weave.insert(atom);
        this._value = null;
        return ref;
    }

    /**
     * Creates a new atom and adds it to the tree's history.
     * @param op The operation to store in the atom.
     * @param parent The parent atom.
     * @param priority The priority.
     */
    create<T extends TOp>(op: T, parent: WeaveReference<TOp> | Atom<TOp> | AtomId, priority?: number): WeaveReference<T> {
        const atom = this.factory.create(op, parent, priority);
        return this.add(atom);
    }
}