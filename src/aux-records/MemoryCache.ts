import { injectable } from 'inversify';
import type { Cache } from './Cache';

/**
 * Defines a cache that stores data in memory.
 */
@injectable()
export class MemoryCache implements Cache {
    private _items: Map<string, CacheEntry> = new Map();

    get items() {
        return this._items;
    }

    async store<T>(key: string, data: T, expireSeconds: number): Promise<void> {
        this._items.set(key, {
            data: data,
            expireTimeMs: Date.now() + expireSeconds * 1000,
        });
    }

    async retrieve<T>(key: string): Promise<T> {
        const item = this._items.get(key);
        if (item) {
            if (item.expireTimeMs < Date.now()) {
                this._items.delete(key);
            } else {
                return item.data;
            }
        }
        return undefined;
    }

    async remove(key: string): Promise<void> {
        this._items.delete(key);
    }

    async clear(): Promise<void> {
        this._items.clear();
    }
}

export interface CacheEntry {
    data: any;
    expireTimeMs: number;
}
