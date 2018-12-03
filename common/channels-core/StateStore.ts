import { Event } from "./Event";
import { Reducer } from "./Reducer";
import { ChannelInfo } from "./Channel";

/**
 * Defines an interface for objects that manage states and how events affect those states.
 */
export interface StateStore<T> {

    /**
     * Processes the given event and incorporates its changes into this state.
     * @param event 
     */
    process(event: Event): void;

    /**
     * Initializes the state store with the given state.
     * @param state The state.
     */
    init(state?: T): void;

    /**
     * Gets the state that this store currently contains.
     */
    state(): T;
}

/**
 * Defines an interface for objects that can create state stores for particular channels.
 */
export interface StateStoreFactory {

    /**
     * Creates a new state store for the given channel info.
     * @param info The info describing the channel.
     */
    create<T>(info: ChannelInfo): StateStore<T>;
}

/**
 * Defines a state store that uses a special function called a reducer to incorporate
 * new events into the state.
 */
export class ReducingStateStore<T> implements StateStore<T> {
    private _state: T;
    private _reducer: Reducer;

    constructor(defaultState: T, reducer: Reducer) {
        this._state = defaultState;
        this._reducer = reducer;
    }

    state(): T {
        return this._state;
    }

    process(event: Event): void {
        this._state = this._reducer(this._state, event);
    }

    init(state?: T): void {
        if(typeof state !== 'undefined') {
            this._state = state;
        }
    }
}