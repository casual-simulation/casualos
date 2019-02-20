import { AtomOp } from "./Atom";
import { Weave, WeaveReference } from "./Weave";

/**
 * Defines an interface for objects that are able to store weaves.
 */
export interface WeaveStore {

    /**
     * Runs any needed setup.
     */
    init(): Promise<void>;

    /**
     * Updates the weave stored under the given ID with the new weave.
     * @param id The ID that the weave should be stored under.
     * @param weave The weave references to store.
     */
    update<T extends AtomOp>(id: string, weave: WeaveReference<T>[]): Promise<void>;

    /**
     * Gets the list of weave references stored under the given ID.
     * @param id The ID that the weave is stored under.
     */
    get<T extends AtomOp>(id: string): Promise<WeaveReference<T>[]>;

}