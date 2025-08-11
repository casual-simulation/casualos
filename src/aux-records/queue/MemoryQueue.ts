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

import type { IQueue } from './Queue';

/**
 * Defines a job that can be added to the queue.
 */
export interface MemoryJob<T> {
    name: string;
    data: T;
}

/**
 * Defines a memory-based queue for scheduling tasks or operations.
 */
export class MemoryQueue<T> implements IQueue<T> {
    private _items: MemoryJob<T>[] = [];
    private _process: (job: MemoryJob<T>) => Promise<void>;

    constructor(process: (job: MemoryJob<T>) => Promise<void>) {
        this._process = process;
    }

    get items(): MemoryJob<T>[] {
        return this._items.slice();
    }

    /**
     * Processes the queue by executing jobs in the order they were added.
     * @param maxItems The maximum number of items to process in one go. If not specified, all items will be processed.
     */
    async processQueue(maxItems?: number): Promise<void> {
        let processedCount = 0;
        while (
            this._items.length > 0 &&
            processedCount < (maxItems ?? Infinity)
        ) {
            const item = this._items.shift();
            await this._process(item);
        }
    }

    async add(name: string, data: T): Promise<void> {
        this._items.push({ name, data });
    }
}
