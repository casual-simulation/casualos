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
import type {
    RateLimiter,
    RateLimiterIncrementResult,
    RateLimiterOptions,
} from '@casual-simulation/rate-limit-redis';

/**
 * Defines a rate limiter that stores everything in-memory.
 */
export class MemoryRateLimiter implements RateLimiter {
    private _states: Map<string, MemoryState> = new Map();

    windowMs: number = 1000;

    init(options: RateLimiterOptions): void {
        this.windowMs = options.windowMs;
    }

    async increment(
        key: string,
        amount: number = 1
    ): Promise<RateLimiterIncrementResult> {
        const state = this._getState(key);
        state.count += amount;

        return {
            totalHits: state.count,
            resetTimeMs: state.resetTimeMs,
        };
    }

    async decrement(key: string, amount?: number): Promise<void> {
        const state = this._getState(key);
        state.count += amount;
    }

    async resetKey(key: string): Promise<void> {
        this._states.delete(key);
    }

    getHits(key: string): number {
        const state = this._getState(key);
        return state.count;
    }

    private _getState(key: string): MemoryState {
        let state = this._states.get(key);
        if (!state) {
            state = {
                count: 0,
                resetTimeMs: Date.now() + this.windowMs,
            };
            this._states.set(key, state);
        }
        if (state.resetTimeMs < Date.now()) {
            state.count = 0;
            state.resetTimeMs = Date.now() + this.windowMs;
        }
        return state;
    }
}

interface MemoryState {
    count: number;
    resetTimeMs: number;
}
