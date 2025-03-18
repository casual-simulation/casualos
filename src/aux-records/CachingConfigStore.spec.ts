import { CachingConfigStore } from './CachingConfigStore';
import { Cache } from './Cache';
import { MemoryStore } from './MemoryStore';
import { MemoryCache } from './MemoryCache';
import {
    createTestPrivoConfiguration,
    createTestSubConfiguration,
} from './TestUtils';
import type { ModerationConfiguration } from './ModerationConfiguration';
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import type { PrivoConfiguration } from './PrivoConfiguration';

describe('CachingPolicyStore', () => {
    let inner: MemoryStore;
    let cache: MemoryCache;
    let store: CachingConfigStore;
    let originalNow: () => number;
    let nowMock: jest.Mock<number>;

    beforeEach(() => {
        originalNow = Date.now;
        nowMock = Date.now = jest.fn();

        nowMock.mockReturnValue(0);

        inner = new MemoryStore({
            subscriptions: createTestSubConfiguration(),
            privo: createTestPrivoConfiguration(),
            moderation: {
                allowUnauthenticatedReports: true,
            },
        });
        cache = new MemoryCache();
        store = new CachingConfigStore(inner, cache, 1);

        jest.spyOn(inner, 'getSubscriptionConfiguration');
        jest.spyOn(inner, 'getPrivoConfiguration');
        jest.spyOn(inner, 'getModerationConfig');
    });

    afterEach(() => {
        Date.now = originalNow;
    });

    describe('getSubscriptionConfiguration()', () => {
        it('should store the configuration in the cache', async () => {
            const result = await store.getSubscriptionConfiguration();

            expect(result).toEqual(inner.subscriptionConfiguration);

            const cached = await cache.retrieve<SubscriptionConfiguration>(
                `subscriptions`
            );

            expect(cached).toEqual(createTestSubConfiguration());
            expect(cache.items).toEqual(
                new Map([
                    [
                        `subscriptions`,
                        {
                            data: createTestSubConfiguration(),
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.getSubscriptionConfiguration).toBeCalledTimes(1);
        });

        it('should retrieve the value from the cache', async () => {
            await cache.store(`subscriptions`, createTestSubConfiguration(), 1);

            inner.subscriptionConfiguration = null;
            const result = await store.getSubscriptionConfiguration();

            expect(result).toEqual(createTestSubConfiguration());
            expect(inner.getSubscriptionConfiguration).toBeCalledTimes(0);
        });
    });

    describe('getPrivoConfiguration()', () => {
        it('should store the configuration in the cache', async () => {
            const result = await store.getPrivoConfiguration();

            expect(result).toEqual(inner.privoConfiguration);

            const cached = await cache.retrieve<PrivoConfiguration>(`privo`);

            expect(cached).toEqual(createTestPrivoConfiguration());
            expect(cache.items).toEqual(
                new Map([
                    [
                        `privo`,
                        {
                            data: createTestPrivoConfiguration(),
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.getPrivoConfiguration).toBeCalledTimes(1);
        });

        it('should retrieve the value from the cache', async () => {
            await cache.store(`privo`, createTestPrivoConfiguration(), 1);

            inner.moderationConfiguration = null;
            const result = await store.getPrivoConfiguration();

            expect(result).toEqual(createTestPrivoConfiguration());
            expect(inner.getPrivoConfiguration).toBeCalledTimes(0);
        });
    });

    describe('getModerationConfig()', () => {
        it('should store the configuration in the cache', async () => {
            const result = await store.getModerationConfig();

            expect(result).toEqual(inner.moderationConfiguration);

            const cached = await cache.retrieve<ModerationConfiguration>(
                `moderation`
            );

            expect(cached).toEqual({
                allowUnauthenticatedReports: true,
            });
            expect(cache.items).toEqual(
                new Map([
                    [
                        `moderation`,
                        {
                            data: {
                                allowUnauthenticatedReports: true,
                            },
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.getModerationConfig).toBeCalledTimes(1);
        });

        it('should retrieve the value from the cache', async () => {
            await cache.store(
                `moderation`,
                {
                    allowUnauthenticatedReports: true,
                },
                1
            );

            inner.moderationConfiguration = null;
            const result = await store.getModerationConfig();

            expect(result).toEqual({
                allowUnauthenticatedReports: true,
            });
            expect(inner.getModerationConfig).toBeCalledTimes(0);
        });
    });
});
