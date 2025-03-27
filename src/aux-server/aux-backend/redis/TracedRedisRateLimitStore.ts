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
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type {
    RateLimiterIncrementResult,
    Options,
} from '@casual-simulation/rate-limit-redis';
import RedisRateLimitStore from '@casual-simulation/rate-limit-redis';
import { trace } from '@opentelemetry/api';

const TRACE_NAME = 'RedisRateLimitStore';

export class TracedRedisRateLimitStore extends RedisRateLimitStore {
    constructor(options: Options) {
        super(options);
    }

    @traced(TRACE_NAME)
    async loadScript(): Promise<string> {
        const sha = await super.loadScript();

        const span = trace.getActiveSpan();
        if (span) {
            span.setAttribute('script_sha', sha);
        }

        return sha;
    }

    @traced(TRACE_NAME)
    increment(
        key: string,
        amount?: number
    ): Promise<RateLimiterIncrementResult> {
        return super.increment(key, amount);
    }

    @traced(TRACE_NAME)
    decrement(key: string, amount?: number): Promise<void> {
        return super.decrement(key, amount);
    }

    @traced(TRACE_NAME)
    resetKey(key: string): Promise<void> {
        return super.resetKey(key);
    }
}
