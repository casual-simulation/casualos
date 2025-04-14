/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Cache } from './Cache';

/**
 * Defines a cache that stores data in memory.
 */
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
