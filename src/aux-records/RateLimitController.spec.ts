import { MemoryRateLimiter } from './MemoryRateLimiter';
import { RateLimitController } from './RateLimitController';

console.log = jest.fn();

describe('RateLimitController', () => {
    let rateLimiter: MemoryRateLimiter;
    let subject: RateLimitController;

    beforeEach(() => {
        jest.useFakeTimers();

        rateLimiter = new MemoryRateLimiter();
        subject = new RateLimitController(rateLimiter, {
            windowMs: 100,
            maxHits: 2,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('checkRateLimit()', () => {
        it('should return success if the rate limit has not been exceeded', async () => {
            const result = await subject.checkRateLimit({
                ipAddress: '123.456.789',
            });

            expect(result).toEqual({
                success: true,
            });
        });

        it('should return an unsuccessful result if the rate limit has been exceeded', async () => {
            await rateLimiter.increment('123.456.789', 2);
            const result = await subject.checkRateLimit({
                ipAddress: '123.456.789',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'rate_limit_exceeded',
                errorMessage: 'Rate limit exceeded.',
            });
        });
    });
});
