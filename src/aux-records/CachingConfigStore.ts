import { PrivoConfiguration } from './PrivoConfiguration';
import { Cache } from './Cache';
import { ConfigurationStore } from './ConfigurationStore';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { ModerationConfiguration } from './ModerationConfiguration';
import { traced } from './tracing/TracingDecorators';

const TRACE_NAME = 'CachingConfigStore';

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

    @traced(TRACE_NAME)
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

    @traced(TRACE_NAME)
    async getPrivoConfiguration(): Promise<PrivoConfiguration> {
        const cached = await this._cache.retrieve<PrivoConfiguration>('privo');

        if (cached) {
            return cached;
        }

        const result = await this._store.getPrivoConfiguration();
        if (result) {
            await this._cache.store('privo', result, this._cacheSeconds);
        }

        return result;
    }

    @traced(TRACE_NAME)
    async getModerationConfig(): Promise<ModerationConfiguration> {
        const cached = await this._cache.retrieve<ModerationConfiguration>(
            'moderation'
        );

        if (cached) {
            return cached;
        }

        const result = await this._store.getModerationConfig();
        if (result) {
            await this._cache.store('moderation', result, this._cacheSeconds);
        }

        return result;
    }
}
