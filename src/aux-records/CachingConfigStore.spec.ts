import { CachingConfigStore } from './CachingConfigStore';
import { Cache } from './Cache';
import { MemoryStore } from './MemoryStore';
import { MemoryCache } from './MemoryCache';
import {
    ACCOUNT_MARKER,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    PolicyDocument,
} from '@casual-simulation/aux-common';
import { createTestSubConfiguration } from './TestUtils';

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
        });
        cache = new MemoryCache();
        store = new CachingConfigStore(inner, cache, 1);

        jest.spyOn(inner, 'getSubscriptionConfiguration');
    });

    afterEach(() => {
        Date.now = originalNow;
    });

    describe('getSubscriptionConfiguration()', () => {
        it('should store the configuration in the cache', async () => {
            const result = await store.getSubscriptionConfiguration();

            expect(result).toEqual(inner.subscriptionConfiguration);

            const cached = await cache.retrieve<PolicyDocument[]>(
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
});
