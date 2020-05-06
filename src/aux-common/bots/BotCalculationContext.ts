import { Bot, PrecalculatedBot } from './Bot';
import { Sandbox, SandboxLibrary } from '../Formulas/Sandbox';
import { BotIndex } from './BotIndex';
import { BotLookupTableHelper } from './BotLookupTableHelper';

/**
 * Defines an interface for objects that are able to provide the necessary information required to calculate
 * formula values and actions.
 */
export interface BotCalculationContext {
    /**
     * The objects in the context.
     */
    objects: (Bot | PrecalculatedBot)[];

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

function hashCode(val: string | number | boolean) {
    if (typeof val === 'string') {
        let h = 0;
        for (let i = 0; i < val.length; i++) {
            h = (Math.imul(31, h) + val.charCodeAt(i)) | 0;
        }

        return h;
    } else if (typeof val === 'number') {
        return val;
    } else {
        return val ? 1 : 0;
    }
}
