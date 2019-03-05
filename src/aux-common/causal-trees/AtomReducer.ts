import { AtomOp } from "./Atom";
import { Weave, WeaveReference } from "./Weave";

/**
 * Defines an interface for a reducer that can convert a weave of Atom operations
 * into a value.
 */
export interface AtomReducer<TOp extends AtomOp, TValue, TMetadata> {

    /**
     * Evaluates the weave and returns the resulting value.
     * @param weave The weave to eval.
     * @param refs The references that were just added to the weave.
     * @param value The last value that was returned from this reducer. If undefined, then this
     *              is the first time the reducer has been called this session.
     * @param meta The last metadata that was returned from this reducer. If undefined, then this
     *              is the first time the reducer has been called this session.
     */
    eval(weave: Weave<TOp>, refs: WeaveReference<TOp>[], value?: TValue, meta?: TMetadata): [TValue, TMetadata];
}