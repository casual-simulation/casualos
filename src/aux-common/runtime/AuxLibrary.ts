import { AuxRuntime } from './AuxRuntime';
import { AuxGlobalContext } from './AuxGlobalContext';
import { ScriptBot, hasValue, trimTag } from '../bots';

/**
 * Defines an interface for a library of functions and values that can be used by formulas and listeners.
 */
export interface AuxLibrary {
    api: {
        [key: string]: any;
    };
    typeDefinitions?: string;
}

/**
 * Creates a library that includes the default functions and APIs.
 * @param context The global context that should be used.
 */
export function createDefaultLibrary(context: AuxGlobalContext): AuxLibrary {
    return {
        api: {
            getBots,
        },
    };

    /**
     * Gets a list of all the bots.
     *
     * @example
     * // Gets all the bots in the universe.
     * let bots = getBots();
     */
    function getBots(...args: any[]): ScriptBot[] {
        let tag: string = args[0];
        if (typeof tag === 'undefined') {
            return context.bots.slice();
        } else if (!tag) {
            return [];
        }
        tag = trimTag(tag);
        const filter = arguments[1];

        if (hasValue(filter)) {
            return [];
        } else {
            return context.bots.filter(b => hasValue(b.tags[tag]));
        }
    }
}
