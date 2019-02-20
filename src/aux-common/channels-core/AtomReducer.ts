import { AtomOp } from "./Atom";
import { Weave } from "./Weave";

/**
 * Defines an interface for a reducer that can convert a weave of Atom operations
 * into a value.
 */
export interface AtomReducer<TOp extends AtomOp, TValue> {

    /**
     * Evaluates the weave.
     * @param weave The weave to eval.
     */
    eval(weave: Weave<TOp>): TValue;
}