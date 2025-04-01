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
import { MemoryRateLimiter } from './MemoryRateLimiter';
import { RateLimitController } from './RateLimitController';

console.log = jest.fn();

describe('RateLimitController', () => {
    let rateLimiter: MemoryRateLimiter;
    let subject: RateLimitController;

    beforeEach(() => {
        jest.useFakeTimers({
            now: 0,
        });

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
                retryAfterSeconds: 0.1,
                totalHits: 3,
            });
        });

        it('should return an successful result if the extra request is outside the rate limit window', async () => {
            await rateLimiter.increment('123.456.789', 10);
            jest.advanceTimersByTime(101);
            const result = await subject.checkRateLimit({
                ipAddress: '123.456.789',
            });

            expect(result).toEqual({
                success: true,
            });
        });
    });
});
