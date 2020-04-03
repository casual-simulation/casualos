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
    ScriptTags,
    BOT_SPACE_TAG,
    convertToCopiableValue,
    botAdded,
    ActionResult,
    botUpdated,
    createBot,
    trimEvent,
    isBot,
    ORIGINAL_OBJECT,
} from '../bots';
import { Observable, Subject } from 'rxjs';
import { AuxCompiler, AuxCompiledScript } from './AuxCompiler';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
    AuxVersion,
    AuxDevice,
} from './AuxGlobalContext';
import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import sortedIndexBy from 'lodash/sortedIndexBy';
import { DependencyManager, BotDependentInfo } from './DependencyManager';
import {
    RuntimeBotInterface,
    RuntimeBotFactory,
    createRuntimeBot,
    RuntimeBot,
} from './RuntimeBot';
import {
    CompiledBot,
    CompiledBotsState,
    CompiledBotValues,
} from './CompiledBot';
import sortBy from 'lodash/sortBy';
import transform from 'lodash/transform';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime implements RuntimeBotInterface, RuntimeBotFactory {
    private _originalState: BotsState = {};
    private _compiledState: CompiledBotsState = {};
    private _compiler = new AuxCompiler();
    private _dependencies = new DependencyManager();
    private _onActions: Subject<BotAction[]>;

    private _updatedBots = new Map<string, RuntimeBot>();
    private _newBots = new Map<string, RuntimeBot>();

    // TODO: Update version number
    // TODO: Update device
    private _globalContext: AuxGlobalContext;

    private _library: AuxLibrary;

    /**
     * Creates a new AuxRuntime using the given library factory.
     * @param libraryFactory
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        libraryFactory: (
            context: AuxGlobalContext
        ) => AuxLibrary = createDefaultLibrary
    ) {
        this._globalContext = new MemoryGlobalContext(version, device, this);
        this._library = libraryFactory(this._globalContext);
        this._onActions = new Subject();
    }

    set userId(id: string) {
        const bot = this._compiledState[id];
        if (bot) {
            this._globalContext.playerBot = bot.script;
        } else {
            this._globalContext.playerBot = null;
        }
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
    shout(eventName: string, botIds?: string[], arg?: any): ActionResult {
        let result = {
            actions: [],
            errors: [],
            listeners: [],
            results: [],
        } as ActionResult;
        arg = this._mapBotsToRuntimeBots(arg);

        const results = this._library.api.whisper(botIds, eventName, arg);
        result.results.push(...results);

        const actions = this._globalContext.dequeueActions();
        const updates = [...this._updatedBots.values()]
            .filter(bot => {
                return (
                    Object.keys(bot.changes).length > 0 &&
                    !this._newBots.has(bot.id)
                );
            })
            .map(bot =>
                botUpdated(bot.id, {
                    tags: bot.changes,
                })
            );
        const sortedUpdates = sortBy(updates, u => u.id);
        this._updatedBots.clear();
        this._newBots.clear();
        actions.push(...sortedUpdates);
        this._onActions.next(actions);
        result.actions = actions;
        return result;
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

    createRuntimeBot(bot: Bot): RuntimeBot {
        const compiled = this._createCompiledBot(bot, true);
        this._newBots.set(bot.id, compiled.script);
        return compiled.script;
    }

    destroyScriptBot(bot: RuntimeBot) {
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
        compiledBot.script = this._createRuntimeBot(compiledBot);
        const tags = tagsOnBot(compiledBot);
        this._compileTags(tags, compiledBot, bot);

        if (!fromFactory) {
            addToContext(this._globalContext, compiledBot.script);
        }

        this._compiledState[bot.id] = compiledBot;
        return compiledBot;
    }

    private _createRuntimeBot(bot: CompiledBot): RuntimeBot {
        return createRuntimeBot(bot, this);
    }

    updateTag(bot: CompiledBot, tag: string, newValue: any): boolean {
        if (this._globalContext.allowsEditing) {
            this._compileTag(bot, tag, newValue);
            this._updatedBots.set(bot.id, bot.script);
            return true;
        }
        return false;
    }

    getValue(bot: CompiledBot, tag: string): any {
        return this._updateTag(bot, tag);
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
            try {
                value = this._compile(bot, tag, value, {
                    allowsEditing: false,
                });
            } catch (ex) {
                value = ex;
            }
        } else if (isScript(value)) {
            try {
                listener = this._compile(bot, tag, value, {
                    allowsEditing: true,
                });
            } catch (ex) {
                value = ex;
            }
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
                previousBot: null as RuntimeBot,
                creator: null as RuntimeBot,
                config: null as RuntimeBot,
                wasEditable: true,
            },
            before: ctx => {
                if (!options.allowsEditing) {
                    ctx.wasEditable = ctx.global.allowsEditing;
                    ctx.global.allowsEditing = false;
                }
                ctx.previousBot = ctx.global.currentBot;
                ctx.global.currentBot = ctx.bot.script;
                ctx.creator = this._getRuntimeBot(
                    ctx.bot.script.tags.auxCreator
                );
                ctx.config = this._getRuntimeBot(
                    ctx.bot.script.tags.auxConfigBot
                );
            },
            after: ctx => {
                if (!options.allowsEditing) {
                    ctx.global.allowsEditing = ctx.wasEditable;
                }
                ctx.global.currentBot = ctx.previousBot;
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
                creator: ctx => ctx.creator,
                config: ctx => ctx.config,
                configTag: ctx =>
                    ctx.config ? ctx.config.tags[ctx.tag] : null,
            },
            arguments: [['that', 'data']],
        });
    }

    private _getRuntimeBot(id: string): RuntimeBot {
        if (hasValue(id) && typeof id === 'string') {
            const creator = this._compiledState[id];
            if (creator) {
                return creator.script;
            }
        }
        return null;
    }

    /**
     * Maps the given value to a new value where bots are replaced with script bots.
     * This makes it easy to modify other bot values in listeners. If the value is not convertable,
     * then it is returned unaffected. Only objects and arrays are convertable.
     *
     * Works by making a copy of the value where every bot value is replaced with a reference
     * to a script bot instance for the bot. The copy has a reference to the original value in the ORIGINAL_OBJECT symbol property.
     * We use this property in action.reject() to resolve the original action value so that doing a action.reject() in a onUniverseAction works properly.
     *
     * @param context The sandbox context.
     * @param value The value that should be converted.
     */
    private _mapBotsToRuntimeBots(value: any): any {
        if (isBot(value)) {
            return this._globalContext.state[value.id];
        } else if (Array.isArray(value) && value.some(isBot)) {
            let arr = value.map(b =>
                isBot(b) ? this._globalContext.state[b.id] : b
            );
            (<any>arr)[ORIGINAL_OBJECT] = value;
            return arr;
        } else if (
            hasValue(value) &&
            !Array.isArray(value) &&
            !(value instanceof ArrayBuffer) &&
            typeof value === 'object'
        ) {
            return transform(
                value,
                (result, value, key) =>
                    this._transformBotsToRuntimeBots(result, value, key),
                { [ORIGINAL_OBJECT]: value }
            );
        }

        return value;
    }

    private _transformBotsToRuntimeBots(result: any, value: any, key: any) {
        result[key] = this._mapBotsToRuntimeBots(value);
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
