import {Event} from './Event';

/**
 * Defines an interface for a function which accepts the previous state,
 * and an event, and returns the new state. 
 */
export interface Reducer {

    /**
     * A function that applies the given event to the previous state
     * and returns the new state.
     */
    (previousState: any, event: any): any;
}