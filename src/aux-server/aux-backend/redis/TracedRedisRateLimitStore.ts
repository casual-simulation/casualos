import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import RedisRateLimitStore, {
    RateLimiterIncrementResult,
    Options,
} from '@casual-simulation/rate-limit-redis';
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
