import { Cache } from './Cache';
import { ConfigurationStore } from './ConfigurationStore';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';

/**
 * Defines a config store that uses a cache.
 */
export class CachingConfigStore implements ConfigurationStore {
    private _store: ConfigurationStore;
    private _cache: Cache;
    private _cacheSeconds: number;

    /**
     * Creates a new CachingConfigStore.
     * @param store The store.
     * @param cache The cache.
     * @param cacheSeconds The number of seconds that cache entries should be stored.
     */
    constructor(store: ConfigurationStore, cache: Cache, cacheSeconds: number) {
        this._store = store;
        this._cache = cache;
        this._cacheSeconds = cacheSeconds;
    }

    async getSubscriptionConfiguration(): Promise<SubscriptionConfiguration> {
        const cached = await this._cache.retrieve<SubscriptionConfiguration>(
            'subscriptions'
        );

        if (cached) {
            return cached;
        }

        const result = await this._store.getSubscriptionConfiguration();
        if (result) {
            await this._cache.store(
                'subscriptions',
                result,
                this._cacheSeconds
            );
        }

        return result;
    }
}
