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
import type { RedisClientType } from 'redis';
import { RedisTempInstRecordsStore } from './RedisTempInstRecordsStore';

function createRedisMock(ttl: number = -1) {
    const multi = {
        expire: jest.fn().mockReturnThis(),
        incrBy: jest.fn().mockReturnThis(),
        persist: jest.fn().mockReturnThis(),
        rPush: jest.fn().mockReturnThis(),
        sAdd: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
    };
    const redis = {
        expire: jest.fn().mockResolvedValue(1),
        get: jest.fn(async (key: string) =>
            key.includes('/branchInfo/')
                ? JSON.stringify({ expires: true })
                : null
        ),
        multi: jest.fn(() => multi),
        persist: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        ttl: jest.fn().mockResolvedValue(ttl),
    };

    return {
        redis: redis as unknown as RedisClientType,
        multi,
    };
}

describe('RedisTempInstRecordsStore', () => {
    it('should initialize a private expiry before applying conditional Redis modes', async () => {
        const { redis } = createRedisMock();
        const store = new RedisTempInstRecordsStore(
            '/insts',
            redis,
            120,
            'NX',
            true,
            45,
            'XX'
        );

        await store.saveBranchInfo({
            recordName: 'record',
            inst: 'inst',
            branch: 'branch',
            temporary: false,
            expires: true,
            linkedInst: null,
        });

        expect(redis.expire).toHaveBeenCalledWith(
            '/insts/branchInfo/record/inst/branch',
            45
        );
    });

    it('should use the private lifetime and mode for expiring private updates', async () => {
        const { redis, multi } = createRedisMock(60);
        const store = new RedisTempInstRecordsStore(
            '/insts',
            redis,
            120,
            'NX',
            true,
            45,
            'XX'
        );

        await store.addUpdates('record', 'inst', 'branch', ['update'], 7);

        expect(multi.expire).toHaveBeenCalledWith(
            '/insts/updates/record/inst/branch',
            45,
            'XX'
        );
        expect(redis.expire).toHaveBeenCalledWith(
            '/insts/branchInfo/record/inst/branch',
            45,
            'XX'
        );
    });

    it('should keep the public lifetime and mode for public updates', async () => {
        const { redis, multi } = createRedisMock(60);
        const store = new RedisTempInstRecordsStore(
            '/insts',
            redis,
            120,
            'NX',
            true,
            45,
            'XX'
        );

        await store.addUpdates(null, 'inst', 'branch', ['update'], 7);

        expect(multi.expire).toHaveBeenCalledWith(
            '/insts/updates//inst/branch',
            120,
            'NX'
        );
    });

    it('should persist private expiring data when no lifetime is configured', async () => {
        const { redis, multi } = createRedisMock();
        const store = new RedisTempInstRecordsStore(
            '/insts',
            redis,
            120,
            'NX',
            true,
            null,
            'NX'
        );

        await store.addUpdates('record', 'inst', 'branch', ['update'], 7);

        expect(multi.persist).toHaveBeenCalledWith(
            '/insts/updates/record/inst/branch'
        );
        expect(redis.persist).toHaveBeenCalledWith(
            '/insts/branchInfo/record/inst/branch'
        );
    });
});
