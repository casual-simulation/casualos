import { AtomOp, Atom } from "./Atom";
import { Weave } from "./Weave";
import { AtomFactory } from "./AtomFactory";

/**
 * Defines a class that represents a Causal Tree.
 * That is, a conflict-free replicated data type. (CRDT)
 */
export class CausalTree<T extends AtomOp> {
    private _site: number;
    private _weave: Weave<T>;
    private _factory: AtomFactory<T>;

    /**
     * Gets the site that this causal tree represents.
     */
    public get site() {
        return this._site;
    }

    /**
     * Gets the most recent time that this causal tree 
     * has observed.
     */
    public get time() {
        return this.factory.time;
    }

    /**
     * Gets the weave stored by this tree.
     */
    protected get weave() {
        return this._weave;
    }

    /**
     * Gets the atom factory used by this tree.
     */
    protected get factory() {
        return this._factory;
    }

    /**
     * Creates a new Causal Tree with the given site ID.
     * @param site 
     */
    constructor(site: number) {
        this._site = site;
        this._weave = new Weave<T>();
        this._factory = new AtomFactory<T>(this._site);
    }

    /**
     * Adds the given atom to this Causal Tree's history.
     * @param atom The atom to add to the tree.
     */
    insert(atom: Atom<T>) {
        this.factory.updateTime(atom.id.timestamp);
        this.weave.insert(atom);
    }

}