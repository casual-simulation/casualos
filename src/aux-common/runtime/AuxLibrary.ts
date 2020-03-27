import { AuxRuntime } from './AuxRuntime';
import { AuxGlobalContext } from './AuxGlobalContext';
import { ScriptBot, hasValue, trimTag } from '../bots';
import sortBy from 'lodash/sortBy';
import { BotFilterFunction } from '../Formulas/SandboxInterface';

/**
 * Defines an interface for a library of functions and values that can be used by formulas and listeners.
 */
export interface AuxLibrary {
    api: {
        [key: string]: any;
    };
    typeDefinitions?: string;
}

type TagFilter =
    | ((value: any) => boolean)
    | string
    | number
    | boolean
    | null
    | undefined;

/**
 * Creates a library that includes the default functions and APIs.
 * @param context The global context that should be used.
 */
export function createDefaultLibrary(context: AuxGlobalContext) {
    return {
        api: {
            getBots,

            byTag,
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
        if (args.length > 0 && typeof args[0] === 'function') {
            const filtered = context.bots.filter(b => args.every(f => f(b)));

            const sortFuncs = args
                .filter(f => typeof f.sort === 'function')
                .map(f => f.sort);
            const sorted =
                sortFuncs.length > 0
                    ? sortBy(filtered, ...sortFuncs)
                    : filtered;

            return sorted;
        }

        let tag: string = args[0];
        if (typeof tag === 'undefined') {
            return context.bots.slice();
        } else if (!tag) {
            return [];
        }
        tag = trimTag(tag);
        const filter = arguments[1];

        if (hasValue(filter)) {
            if (typeof filter === 'function') {
                return context.bots.filter(b => filter(b.tags[tag]));
            } else {
                return context.bots.filter(b => b.tags[tag] === filter);
            }
        } else {
            return context.bots.filter(b => hasValue(b.tags[tag]));
        }
    }

    /**
     * Creates a filter function that checks whether bots have the given tag and value.
     * @param tag The tag to check.
     * @param filter The value or filter that the tag should match.
     *
     * @example
     * // Find all the bots with a "name" of "bob".
     * let bobs = getBots(byTag("name", "bob"));
     *
     * @example
     * // Find all bots with a height larger than 2.
     * let bots = getBots(byTag("height", height => height > 2));
     *
     * @example
     * // Find all the bots with the "test" tag.
     * let bots = getBots(byTag("test"));
     */
    function byTag(tag: string, filter?: TagFilter): BotFilterFunction {
        tag = trimTag(tag);
        if (filter && typeof filter === 'function') {
            return bot => {
                let val = bot.tags[tag];
                return hasValue(val) && filter(val);
            };
        } else if (hasValue(filter)) {
            return bot => {
                let val = bot.tags[tag];
                return hasValue(val) && filter === val;
            };
        } else if (filter === null) {
            return bot => {
                let val = bot.tags[tag];
                return !hasValue(val);
            };
        } else {
            return bot => {
                let val = bot.tags[tag];
                return hasValue(val);
            };
        }
    }
}
