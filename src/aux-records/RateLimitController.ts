import { RateLimiter } from '@casual-simulation/rate-limit-redis';
import { ServerError } from 'Errors';

/**
 * Defines a controller that is able to handle rate limiting.
 */
export class RateLimitController {
    private _rateLimiter: RateLimiter;
    private _maxHits: number;

    constructor(rateLimiter: RateLimiter, config: RateLimitConfig) {
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
                };
            }

            return {
                success: true,
            };
        } catch (err) {
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
}
