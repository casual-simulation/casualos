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
import { SqliteMetricsStore } from './SqliteMetricsStore';

describe('SqliteMetricsStore AI chat periods', () => {
    it.each([
        [null, null, {}],
        [100, 200, { gte: 100, lt: 200 }],
        [0, 200, { gte: 0, lt: 200 }],
    ])('handles period %s to %s', async (start, end, expected) => {
        const aggregate = jest.fn().mockResolvedValue({ _sum: { tokens: 7 } });
        const store = new SqliteMetricsStore(
            { aiChatMetrics: { aggregate } } as any,
            {} as any
        );
        jest.spyOn(store, 'getSubscriptionRecordMetrics').mockResolvedValue({
            currentPeriodStartMs: start,
            currentPeriodEndMs: end,
        } as any);
        const result = await store.getSubscriptionAiChatMetrics({
            ownerId: 'user',
        });
        const query = JSON.parse(JSON.stringify(aggregate.mock.calls[0][0]));
        expect(query.where).toEqual({ userId: 'user', createdAt: expected });
        expect(result.totalTokensInCurrentPeriod).toBe(7);
    });
});
