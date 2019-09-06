import { WeaveResult, Weave } from './Weave2';

/**
 * Defines a weave reducer.
 * That is, a function which accepts a weave result and the previous state, and returns the next state.
 */
export type WeaveReducer<T> = (
    weave: Weave<any>,
    result: WeaveResult,
    previous?: T
) => T;
