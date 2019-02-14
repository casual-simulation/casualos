import { Atom, AtomId } from "./Atom";

/**
 * Defines a data structure that represents a causal tree.
 * That is, an efficient storage list of atoms.
 * 
 * Causal trees are acyclic by nature because if they were cyclic the nature of cause and effect would be violated.
 */
export class CausalTree<T> {

    /**
     * The weave for the tree.
     */
    wave: Weave<T>;

}
