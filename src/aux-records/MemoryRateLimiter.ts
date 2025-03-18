import type {
    RateLimiter,
    RateLimiterIncrementResult,
} from '@casual-simulation/rate-limit-redis';
import { RateLimiterOptions } from '@casual-simulation/rate-limit-redis';
import { inject, injectable } from 'inversify';

/**
 * Defines a rate limiter that stores everything in-memory.
 */
@injectable()
export class MemoryRateLimiter implements RateLimiter {
    private _states: Map<string, MemoryState> = new Map();

    windowMs: number = 1000;

    init(@inject(RateLimiterOptions) options: RateLimiterOptions): void {
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
