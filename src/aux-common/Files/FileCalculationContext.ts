import { Bot, PrecalculatedFile } from './File';
import { Sandbox, SandboxLibrary } from '../Formulas/Sandbox';

/**
 * Defines an interface for objects that are able to provide the necessary information required to calculate
 * formula values and actions.
 */
export interface FileCalculationContext {
    /**
     * The objects in the context.
     */
    objects: (Bot | PrecalculatedFile)[];

    /**
     * The cache that is attached to the context.
     * Useful for saving the results of operations.
     */
    cache: Map<number, any>;
}

/**
 * Defines an interface for objects that are able to run formulas via a sandbox.
 */
export interface FileSandboxContext extends FileCalculationContext {
    /**
     * The sandbox that should be used to run JS.
     */
    sandbox: Sandbox;
}

/**
 * Calculates the result of the given function - caching it if needed.
 * @param name The name of the function.
 * @param func The function to cache.
 * @param args The arguments that should be used to determine when to reuse the cached results
 */
export function cacheFunction<T>(
    calc: FileCalculationContext,
    name: string,
    func: () => T,
    ...args: (string | number | boolean)[]
): T {
    let hash = Math.imul(45007, hashCode(name));
    for (let arg of args) {
        hash = Math.imul(hash, 23) + hashCode(arg);
    }

    if (calc.cache.has(hash)) {
        return calc.cache.get(hash);
    }

    const result = func();
    calc.cache.set(hash, result);
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
