import {
    Bot,
    PrecalculatedBot,
    BotTags,
    BotsState,
    ScriptBot,
    PrecalculatedTags,
    ScriptTags,
    BOT_SPACE_TAG,
} from './Bot';
import {
    BotCalculationContext,
    BotSandboxContext,
} from './BotCalculationContext';
import {
    calculateBotValue,
    getActiveObjects,
    hasValue,
    objectsAtDimensionGridPosition,
    calculateValue,
} from './BotCalculations';
import { botUpdated, UpdateBotAction } from './BotEvents';
import { SandboxLibrary, SandboxFactory } from '../Formulas/Sandbox';
import { EvalSandbox } from '../Formulas/EvalSandbox';
import formulaLib from '../Formulas/formula-lib';
import {
    SandboxInterface,
    FilterFunction,
    BotFilterFunction,
} from '../Formulas/SandboxInterface';
import uuid from 'uuid/v4';
import sortBy from 'lodash/sortBy';
import sortedIndexBy from 'lodash/sortedIndexBy';
import { merge } from '../utils';
import { BotLookupTableHelper } from './BotLookupTableHelper';

export interface FormulaLibraryOptions {
    config?: { isBuilder: boolean; isPlayer: boolean };
    version?: {
        hash: string;
        version: string;
        major: number;
        minor: number;
        patch: number;
    };
    device?: {
        supportsAR: boolean;
        supportsVR: boolean;
    };
}

/**
 * Creates a new formula library.
 */
export function createFormulaLibrary(
    options?: FormulaLibraryOptions
): SandboxLibrary {
    const defaultOptions: FormulaLibraryOptions = {
        config: { isBuilder: false, isPlayer: false },
        version: {
            hash: null,
            version: null,
            major: null,
            minor: null,
            patch: null,
        },
        device: { supportsAR: null, supportsVR: null },
    };
    const finalOptions = merge(defaultOptions, options || {});

    return merge(formulaLib, {
        player: {
            inSheet: () => finalOptions.config.isBuilder,
            version: () => finalOptions.version,
            device: () => finalOptions.device,
        },
    });
}

/**
 * Creates a new bot calculation context.
 * @param objects The objects that should be included in the context.
 * @param lib The library JavaScript that should be used.
 */
export function createCalculationContext(
    objects: Bot[],
    userId: string = null,
    lib: SandboxLibrary = formulaLib,
    createSandbox: SandboxFactory = lib => new EvalSandbox(lib)
): BotSandboxContext {
    const context = {
        sandbox: createSandbox(lib),
        objects: objects,
        cache: new Map(),
        lookup: new BotLookupTableHelper(),
    };
    context.sandbox.interface = new SandboxInterfaceImpl(context, userId);
    return context;
}

export function createPrecalculatedContext(
    objects: PrecalculatedBot[]
): BotCalculationContext {
    const context = {
        objects: objects,
        cache: new Map(),
        lookup: new BotLookupTableHelper(),
    };
    return context;
}

/**
 * Creates a new bot calculation context from the given bots state.
 * @param state The state to use.
 * @param userId The User ID that should be used.
 * @param library The library that should be used.
 * @param createSandbox The sandbox factory that should be used.
 */
export function createCalculationContextFromState(
    state: BotsState,
    userId?: string,
    library?: SandboxLibrary,
    createSandbox?: SandboxFactory
) {
    const objects = getActiveObjects(state);
    return createCalculationContext(objects, userId, library, createSandbox);
}

class SandboxInterfaceImpl implements SandboxInterface {
    private _userId: string;
    objects: ScriptBot[];
    context: BotCalculationContext;

    get state() {
        let state: { [id: string]: ScriptBot } = {};
        for (let bot of this.objects) {
            state[bot.id] = bot;
        }

        return state;
    }

    constructor(context: BotCalculationContext, userId: string) {
        const objs = sortBy(context.objects, 'id');
        this.objects = objs.map(o => createScriptBot(context, o));
        this.context = context;
        this._userId = userId;
    }

    /**
     * Adds the given bot to the calculation context and returns a proxy for it.
     * @param bot The bot to add.
     */
    addBot(bot: Bot): ScriptBot {
        const script = createScriptBot(this.context, bot);
        const index = sortedIndexBy(this.objects, script, f => f.id);
        this.objects.splice(index, 0, script);
        return script;
    }

    /**
     * Removes the given bot from the calculation context.
     * @param bot The bot to remove.
     */
    removeBot(id: string): void {
        const index = sortedIndexBy(this.objects, { id }, f => f.id);
        this.objects.splice(index, 1);
    }

    listTagValues(tag: string, filter?: FilterFunction, extras?: any) {
        const tags = this.objects
            .map(o => this._calculateValue(o, tag))
            .filter(t => hasValue(t));
        const filtered = this._filterValues(tags, filter);
        return filtered;
    }

    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any) {
        const objs = this.objects.filter(o =>
            hasValue(this._calculateValue(o, tag))
        );
        const filtered = this._filterObjects(objs, filter, tag);
        return filtered;
    }

    listObjects(...filters: BotFilterFunction[]): ScriptBot[] {
        const filtered = this.objects.filter(o => {
            return filters.every(f => f(o));
        });

        const sortFuncs = filters
            .filter(f => typeof f.sort === 'function')
            .map(f => f.sort);
        const sorted = <ScriptBot[]>(
            (sortFuncs.length > 0 ? sortBy(filtered, ...sortFuncs) : filtered)
        );
        return sorted;
    }

    userId(): string {
        return this._userId;
    }

    getBot(id: string): ScriptBot {
        return this.listObjects(bot => bot.id === id).first() || null;
    }

    unwrapBot(bot: ScriptBot): Bot {
        if (!bot) {
            return null;
        }
        return {
            id: bot.id,
            space: bot.space,
            tags: bot.tags.toJSON(),
        };
    }

    getTag(bot: ScriptBot, tag: string): any {
        return bot.tags[tag];
    }

    setTag(bot: ScriptBot, tag: string, value: any): any {
        return (bot.tags[tag] = value);
    }

    getBotUpdates(): UpdateBotAction[] {
        const bots = this.objects;
        const updates = bots
            .filter(bot => {
                return Object.keys(bot.changes).length > 0;
            })
            .map(bot =>
                botUpdated(bot.id, {
                    tags: bot.changes,
                })
            );

        return sortBy(updates, u => u.id);
    }

    private _filterValues(values: any[], filter: FilterFunction) {
        if (filter) {
            if (typeof filter === 'function') {
                return values.filter(filter);
            } else {
                return values.filter(t => t === filter);
            }
        } else {
            return values;
        }
    }

    private _filterObjects(objs: Bot[], filter: FilterFunction, tag: string) {
        if (hasValue(filter)) {
            if (typeof filter === 'function') {
                return objs.filter(o => filter(this._calculateValue(o, tag)));
            } else {
                return objs.filter(o => this._calculateValue(o, tag) == filter);
            }
        } else {
            return objs;
        }
    }

    private _calculateValue(object: any, tag: string) {
        return calculateBotValue(this.context, object, tag);
    }
}

/**
 * Gets a mod for the bot.
 * @param calc The sandbox calculation context.
 * @param bot The bot to get the values of.
 */
function createScriptBot(calc: BotCalculationContext, bot: Bot): ScriptBot {
    if (!bot) {
        return null;
    }

    const constantTags = {
        id: bot.id,
        space: bot.space,
    };
    let changedRawTags: BotTags = {};
    let rawTags: ScriptTags = <ScriptTags>{
        ...bot.tags,
    };
    const tagsProxy = new Proxy(rawTags, {
        get(target, key: string, proxy) {
            if (key === 'toJSON') {
                return Reflect.get(target, key, proxy);
            } else if (key in changedRawTags) {
                return calculateValue(
                    <BotSandboxContext>calc,
                    bot,
                    key,
                    changedRawTags[key]
                );
            }
            return calculateBotValue(calc, bot, key);
        },
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            rawTags[key] = value;
            changedRawTags[key] = value;
            return true;
        },
    });
    const rawProxy = new Proxy(rawTags, {
        set(target, key: string, value, receiver) {
            if (key in constantTags) {
                return true;
            }
            rawTags[key] = value;
            changedRawTags[key] = value;
            return true;
        },
    });

    // Define a toJSON() function but
    // make it not enumerable so it is not included
    // in Object.keys() and for..in expressions.
    Object.defineProperty(tagsProxy, 'toJSON', {
        value: () => rawTags,
        writable: false,
        enumerable: false,

        // This is so the function can be wrapped with another proxy
        // if needed. (Like for VM2Sandbox)
        configurable: true,
    });

    let script: ScriptBot = {
        id: bot.id,
        tags: tagsProxy,
        raw: rawProxy,
        changes: changedRawTags,
    };

    Object.defineProperty(script, 'toJSON', {
        value: () => ({
            id: bot.id,
            tags: tagsProxy,
        }),
        writable: false,
        enumerable: false,

        // This is so the function can be wrapped with another proxy
        // if needed. (Like for VM2Sandbox)
        configurable: true,
    });

    if (BOT_SPACE_TAG in bot) {
        script.space = bot.space;
    }

    return script;
}
