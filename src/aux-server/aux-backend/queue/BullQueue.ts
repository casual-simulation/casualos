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

import type { IQueue } from '@casual-simulation/aux-records/queue';
import type { Queue } from 'bullmq';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';

/**
 * Defines a thin wrapper around a BullMQ queue.
 */
export class BullQueue<T> implements IQueue<T>, SubscriptionLike {
    private _queue: Queue;
    private _sub: Subscription;

    get queue(): Queue {
        return this._queue;
    }

    constructor(queue: Queue) {
        this._sub = new Subscription();
        this._queue = queue;

        this._sub.add(() => {
            this._queue?.close().then(
                () => {
                    console.log('BullMQ queue closed successfully.');
                },
                (err) => {
                    console.error('Error closing BullMQ queue:', err);
                }
            );
            this._queue = null;
        });
    }

    async add(name: string, data: T): Promise<void> {
        await this._queue.add(name, data);
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}
