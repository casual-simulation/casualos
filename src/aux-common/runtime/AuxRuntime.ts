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
    hasValue,
    tagsOnBot,
    isFormula,
    isScript,
    isNumber,
    isArray,
    parseArray,
    BOT_SPACE_TAG,
    botUpdated,
    isBot,
    ORIGINAL_OBJECT,
    DEFAULT_ENERGY,
    getBotSpace,
    ON_ACTION_ACTION_NAME,
    breakIntoIndividualEvents,
} from '../bots';
import { Observable, Subject, SubscriptionLike } from 'rxjs';
import { AuxCompiler, AuxCompiledScript } from './AuxCompiler';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
} from './AuxGlobalContext';
import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import { DependencyManager, BotDependentInfo } from './DependencyManager';
import {
    RuntimeBotInterface,
    RuntimeBotFactory,
    createRuntimeBot,
    RuntimeBot,
    RealtimeEditMode,
    CLEAR_CHANGES_SYMBOL,
    isRuntimeBot,
} from './RuntimeBot';
import {
    CompiledBot,
    CompiledBotsState,
    CompiledBotListener,
} from './CompiledBot';
import sortBy from 'lodash/sortBy';
import transform from 'lodash/transform';
import { BatchingZoneSpec } from './BatchingZoneSpec';
import { CleanupZoneSpec } from './CleanupZoneSpec';
import { ScriptError, ActionResult, RanOutOfEnergyError } from './AuxResults';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { convertToCopiableValue } from './Utils';
import {
    AuxRealtimeEditModeProvider,
    SpaceRealtimeEditModeMap,
    DefaultRealtimeEditModeProvider,
} from './AuxRealtimeEditModeProvider';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime
    implements RuntimeBotInterface, RuntimeBotFactory, SubscriptionLike {
    private _compiledState: CompiledBotsState = {};
    private _compiler = new AuxCompiler();
    private _dependencies = new DependencyManager();
    private _onActions: Subject<BotAction[]>;
    private _onErrors: Subject<ScriptError[]>;

    private _actionBatch: BotAction[] = [];
    private _errorBatch: ScriptError[] = [];

    private _userId: string;
    private _zone: Zone;
    private _globalVariablesSpec: ZoneSpec;
    private _sub: SubscriptionLike;

    private _updatedBots = new Map<string, RuntimeBot>();
    private _newBots = new Map<string, RuntimeBot>();

    // TODO: Update version number
    // TODO: Update device
    private _globalContext: AuxGlobalContext;

    private _library: AuxLibrary;
    private _editModeProvider: AuxRealtimeEditModeProvider;

    /**
     * Creates a new AuxRuntime using the given library factory.
     * @param libraryFactory
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        libraryFactory: (
            context: AuxGlobalContext
        ) => AuxLibrary = createDefaultLibrary,
        editModeProvider: AuxRealtimeEditModeProvider = new DefaultRealtimeEditModeProvider()
    ) {
        this._globalContext = new MemoryGlobalContext(version, device, this);
        this._library = libraryFactory(this._globalContext);
        this._editModeProvider = editModeProvider;
        this._onActions = new Subject();
        this._onErrors = new Subject();

        const cleanupSpec = new CleanupZoneSpec();
        this._sub = cleanupSpec;

        const cleanupZone = Zone.current.fork(cleanupSpec);

        const batchingZone = cleanupZone.fork(
            new BatchingZoneSpec(() => {
                // Send the batch once all the micro tasks are completed

                // Grab any unbatched actions and errors.
                // This can happen if an action is queued during a callback
                // or promise.
                const unbatchedActions = this._processUnbatchedActions();
                const unbatchedErrors = this._processUnbatchedErrors();

                const actions = this._actionBatch;
                const errors = this._errorBatch;

                actions.push(...unbatchedActions);
                errors.push(...unbatchedErrors);

                this._actionBatch = [];
                this._errorBatch = [];

                // Schedule a new micro task to
                // run at a later time with the actions.
                // This ensures that we don't block other flush operations
                // due to handlers running synchronously.
                Zone.root.scheduleMicroTask('AuxRuntime#flush', () => {
                    this._onActions.next(actions);
                    this._onErrors.next(errors);
                });
            })
        );

        const wrapInvoke = (targetZone: Zone, fn: Function) => {
            const previousBot = this._globalContext.currentBot;
            this._globalContext.currentBot =
                targetZone.get('currentBot') || null;

            const wasEditable = this._globalContext.allowsEditing;
            this._globalContext.allowsEditing = targetZone.get('allowsEditing');
            try {
                return fn();
            } finally {
                this._globalContext.currentBot = previousBot || null;
                this._globalContext.allowsEditing = wasEditable;
            }
        };

        this._globalVariablesSpec = {
            name: 'GlobalVariablesZone',
            onScheduleTask: (
                parentZoneDelegate: ZoneDelegate,
                currentZone: Zone,
                targetZone: Zone,
                task: Task
            ) => {
                if (targetZone.get('allowsEditing') === false) {
                    task.cancelScheduleRequest();
                    return task;
                }
                return parentZoneDelegate.scheduleTask(targetZone, task);
            },
            onInvoke: (
                parentZoneDelegate,
                currentZone,
                targetZone,
                target,
                applyThis,
                applyArgs
            ) => {
                return wrapInvoke(targetZone, () =>
                    parentZoneDelegate.invoke(
                        targetZone,
                        target,
                        applyThis,
                        applyArgs
                    )
                );
            },
            onInvokeTask: (
                parentZoneDelegate,
                currentZone,
                targetZone,
                task,
                applyThis,
                applyArgs
            ) => {
                return wrapInvoke(targetZone, () =>
                    parentZoneDelegate.invokeTask(
                        targetZone,
                        task,
                        applyThis,
                        applyArgs
                    )
                );
            },
        };

        this._zone = batchingZone;
    }

    get closed() {
        return this._sub.closed;
    }

    unsubscribe() {
        return this._sub.unsubscribe();
    }

    /**
     * Gets the current state that the runtime is operating on.
     */
    get currentState() {
        return this._compiledState;
    }

    set userId(id: string) {
        this._userId = id;
        this._globalContext.playerBot = this.userBot;
    }

    get userBot() {
        if (!this._userId) {
            return;
        }
        const bot = this._compiledState[this._userId];
        if (bot) {
            return bot.script;
        } else {
            return null;
        }
    }

    /**
     * An observable that resolves whenever the runtime issues an action.
     */
    get onActions(): Observable<BotAction[]> {
        return this._onActions;
    }

    /**
     * An observable that resolves whenever the runtime issues an error.
     */
    get onErrors(): Observable<ScriptError[]> {
        return this._onErrors;
    }

    /**
     * Gets the dependency manager that the runtime is using.
     */
    get dependencies() {
        return this._dependencies;
    }

    /**
     * Processes the given bot actions and dispatches the resulting actions in the future.
     * @param actions The actions to process.
     */
    process(actions: BotAction[]) {
        this._zone.run(() => {
            for (let action of actions) {
                let { rejected, newActions } = this._rejectAction(action);
                for (let newAction of newActions) {
                    this._processAction(newAction);
                }
                if (rejected) {
                    continue;
                }

                this._processAction(action);
            }
        });
    }

    private _processAction(action: BotAction) {
        if (action.type === 'action') {
            const result = this._shout(
                action.eventName,
                action.botIds,
                action.argument,
                false
            );
            this.process(result.actions);
        } else if (action.type === 'run_script') {
            const result = this._execute(action.script, false);
            this.process(result.actions);
        } else if (action.type === 'apply_state') {
            const events = breakIntoIndividualEvents(this.currentState, action);
            this.process(events);
        } else if (action.type === 'async_result') {
            this._globalContext.resolveTask(action.taskId, action.result);
        } else if (action.type === 'async_error') {
            this._globalContext.rejectTask(action.taskId, action.error);
        } else {
            this._actionBatch.push(action);
        }
    }

    private _rejectAction(
        action: BotAction
    ): { rejected: boolean; newActions: BotAction[] } {
        const result = this._shout(
            ON_ACTION_ACTION_NAME,
            null,
            {
                action: action,
            },
            false
        );

        let rejected = false;
        for (let i = 0; i < result.actions.length; i++) {
            const a = result.actions[i];
            if (a.type === 'reject' && a.action === action) {
                rejected = true;
                result.actions.splice(i, 1);
                break;
            }
        }

        return { rejected, newActions: result.actions };
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * @param eventName The name of the event.
     * @param botIds The Bot IDs that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(eventName: string, botIds?: string[], arg?: any): ActionResult {
        return this._shout(eventName, botIds, arg, true);
    }

    private _shout(
        eventName: string,
        botIds: string[],
        arg: any,
        batch: boolean
    ): ActionResult {
        arg = this._mapBotsToRuntimeBots(arg);
        const { result, actions, errors } = this._batchScriptResults(() => {
            const results = this._library.api.whisper(botIds, eventName, arg);

            return results;
        }, batch);

        return {
            actions,
            errors,
            results: result,
            listeners: [],
        };
    }

    /**
     * Executes the given script.
     * @param script The script to run.
     */
    execute(script: string) {
        return this._execute(script, true);
    }

    private _execute(script: string, batch: boolean) {
        let fn: () => any;

        try {
            fn = this._compile(null, null, script, {
                allowsEditing: true,
            });
        } catch (ex) {
            let errors = [
                {
                    error: ex,
                    bot: null,
                    tag: null,
                    script: script,
                },
            ] as ScriptError[];
            this._onErrors.next(errors);

            return {
                result: undefined,
                actions: [],
                errors,
            };
        }

        return this._batchScriptResults(() => {
            try {
                return fn();
            } catch (ex) {
                this._globalContext.enqueueError(ex);
            }
        }, batch);
    }

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

        let newBots = [] as [CompiledBot, PrecalculatedBot][];
        let newBotIDs = new Set<string>();

        for (let bot of bots) {
            const existing = this._compiledState[bot.id];
            if (!!existing) {
                removeFromContext(this._globalContext, existing.script);
                delete this._compiledState[bot.id];

                const index = newBots.findIndex(([b]) => b === existing);
                if (index >= 0) {
                    newBots.splice(index, 1);
                    update.addedBots.splice(index, 1);
                }
            }

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
            update.state[bot.id] = precalculated;
            update.addedBots.push(bot.id);
        }

        for (let [bot, precalculated] of newBots) {
            let tags = Object.keys(bot.compiledValues);
            for (let tag of tags) {
                precalculated.values[tag] = convertToCopiableValue(
                    this._updateTag(bot, tag, true)
                );
            }
        }

        const changes = this._dependencies.addBots(bots);
        this._updateDependentBots(changes, update, newBotIDs);

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

        for (let id of botIds) {
            const bot = this._compiledState[id];
            if (bot) {
                removeFromContext(this._globalContext, bot.script);
            }
            delete this._compiledState[id];
            update.state[id] = null;
            update.removedBots.push(id);
        }

        const changes = this._dependencies.removeBots(botIds);
        this._updateDependentBots(changes, update, new Set());

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

        for (let u of updates) {
            // 1. get compiled bot
            let compiled = this._compiledState[u.bot.id];

            if (!compiled) {
                continue;
            }

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

        return update;
    }

    createRuntimeBot(bot: Bot): RuntimeBot {
        const space = getBotSpace(bot);
        const mode = this._editModeProvider.getEditMode(space);
        if (mode === RealtimeEditMode.Immediate) {
            const compiled = this._createCompiledBot(bot, true);
            this._newBots.set(bot.id, compiled.script);
            return compiled.script;
        }
        return null;
    }

    destroyScriptBot(bot: RuntimeBot) {
        const space = getBotSpace(bot);
        const mode = this._editModeProvider.getEditMode(space);

        if (mode === RealtimeEditMode.Immediate) {
            delete this._compiledState[bot.id];
        }

        return mode;
    }

    private _batchScriptResults<T>(
        callback: () => T,
        batch: boolean
    ): { result: T; actions: BotAction[]; errors: ScriptError[] } {
        return this._zone.run(() => {
            const results = this._calculateScriptResults(callback);

            if (batch) {
                this._actionBatch.push(...results.actions);
            }
            this._errorBatch.push(...results.errors);

            return results;
        });
    }

    private _calculateScriptResults<T>(
        callback: () => T
    ): { result: T; actions: BotAction[]; errors: ScriptError[] } {
        this._globalContext.playerBot = this.userBot;
        this._globalContext.energy = DEFAULT_ENERGY;
        const result = callback();

        const actions = this._processUnbatchedActions();
        const errors = this._processUnbatchedErrors();

        return {
            result: result,
            actions: actions,
            errors: errors,
        };
    }

    private _processUnbatchedErrors() {
        return this._globalContext.dequeueErrors();
    }

    private _processUnbatchedActions() {
        const actions = this._globalContext.dequeueActions();
        const updatedBots = [...this._updatedBots.values()];
        const updates = updatedBots
            .filter(bot => {
                return (
                    Object.keys(bot.changes).length > 0 &&
                    !this._newBots.has(bot.id)
                );
            })
            .map(bot =>
                botUpdated(bot.id, {
                    tags: { ...bot.changes },
                })
            );
        for (let bot of updatedBots) {
            bot[CLEAR_CHANGES_SYMBOL]();
        }
        const sortedUpdates = sortBy(updates, u => u.id);
        this._updatedBots.clear();
        this._newBots.clear();
        actions.push(...sortedUpdates);

        return actions;
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
                        this._updateTag(originalBot, tag, true)
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
            tags: fromFactory ? bot.tags : { ...bot.tags },
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

    updateTag(bot: CompiledBot, tag: string, newValue: any): RealtimeEditMode {
        if (this._globalContext.allowsEditing) {
            const space = getBotSpace(bot);
            const mode = this._editModeProvider.getEditMode(space);
            if (mode === RealtimeEditMode.Immediate) {
                this._compileTag(bot, tag, newValue);
            }
            this._updatedBots.set(bot.id, bot.script);
            return mode;
        }
        return RealtimeEditMode.None;
    }

    getValue(bot: CompiledBot, tag: string): any {
        return this._updateTag(bot, tag, false);
    }

    getRawValue(bot: CompiledBot, tag: string): any {
        return bot.tags[tag];
    }

    getListener(bot: CompiledBot, tag: string): CompiledBotListener {
        const listener = bot.listeners[tag];
        if (listener) {
            return listener;
        }
        this.getValue(bot, tag);
        return bot.listeners[tag] || null;
    }

    private _updateTag(
        newBot: CompiledBot,
        tag: string,
        forceUpdateListener: boolean
    ): any {
        const compiled = newBot.compiledValues[tag];
        try {
            const value = (newBot.values[tag] =
                typeof compiled === 'function' ? compiled() : compiled);

            if (
                isScript(value) &&
                (!newBot.listeners[tag] || forceUpdateListener)
            ) {
                newBot.listeners[tag] = this._compile(newBot, tag, value, {
                    allowsEditing: true,
                });
            }

            return value;
        } catch (ex) {
            if ('error' in ex) {
                const scriptError = ex as ScriptError;
                return (newBot.values[tag] = scriptError.error);
            } else {
                return (newBot.values[tag] = ex);
            }
        }
    }

    private _compileTag(bot: CompiledBot, tag: string, tagValue: any) {
        bot.tags[tag] = tagValue;

        let { value, listener } = this._compileValue(bot, tag, tagValue);
        if (listener) {
            bot.listeners[tag] = listener;
        } else {
            delete bot.listeners[tag];
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

            // Note: Don't name isFormula because then webpack will be
            // confused and decide to not import the isFormula function above
            let isAFormula = false;
            const values = split.map(s => {
                const result = this._compileValue(bot, tag, s.trim());
                if (typeof result.value === 'function') {
                    isAFormula = true;
                }
                return result;
            });

            if (isAFormula) {
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
                creator: null as RuntimeBot,
                config: null as RuntimeBot,
            },
            before: ctx => {
                // if (!options.allowsEditing) {
                //     ctx.wasEditable = ctx.global.allowsEditing;
                //     ctx.global.allowsEditing = false;
                // }
                ctx.creator = ctx.bot
                    ? this._getRuntimeBot(ctx.bot.script.tags.creator)
                    : null;
                ctx.config = ctx.bot
                    ? this._getRuntimeBot(ctx.bot.script.tags.auxConfigBot)
                    : null;
            },
            invoke: (fn, ctx) => {
                return Zone.current
                    .fork({
                        ...this._globalVariablesSpec,
                        properties: {
                            currentBot: ctx.bot,
                            allowsEditing: options.allowsEditing,
                        },
                    })
                    .run(() => fn());
            },
            onError: (err, ctx, meta) => {
                if (err instanceof RanOutOfEnergyError) {
                    throw err;
                }
                let data: ScriptError = {
                    error: err,
                    bot: ctx.bot,
                    tag: ctx.tag,
                };
                if (err instanceof Error) {
                    if (Error.prepareStackTrace) {
                        const prev = Error.prepareStackTrace;
                        try {
                            Error.prepareStackTrace = (err, stackTrace) => {
                                const info = this._compiler.findLineInfo(
                                    stackTrace,
                                    meta
                                );
                                if (info) {
                                    Object.assign(err, info);
                                }

                                return prev(err, stackTrace);
                            };

                            // force the stack trace to be computed
                            err.stack;
                            const anyError = <any>err;
                            if (hasValue(anyError.line)) {
                                data.line = anyError.line;
                            }
                            if (hasValue(anyError.column)) {
                                data.column = anyError.column;
                            }
                        } finally {
                            Error.prepareStackTrace = prev;
                        }
                    }
                }
                throw data;
            },
            constants: {
                ...this._library.api,
                tagName: tag,
            },
            variables: {
                this: ctx => (ctx.bot ? ctx.bot.script : null),
                bot: ctx => (ctx.bot ? ctx.bot.script : null),
                tags: ctx => (ctx.bot ? ctx.bot.script.tags : null),
                raw: ctx => (ctx.bot ? ctx.bot.script.raw : null),
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
     * We use this property in action.reject() to resolve the original action value so that doing a action.reject() in a onStoryAction works properly.
     *
     * @param context The sandbox context.
     * @param value The value that should be converted.
     */
    private _mapBotsToRuntimeBots(value: any): any {
        if (isBot(value)) {
            return this._globalContext.state[value.id] || value;
        } else if (Array.isArray(value) && value.some(isBot)) {
            let arr = value.map(b =>
                isBot(b) ? this._globalContext.state[b.id] || b : b
            );
            (<any>arr)[ORIGINAL_OBJECT] = value;
            return arr;
        } else if (
            hasValue(value) &&
            !Array.isArray(value) &&
            !(value instanceof ArrayBuffer) &&
            typeof value === 'object' &&
            Object.getPrototypeOf(value) === Object.prototype
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
