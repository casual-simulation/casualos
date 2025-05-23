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
import type { BotLookupTableHelper } from './BotLookupTableHelper';
import type { BotObjectsContext } from './BotObjectsContext';

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
