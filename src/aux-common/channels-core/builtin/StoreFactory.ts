import { StateStoreFactory, StateStore } from '../StateStore';
import { ChannelInfo } from '../Channel';

/**
 * Defines an interface for an object that maps channel types
 * to individual state store factory functions.
 */
export interface StoreFactoryMap {
    [key: string]: () => StateStore<any>;
}

/**
 * Defines a class which provides a default implementation of a StateStoreFactory.
 */
export class StoreFactory implements StateStoreFactory {

    private _map: StoreFactoryMap;

    constructor(map?: StoreFactoryMap) {
        this._map = map || {};
    }

    create<T>(info: ChannelInfo): StateStore<T> {
        let factory = this._map[info.type];
        if(factory) {
            return factory();
        } else {
            throw new Error('Unable to create a factory for channel of type: "' + info.type + '. No corresponding function exists in the map.');
        }
    }
}