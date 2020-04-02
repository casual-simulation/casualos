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
    botAdded,
} from '../bots';
import { Observable, Subject } from 'rxjs';
import { AuxCompiler, AuxCompiledScript } from './AuxCompiler';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
} from './AuxGlobalContext';
import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import sortedIndexBy from 'lodash/sortedIndexBy';
import { DependencyManager, BotDependentInfo } from './DependencyManager';
import {
    ScriptBotInterface,
    ScriptBotFactory,
    createScriptBot,
} from './ScriptBot';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime
    implements ScriptBotInterface<CompiledBot>, ScriptBotFactory {
    private _originalState: BotsState = {};
    private _compiledState: CompiledBotsState = {};
    private _compiler = new AuxCompiler();
    private _dependencies = new DependencyManager();
    private _onActions: Subject<BotAction[]>;

    // TODO: Update version number
    // TODO: Update device
    private _globalContext: AuxGlobalContext = new MemoryGlobalContext(
        {
            hash: 'hash',
            version: 'v1.2.3',
            major: 1,
            minor: 2,
            patch: 3,
        },
        null,
        this
    );

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
        this._library = libraryFactory(this._globalContext);
        this._onActions = new Subject();
    }

    /**
     * An observable that resolves whenever the runtime issues an action.
     */
    get onActions(): Observable<BotAction[]> {
        return this._onActions;
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * @param eventName The name of the event.
     * @param botIds The Bot IDs that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(eventName: string, botIds?: string[], arg?: any): void {
        const ids = botIds ? botIds : Object.keys(this._compiledState);
        for (let id of ids) {
            const bot = this._compiledState[id];
            const listener = bot.listeners[eventName];
            if (listener) {
                listener(arg);
            }
        }
        const actions = this._globalContext.dequeueActions();
        this._onActions.next(actions);
    }

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
        let newBots = [] as [CompiledBot, PrecalculatedBot][];
        let newBotIDs = new Set<string>();

        for (let bot of bots) {
            // TODO: Make the compiled bot have a script variant
            //       for supporting writing to tags and such.
            let newBot: CompiledBot = this._createCompiledBot(bot, false);

            let precalculated: PrecalculatedBot = {
                id: bot.id,
                precalculated: true,
                tags: bot.tags,
                values: {},
            };

            if (hasValue(bot.space)) {
                newBot.space = bot.space;
                precalculated.space = bot.space;
            }
            newBots.push([newBot, precalculated]);
            newBotIDs.add(newBot.id);
            nextOriginalState[bot.id] = bot;
            update.state[bot.id] = precalculated;
            update.addedBots.push(bot.id);
        }

        for (let [bot, precalculated] of newBots) {
            let tags = Object.keys(bot.compiledValues);
            for (let tag of tags) {
                precalculated.values[tag] = convertToCopiableValue(
                    this._updateTag(bot, tag)
                );
            }
        }

        const changes = this._dependencies.addBots(bots);
        this._updateDependentBots(changes, update, newBotIDs);

        this._originalState = nextOriginalState;

        return update;
    }

    /**
     * Signals to the runtime that the given bots were removed.
     * @param botIds The IDs of the bots that were removed.
     */
    botsRemoved(botIds: string[]): StateUpdatedEvent {
        let update = {
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        } as StateUpdatedEvent;
        let nextOriginalState = Object.assign({}, this._originalState);

        for (let id of botIds) {
            const bot = this._compiledState[id];
            if (bot) {
                removeFromContext(this._globalContext, bot.script);
            }
            delete this._compiledState[id];
            delete nextOriginalState[id];
            update.state[id] = null;
            update.removedBots.push(id);
        }

        const changes = this._dependencies.removeBots(botIds);
        this._updateDependentBots(changes, update, new Set());

        this._originalState = nextOriginalState;
        return update;
    }

    /**
     * Signals to the runtime that the given bots were updated.
     * @param updates The bot updates.
     */
    botsUpdated(updates: UpdatedBot[]): StateUpdatedEvent {
        let update = {
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        } as StateUpdatedEvent;

        let nextOriginalState = Object.assign({}, this._originalState);

        for (let u of updates) {
            // 1. get compiled bot
            let compiled = this._compiledState[u.bot.id];

            // 2. update
            this._compileTags(u.tags, compiled, u.bot);

            // 3. convert to precalculated
            let partial = {
                tags: {},
                values: {},
            } as Partial<PrecalculatedBot>;
            for (let tag of u.tags) {
                partial.tags[tag] = u.bot.tags[tag];
            }

            update.state[u.bot.id] = <any>partial;
        }

        const changes = this._dependencies.updateBots(updates);
        this._updateDependentBots(changes, update, new Set());

        this._originalState = nextOriginalState;

        return update;
    }

    createScriptBot(bot: Bot): ScriptBot {
        const compiled = this._createCompiledBot(bot, true);
        return compiled.script;
    }

    destroyScriptBot(bot: ScriptBot) {
        delete this._compiledState[bot.id];
    }

    private _updateDependentBots(
        updated: BotDependentInfo,
        update: StateUpdatedEvent,
        newBotIDs: Set<string>
    ) {
        const nextState = update.state;
        const originalState = this._compiledState;
        for (let botId in updated) {
            const originalBot = originalState[botId];
            if (!originalBot) {
                continue;
            }
            let botUpdate: Partial<PrecalculatedBot> = nextState[botId];
            if (!botUpdate) {
                botUpdate = {
                    values: {},
                };
            }
            const tags = updated[botId];
            for (let tag of tags) {
                const originalTag = originalBot.tags[tag];
                if (hasValue(originalTag)) {
                    botUpdate.values[tag] = convertToCopiableValue(
                        this._updateTag(originalBot, tag)
                    );
                } else {
                    botUpdate.tags[tag] = null;
                    botUpdate.values[tag] = null;
                }
            }
            nextState[botId] = <PrecalculatedBot>botUpdate;
            if (!newBotIDs.has(botId)) {
                update.updatedBots.push(botId);
            }
        }
    }

    private _compileTags(tags: string[], compiled: CompiledBot, bot: Bot) {
        for (let tag of tags) {
            this._compileTag(compiled, tag, bot.tags[tag]);
        }
    }

    private _createCompiledBot(bot: Bot, fromFactory: boolean): CompiledBot {
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
        const tags = tagsOnBot(compiledBot);
        this._compileTags(tags, compiledBot, bot);

        if (!fromFactory) {
            addToContext(this._globalContext, compiledBot.script);
        }

        this._compiledState[bot.id] = compiledBot;

        return compiledBot;
    }

    private _createScriptBot(bot: CompiledBot): ScriptBot {
        return createScriptBot(bot, this);
    }

    updateTag(bot: CompiledBot, tag: string, newValue: any): boolean {
        if (this._globalContext.allowsEditing) {
            this._compileTag(bot, tag, newValue);
            return true;
        }
        return false;
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
        [tag: string]: (arg?: any) => any;
    };

    /**
     * The bot that is referenced in scripts.
     */
    script: ScriptBot;
}
