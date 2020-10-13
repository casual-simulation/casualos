import { Bot, PrecalculatedBot } from './Bot';
import { BotLookupTableHelper } from './BotLookupTableHelper';
import { BotObjectsContext } from './BotObjectsContext';

/**
 * Defines an interface for objects that are able to provide the necessary information required to calculate
 * formula values and actions.
 */
export interface BotCalculationContext extends BotObjectsContext {
    /**
     * The cache that is attached to the context.
     * Useful for saving the results of operations.
     */
    cache: Map<string, any>;

    /**
     * The lookup table helper that can be used.
     */
    lookup: BotLookupTableHelper;
}

/**
 * Calculates the result of the given function - caching it if needed.
 * @param name The name of the function.
 * @param func The function to cache.
 * @param args The arguments that should be used to determine when to reuse the cached results
 */
export function cacheFunction<T>(
    calc: BotCalculationContext,
    name: string,
    func: () => T,
    ...args: (string | number | boolean)[]
): T {
    if (!calc) {
        return func();
    }
    let key = name;
    for (let arg of args) {
        key += `-${arg}`;
    }

    if (calc.cache.has(key)) {
        return calc.cache.get(key);
    }

    const result = func();
    calc.cache.set(key, result);
    return result;
}
