import { RateLimiter } from '@casual-simulation/rate-limit-redis';
import type { ServerError } from '@casual-simulation/aux-common/Errors';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { inject, injectable } from 'inversify';

const TRACE_NAME = 'RateLimitController';

export const RateLimitConfig = Symbol.for('RateLimitConfig');

/**
 * Defines a controller that is able to handle rate limiting.
 */
@injectable()
export class RateLimitController {
    private _rateLimiter: RateLimiter;
    private _maxHits: number;

    constructor(
        @inject(RateLimiter) rateLimiter: RateLimiter,
        @inject(RateLimitConfig) config: RateLimitConfig
    ) {
        this._rateLimiter = rateLimiter;
        this._rateLimiter.init({
            windowMs: config.windowMs,
        });
        this._maxHits = config.maxHits;
    }

    /**
     * Checks that the given request is allowed to proceed due to not exceeding the rate limit.
     * @param request The request to check.
     */
    @traced(TRACE_NAME)
    async checkRateLimit(
        request: CheckRateLimitRequest
    ): Promise<CheckRateLimitResponse> {
        try {
            console.log(
                `[RateLimitController] Checking rate limit for ${request.ipAddress}.`
            );
            const hits = await this._rateLimiter.increment(request.ipAddress);

            if (hits.totalHits > this._maxHits) {
                console.log(
                    `[RateLimitController] Rate limit exceeded! (Hits: ${hits.totalHits} Limit: ${this._maxHits})`
                );
                return {
                    success: false,
                    errorCode: 'rate_limit_exceeded',
                    errorMessage: 'Rate limit exceeded.',
                    retryAfterSeconds: (hits.resetTimeMs - Date.now()) / 1000,
                    totalHits: hits.totalHits,
                };
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[RateLimitController] An error occurred while checking the rate limit.`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

export interface RateLimitConfig {
    windowMs: number;
    maxHits: number;
}

export interface CheckRateLimitRequest {
    ipAddress: string;
}

export type CheckRateLimitResponse =
    | CheckRateLimitSuccess
    | CheckRateLimitFailure;

export interface CheckRateLimitSuccess {
    success: true;
}

export interface CheckRateLimitFailure {
    success: false;
    errorCode: ServerError | 'rate_limit_exceeded';
    errorMessage: string;

    retryAfterSeconds?: number;
    totalHits?: number;
}
