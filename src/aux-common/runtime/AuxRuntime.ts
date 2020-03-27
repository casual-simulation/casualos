// CasualOS has several key components:
//
// 1. Simulations - These are wrapper objects that manage creating and interfacing with AUX virtual machines.
// 2. VM - AUX Virtual Machines provide a security boundary to keep user scripts separate across multiple virtual machines.
// 3. Channel - These are manager objects which handle the persistence and runtime aspects of an AUX.
// 4. Partitions - These are services which manage the persistence and realtime sync of the AUX data model.
// 5. Runtimes - These are services which manage script execution and formula precalculation.

import {
    BotAction,
    StateUpdatedEvent,
    Bot,
    UpdatedBot,
    PrecalculatedBot,
    BotsState,
    PrecalculatedBotsState,
    hasValue,
    tagsOnBot,
    isFormula,
    isScript,
    isNumber,
    isArray,
    parseArray,
    PrecalculatedTags,
    BotSpace,
    BotTags,
    ScriptBot,
    ScriptTags,
    BOT_SPACE_TAG,
    convertToCopiableValue,
} from '../bots';
import { Observable } from 'rxjs';
import { AuxCompiler, AuxCompiledScript } from './AuxCompiler';
import { AuxGlobalContext } from './AuxGlobalContext';
import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import sortedIndexBy from 'lodash/sortedIndexBy';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime {
    private _originalState: BotsState = {};
    private _compiledState: CompiledBotsState = {};
    private _compiler = new AuxCompiler();

    private _globalContext: AuxGlobalContext = {
        allowsEditing: true,
        bots: [],
    };

    private _library: AuxLibrary;

    /**
     * Creates a new AuxRuntime using the given library factory.
     * @param libraryFactory
     */
    constructor(
        libraryFactory: (
            context: AuxGlobalContext
        ) => AuxLibrary = createDefaultLibrary
    ) {
        this._library = createDefaultLibrary(this._globalContext);
    }

    /**
     * An observable that resolves whenever the runtime issues an action.
     */
    onActions: Observable<BotAction[]>;

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * @param eventName The name of the event.
     * @param botIds The Bot IDs that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(eventName: string, botIds: string[], arg?: any): void {}

    /**
     * Executes the given script.
     * @param script The script to run.
     */
    execute(script: string): void {}

    /**
     * Signals to the runtime that the given bots were added.
     * @param bots The bots.
     */
    botsAdded(bots: Bot[]): StateUpdatedEvent {
        let update = {
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        } as StateUpdatedEvent;

        let nextOriginalState = Object.assign({}, this._originalState);

        for (let bot of bots) {
            // TODO: Make the compiled bot have a script variant
            //       for supporting writing to tags and such.
            let newBot: CompiledBot = this._createCompiledBot(bot);
            let precalculated: PrecalculatedBot = {
                id: bot.id,
                precalculated: true,
                tags: bot.tags,
                values: {},
            };

            const tags = tagsOnBot(bot);
            for (let tag of tags) {
                this._compileTag(newBot, tag, bot.tags[tag]);
            }

            for (let tag of tags) {
                precalculated.values[tag] = convertToCopiableValue(
                    this._updateTag(newBot, tag)
                );
            }

            if (hasValue(bot.space)) {
                newBot.space = bot.space;
                precalculated.space = bot.space;
            }
            nextOriginalState[bot.id] = bot;
            update.state[bot.id] = precalculated;
            update.addedBots.push(bot.id);
        }

        this._originalState = nextOriginalState;

        return update;
    }

    /**
     * Signals to the runtime that the given bots were removed.
     * @param botIds The IDs of the bots that were removed.
     */
    botsRemoved(botIds: string[]): StateUpdatedEvent {
        return null;
    }

    /**
     * Signals to the runtime that the given bots were updated.
     * @param updates The bot updates.
     */
    botsUpdated(updates: UpdatedBot[]): StateUpdatedEvent {
        return null;
    }

    private _createCompiledBot(bot: Bot): CompiledBot {
        let compiledBot: CompiledBot = {
            id: bot.id,
            precalculated: true,
            tags: bot.tags,
            listeners: {},
            values: {},
            compiledValues: {},
            script: null,
        };
        if (BOT_SPACE_TAG in bot) {
            compiledBot.space = bot.space;
        }
        compiledBot.script = this._createScriptBot(compiledBot);

        const index = sortedIndexBy(
            this._globalContext.bots,
            compiledBot.script,
            sb => sb.id
        );
        this._globalContext.bots.splice(index, 0, compiledBot.script);

        return compiledBot;
    }

    private _createScriptBot(bot: CompiledBot): ScriptBot {
        if (!bot) {
            return null;
        }
        const _this = this;

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
                }
                return bot.values[key];
            },
            set(target, key: string, value, receiver) {
                if (
                    key in constantTags ||
                    !_this._globalContext.allowsEditing
                ) {
                    return true;
                }
                rawTags[key] = value;
                changedRawTags[key] = value;
                _this._compileTag(bot, key, value);
                return true;
            },
        });
        const rawProxy = new Proxy(rawTags, {
            set(target, key: string, value, receiver) {
                if (
                    key in constantTags ||
                    !_this._globalContext.allowsEditing
                ) {
                    return true;
                }
                rawTags[key] = value;
                changedRawTags[key] = value;
                _this._compileTag(bot, key, value);
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
            value: () => {
                if ('space' in bot) {
                    return {
                        id: bot.id,
                        space: bot.space,
                        tags: tagsProxy,
                    };
                } else {
                    return {
                        id: bot.id,
                        tags: tagsProxy,
                    };
                }
            },
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

    private _updateTag(newBot: CompiledBot, tag: string): any {
        const compiled = newBot.compiledValues[tag];
        try {
            return (newBot.values[tag] =
                typeof compiled === 'function' ? compiled() : compiled);
        } catch (ex) {
            return (newBot.values[tag] = ex);
        }
    }

    private _compileTag(bot: CompiledBot, tag: string, tagValue: any) {
        bot.tags[tag] = tagValue;

        let { value, listener } = this._compileValue(bot, tag, tagValue);
        if (listener) {
            bot.listeners[tag] = listener;
        }
        bot.compiledValues[tag] = value;
        if (typeof value !== 'function') {
            bot.values[tag] = value;
        }

        return value;
    }

    private _compileValue(
        bot: CompiledBot,
        tag: string,
        value: any
    ): {
        value: any;
        listener: AuxCompiledScript;
    } {
        let listener: AuxCompiledScript;
        if (isFormula(value)) {
            value = this._compile(bot, tag, value, { allowsEditing: false });
        } else if (isScript(value)) {
            listener = this._compile(bot, tag, value, { allowsEditing: true });
        } else if (isNumber(value)) {
            value = parseFloat(value);
        } else if (value === 'true') {
            value = true;
        } else if (value === 'false') {
            value = false;
        } else if (isArray(value)) {
            const split = parseArray(value);
            let isFormula = false;
            const values = split.map(s => {
                const result = this._compileValue(bot, tag, s.trim());
                if (typeof result.value === 'function') {
                    isFormula = true;
                }
                return result;
            });

            if (isFormula) {
                // TODO: Add the proper metadata for formulas in array elements
                value = <any>(() => {
                    return values.map(v =>
                        typeof v.value === 'function' ? v.value() : v.value
                    );
                });
            } else {
                value = values.map(v => v.value);
            }
        }

        return { value, listener };
    }

    private _compile(
        bot: CompiledBot,
        tag: string,
        script: string,
        options: CompileOptions
    ) {
        return this._compiler.compile(script, {
            // TODO: Support all the weird features
            context: {
                bot,
                tag,
                global: this._globalContext,
                wasEditable: true,
            },
            before: ctx => {
                if (!options.allowsEditing) {
                    ctx.wasEditable = ctx.global.allowsEditing;
                    ctx.global.allowsEditing = false;
                }
            },
            after: ctx => {
                if (!options.allowsEditing) {
                    ctx.global.allowsEditing = ctx.wasEditable;
                }
            },
            constants: {
                ...this._library.api,
                tagName: tag,
            },
            variables: {
                this: ctx => ctx.bot.script,
                bot: ctx => ctx.bot.script,
                tags: ctx => ctx.bot.script.tags,
                raw: ctx => ctx.bot.script.raw,
            },
        });
    }
}

/**
 * Options that are used to influence the behavior of the compiled script.
 */
interface CompileOptions {
    /**
     * Whether the script allows editing the bot.
     * If false, then the script will set the bot's editable value to false for the duration of the script.
     */
    allowsEditing: boolean;
}

// Types of bots
// 1. Raw bot - original data
// 2. Script bot - data + compiled scripts
// 3. Precalculated bot - derived data

// Raw bot -> runtime bot -> precalculated bot

interface CompiledBotsState {
    [id: string]: CompiledBot;
}

/**
 * A bot that has been pre-compiled so that running tag listeners or formulas is quick.
 */
interface CompiledBot extends PrecalculatedBot {
    /**
     * The tags that have been compiled.
     * Formulas and other tag values get stored here as an intermediate state.
     */
    compiledValues: {
        [tag: string]: (() => any) | any;
    };

    /**
     * The tags that are listeners and have been compiled into functions.
     */
    listeners: {
        [tag: string]: () => any;
    };

    /**
     * The bot that is referenced in scripts.
     */
    script: ScriptBot;
}
