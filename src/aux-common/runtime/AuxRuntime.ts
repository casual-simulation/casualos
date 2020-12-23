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
    BOT_SPACE_TAG,
    botUpdated,
    isBot,
    ORIGINAL_OBJECT,
    DEFAULT_ENERGY,
    getBotSpace,
    ON_ACTION_ACTION_NAME,
    breakIntoIndividualEvents,
    ON_BOT_ADDED_ACTION_NAME,
    ON_ANY_BOTS_ADDED_ACTION_NAME,
    ON_ANY_BOTS_REMOVED_ACTION_NAME,
    ON_BOT_CHANGED_ACTION_NAME,
    ON_ANY_BOTS_CHANGED_ACTION_NAME,
    BotSpace,
    getTagMask,
    hasTagOrMask,
    ON_SERVER_STREAM_LOST_ACTION_NAME,
    PartialBot,
    updatedBot,
    TAG_MASK_SPACE_PRIORITIES,
    BotTagMasks,
    RuntimeBot,
    CLEAR_CHANGES_SYMBOL,
    CompiledBotListener,
    DNA_TAG_PREFIX,
} from '../bots';
import { Observable, Subject, SubscriptionLike } from 'rxjs';
import { AuxCompiler, AuxCompiledScript } from './AuxCompiler';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
    isInContext,
} from './AuxGlobalContext';
import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import {
    RuntimeBotInterface,
    RuntimeBotFactory,
    createRuntimeBot,
    RealtimeEditMode,
} from './RuntimeBot';
import { CompiledBot, CompiledBotsState } from './CompiledBot';
import sortBy from 'lodash/sortBy';
import transform from 'lodash/transform';
import { BatchingZoneSpec } from './BatchingZoneSpec';
import { CleanupZoneSpec } from './CleanupZoneSpec';
import { ScriptError, ActionResult, RanOutOfEnergyError } from './AuxResults';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { convertToCopiableValue, DeepObjectError } from './Utils';
import {
    AuxRealtimeEditModeProvider,
    SpaceRealtimeEditModeMap,
    DefaultRealtimeEditModeProvider,
} from './AuxRealtimeEditModeProvider';
import { forOwn, merge } from 'lodash';
import { tagValueHash } from '../aux-format-2/AuxOpTypes';
import { applyEdit, isTagEdit, mergeVersions } from '../aux-format-2';
import { CurrentVersion, VersionVector } from '@casual-simulation/causal-trees';
import { RuntimeStateVersion } from './RuntimeStateVersion';
import { replaceMacros } from './Transpiler';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime
    implements RuntimeBotInterface, RuntimeBotFactory, SubscriptionLike {
    private _compiledState: CompiledBotsState = {};
    private _existingMasks: { [id: string]: BotTagMasks } = {};
    private _compiler = new AuxCompiler();
    private _onActions: Subject<BotAction[]>;
    private _onErrors: Subject<ScriptError[]>;

    private _actionBatch: BotAction[] = [];
    private _errorBatch: ScriptError[] = [];
    private _runFormulas: boolean = true;

    private _userId: string;
    private _zone: Zone;
    private _globalVariablesSpec: ZoneSpec;
    private _sub: SubscriptionLike;
    private _currentVersion: RuntimeStateVersion = {
        localSites: {},
        vector: {},
    };

    private _updatedBots = new Map<string, RuntimeBot>();
    private _newBots = new Map<string, RuntimeBot>();

    // TODO: Update version number
    // TODO: Update device
    private _globalContext: AuxGlobalContext;

    private _library: AuxLibrary;
    private _editModeProvider: AuxRealtimeEditModeProvider;
    private _forceSignedScripts: boolean;
    private _exemptSpaces: BotSpace[];
    private _batchPending: boolean = false;

    get forceSignedScripts() {
        return this._forceSignedScripts;
    }

    get context() {
        return this._globalContext;
    }

    /**
     * Gets whether to compile and run formulas.
     */
    get runFormulas(): boolean {
        return this._runFormulas;
    }

    /**
     * Sets whether to compile and run formulas.
     */
    set runFormulas(value: boolean) {
        this._runFormulas = value;
    }

    get currentVersion() {
        return this._currentVersion;
    }

    /**
     * Creates a new AuxRuntime using the given library factory.
     * @param libraryFactory
     * @param forceSignedScripts Whether to force the runtime to only allow scripts that are signed.
     * @param exemptSpaces The spaces that are exempt from requiring signed scripts.
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        libraryFactory: (
            context: AuxGlobalContext
        ) => AuxLibrary = createDefaultLibrary,
        editModeProvider: AuxRealtimeEditModeProvider = new DefaultRealtimeEditModeProvider(),
        forceSignedScripts: boolean = false,
        exemptSpaces: BotSpace[] = ['local', 'tempLocal']
    ) {
        this._globalContext = new MemoryGlobalContext(
            version,
            device,
            this,
            this
        );
        this._library = libraryFactory(this._globalContext);
        this._editModeProvider = editModeProvider;
        this._forceSignedScripts = forceSignedScripts;
        this._exemptSpaces = exemptSpaces;
        this._onActions = new Subject();
        this._onErrors = new Subject();

        const cleanupSpec = new CleanupZoneSpec();
        this._sub = cleanupSpec;

        const cleanupZone = Zone.current.fork(cleanupSpec);

        const batchingZone = cleanupZone.fork(
            new BatchingZoneSpec(() => {
                this._processBatch();
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

    getShoutTimers(): { [shout: string]: number } {
        return {};
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
            const result = this._execute(action.script, false, false);
            this.process(result.actions);
            if (hasValue(action.taskId)) {
                this._globalContext.resolveTask(
                    action.taskId,
                    result.result,
                    false
                );
            }
        } else if (action.type === 'apply_state') {
            const events = breakIntoIndividualEvents(this.currentState, action);
            this.process(events);
        } else if (action.type === 'async_result') {
            const value =
                action.mapBotsInResult === true
                    ? this._mapBotsToRuntimeBots(action.result)
                    : action.result;
            this._globalContext.resolveTask(action.taskId, value, false);
        } else if (action.type === 'async_error') {
            this._globalContext.rejectTask(action.taskId, action.error, false);
        } else if (action.type === 'device_result') {
            this._globalContext.resolveTask(action.taskId, action.result, true);
        } else if (action.type === 'device_error') {
            this._globalContext.rejectTask(action.taskId, action.error, true);
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
        batch: boolean,
        resetEnergy: boolean = true
    ): ActionResult {
        try {
            arg = this._mapBotsToRuntimeBots(arg);
        } catch (err) {
            arg = err;
        }
        const { result, actions, errors } = this._batchScriptResults(
            () => {
                const results = hasValue(botIds)
                    ? this._library.api.whisper(botIds, eventName, arg)
                    : this._library.api.shout(eventName, arg);

                return results;
            },
            batch,
            resetEnergy
        );

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
        return this._execute(script, true, true);
    }

    private _execute(script: string, batch: boolean, resetEnergy: boolean) {
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

        return this._batchScriptResults(
            () => {
                try {
                    return fn();
                } catch (ex) {
                    this._globalContext.enqueueError(ex);
                }
            },
            batch,
            resetEnergy
        );
    }

    /**
     * Signals to the runtime that the bots state has been updated.
     * @param update The bot state update.
     */
    stateUpdated(update: StateUpdatedEvent): StateUpdatedEvent {
        let nextUpdate = {
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
        } as StateUpdatedEvent;

        let newBotIds = null as Set<string>;
        let newBots = null as [CompiledBot, PrecalculatedBot][];
        let updates = null as UpdatedBot[];
        if (update.addedBots.length > 0) {
            const {
                newBots: addedNewBots,
                newBotIDs: addedBotIds,
            } = this._addBotsToState(
                update.addedBots.map((id) => update.state[id] as Bot),
                nextUpdate
            );

            newBots = addedNewBots;
            newBotIds = addedBotIds;
        }

        if (update.removedBots.length > 0) {
            this._removeBotsFromState(update.removedBots, nextUpdate);
        }

        if (update.updatedBots.length > 0) {
            updates = update.updatedBots.map((id) => {
                const partial = update.state[id];
                const current = this.currentState[id];
                if (!current) {
                    return null;
                }
                return updatedBot(partial, current);
            });

            this._updateBotsWithState(
                update,
                updates,
                nextUpdate,
                newBotIds || new Set()
            );
        }

        this._sendOnBotsAddedShouts(newBots, nextUpdate);
        this._sendOnBotsRemovedShouts(update.removedBots);
        this._sendOnBotsChangedShouts(updates);

        return nextUpdate;
    }

    /**
     * Signals to the runtime that the state version has been updated.
     * @param newVersion The version update.
     */
    versionUpdated(newVersion: CurrentVersion): RuntimeStateVersion {
        if (newVersion.currentSite) {
            this._currentVersion.localSites[newVersion.currentSite] = true;
        }
        this._currentVersion.vector = mergeVersions(
            this._currentVersion.vector,
            newVersion.vector
        );

        return this._currentVersion;
    }

    private _sendOnBotsAddedShouts(
        newBots: [CompiledBot, PrecalculatedBot][],
        nextUpdate: StateUpdatedEvent
    ) {
        if (newBots && nextUpdate.addedBots.length > 0) {
            try {
                this._shout(
                    ON_BOT_ADDED_ACTION_NAME,
                    nextUpdate.addedBots,
                    undefined,
                    true,
                    false
                );
                this._shout(
                    ON_ANY_BOTS_ADDED_ACTION_NAME,
                    null,
                    {
                        bots: newBots.map(([bot, precalc]) => bot),
                    },
                    true,
                    false
                );
            } catch (err) {
                if (!(err instanceof RanOutOfEnergyError)) {
                    throw err;
                } else {
                    console.warn(err);
                }
            }
        }
    }

    private _sendOnBotsRemovedShouts(botIds: string[]) {
        if (botIds.length > 0) {
            try {
                this._shout(
                    ON_ANY_BOTS_REMOVED_ACTION_NAME,
                    null,
                    {
                        botIDs: botIds,
                    },
                    true,
                    false
                );
            } catch (err) {
                if (!(err instanceof RanOutOfEnergyError)) {
                    throw err;
                } else {
                    console.warn(err);
                }
            }
        }
    }

    private _sendOnBotsChangedShouts(updates: UpdatedBot[]) {
        if (updates && updates.length > 0) {
            try {
                for (let update of updates) {
                    if (!update) {
                        continue;
                    }
                    this._shout(
                        ON_BOT_CHANGED_ACTION_NAME,
                        [update.bot.id],
                        {
                            tags: update.tags,
                        },
                        true,
                        false
                    );
                }
                this._shout(
                    ON_ANY_BOTS_CHANGED_ACTION_NAME,
                    null,
                    updates,
                    true,
                    false
                );
            } catch (err) {
                if (!(err instanceof RanOutOfEnergyError)) {
                    throw err;
                } else {
                    console.warn(err);
                }
            }
        }
    }

    private _addBotsToState(bots: Bot[], nextUpdate: StateUpdatedEvent) {
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
                    nextUpdate.addedBots.splice(index, 1);
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

            if (hasValue(bot.signatures)) {
                precalculated.signatures = bot.signatures;
            }
            if (hasValue(newBot.masks)) {
                precalculated.masks = newBot.masks;
            }
            newBots.push([newBot, precalculated]);
            newBotIDs.add(newBot.id);
            nextUpdate.state[bot.id] = precalculated;
            nextUpdate.addedBots.push(bot.id);
        }

        for (let [bot, precalculated] of newBots) {
            let tags = Object.keys(bot.compiledValues);
            for (let tag of tags) {
                precalculated.values[tag] = convertToCopiableValue(
                    this._updateTag(bot, tag, true)
                );
            }
        }

        return {
            newBotIDs,
            newBots,
        };
    }

    private _removeBotsFromState(
        botIds: string[],
        nextUpdate: StateUpdatedEvent
    ) {
        for (let id of botIds) {
            const bot = this._compiledState[id];
            if (bot) {
                removeFromContext(this._globalContext, bot.script);
            }
            delete this._compiledState[id];
            nextUpdate.state[id] = null;
            nextUpdate.removedBots.push(id);
        }
    }

    private _updateBotsWithState(
        update: StateUpdatedEvent,
        updates: UpdatedBot[],
        nextUpdate: StateUpdatedEvent,
        newBotIds: Set<string>
    ) {
        for (let id of update.updatedBots) {
            if (!id) {
                continue;
            }
            const u = update.state[id];

            // 1. get compiled bot
            let compiled = this._compiledState[id];

            if (!compiled) {
                // buffer tag masks
                if (u.masks) {
                    const existing = this._existingMasks[id] || {};
                    this._existingMasks[id] = merge(existing, u.masks);
                }
                continue;
            }

            let partial = {
                tags: {},
                values: {},
            } as Partial<PrecalculatedBot>;

            let updatedTags = new Set<string>();
            if (u.tags) {
                for (let tag in u.tags) {
                    const tagValue = u.tags[tag];
                    if (hasValue(tagValue) || tagValue === null) {
                        if (isTagEdit(tagValue)) {
                            compiled.tags[tag] = applyEdit(
                                compiled.tags[tag],
                                tagValue
                            );
                        } else {
                            compiled.tags[tag] = tagValue;
                        }
                        partial.tags[tag] = tagValue;
                        updatedTags.add(tag);
                    }
                }
            }

            if (u.masks) {
                for (let space in u.masks) {
                    const tags = u.masks[space];
                    for (let tag in tags) {
                        const tagValue = u.masks[space][tag];
                        if (hasValue(tagValue) || tagValue === null) {
                            if (!compiled.masks) {
                                compiled.masks = {};
                            }
                            if (!compiled.masks[space]) {
                                compiled.masks[space] = {};
                            }
                            if (!partial.masks) {
                                partial.masks = {};
                            }
                            if (!partial.masks[space]) {
                                partial.masks[space] = {};
                            }

                            if (tagValue === null) {
                                delete compiled.masks[space][tag];
                            } else if (isTagEdit(tagValue)) {
                                compiled.masks[space][tag] = applyEdit(
                                    compiled.masks[space][tag],
                                    tagValue
                                );
                            } else {
                                compiled.masks[space][tag] = tagValue;
                            }
                            updatedTags.add(tag);
                            partial.masks[space][tag] = tagValue;
                        }
                    }
                }
            }

            for (let tag of updatedTags) {
                let hasTag = false;
                if (compiled.masks) {
                    for (let space of TAG_MASK_SPACE_PRIORITIES) {
                        const tagValue = compiled.masks[space]?.[tag];
                        if (hasValue(tagValue)) {
                            this._compileTagValue(compiled, tag, tagValue);
                            hasTag = true;
                            break;
                        }
                    }
                }

                if (!hasTag) {
                    const tagValue = compiled.tags[tag];
                    if (hasValue(tagValue) || tagValue === null) {
                        this._compileTagValue(compiled, tag, tagValue);
                        hasTag = true;
                    }
                }

                if (!hasTag) {
                    // no tag or tag mask has a value
                    this._compileTagValue(compiled, tag, null);
                }

                const compiledValue = compiled.values[tag];
                partial.values[tag] = hasValue(compiledValue)
                    ? compiledValue
                    : null;
            }

            if (u.signatures) {
                if (!compiled.signatures) {
                    compiled.signatures = {};
                }
                partial.signatures = {};
                for (let sig in u.signatures) {
                    const val = !!u.signatures
                        ? u.signatures[sig] || null
                        : null;
                    const current = compiled.signatures[sig];
                    compiled.signatures[sig] = val;
                    partial.signatures[sig] = val;

                    if (!val && current) {
                        this._compileTag(
                            compiled,
                            current,
                            compiled.tags[current]
                        );
                    } else if (val && !current) {
                        this._compileTag(compiled, val, compiled.tags[val]);
                    }
                }
            }

            nextUpdate.state[id] = <any>partial;

            if (!newBotIds.has(id)) {
                nextUpdate.updatedBots.push(id);
            }
        }
    }

    notifyChange(): void {
        if (!this._batchPending) {
            this._batchPending = true;
            Zone.root.scheduleMicroTask('AuxRuntime#notifyChange', () => {
                this._processBatch();
            });
        }
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

    private _processBatch() {
        this._batchPending = false;
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

        if (actions.length <= 0 && errors.length <= 0) {
            return;
        }

        // Schedule a new micro task to
        // run at a later time with the actions.
        // This ensures that we don't block other flush operations
        // due to handlers running synchronously.
        Zone.root.scheduleMicroTask('AuxRuntime#_processBatch', () => {
            this._onActions.next(actions);
            this._onErrors.next(errors);
        });
    }

    private _batchScriptResults<T>(
        callback: () => T,
        batch: boolean,
        resetEnergy: boolean
    ): { result: T; actions: BotAction[]; errors: ScriptError[] } {
        return this._zone.run(() => {
            const results = this._calculateScriptResults(callback, resetEnergy);

            if (batch) {
                this._actionBatch.push(...results.actions);
            }
            this._errorBatch.push(...results.errors);

            return results;
        });
    }

    private _calculateScriptResults<T>(
        callback: () => T,
        resetEnergy: boolean
    ): { result: T; actions: BotAction[]; errors: ScriptError[] } {
        this._globalContext.playerBot = this.userBot;
        if (resetEnergy) {
            this._globalContext.energy = DEFAULT_ENERGY;
        }
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
            .filter((bot) => {
                return (
                    (Object.keys(bot.changes).length > 0 ||
                        Object.keys(bot.maskChanges).length > 0) &&
                    !this._newBots.has(bot.id) &&
                    isInContext(this._globalContext, bot)
                );
            })
            .map((bot) => {
                let update = {} as PartialBot;
                if (Object.keys(bot.changes).length > 0) {
                    update.tags = { ...bot.changes };
                }
                if (Object.keys(bot.maskChanges).length > 0) {
                    update.masks = {};
                    for (let space in bot.maskChanges) {
                        update.masks[space] = {
                            ...bot.maskChanges[space],
                        };
                    }
                }
                return botUpdated(bot.id, update);
            });
        for (let bot of updatedBots) {
            bot[CLEAR_CHANGES_SYMBOL]();
        }
        const sortedUpdates = sortBy(updates, (u) => u.id);
        this._updatedBots.clear();
        this._newBots.clear();
        actions.push(...sortedUpdates);

        return actions;
    }

    private _compileTags(
        tags: string[],
        compiled: CompiledBot,
        bot: Bot
    ): [string, string][] {
        let updates = [] as [string, string][];
        for (let tag of tags) {
            updates.push(this._compileTagOrMask(compiled, bot, tag));
        }
        return updates;
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
        if (hasValue(bot.signatures)) {
            compiledBot.signatures = bot.signatures;
        }

        // Copy existing tag masks to the new bot
        if (!fromFactory && this._existingMasks[bot.id]) {
            const existing = this._existingMasks[bot.id];
            delete this._existingMasks[bot.id];
            for (let space in existing) {
                if (!bot.masks) {
                    bot.masks = {};
                }
                for (let tag in existing[space]) {
                    if (hasValue(bot.masks?.[space]?.[tag])) {
                        continue;
                    }
                    if (!bot.masks[space]) {
                        bot.masks[space] = {};
                    }
                    bot.masks[space][tag] = existing[space][tag];
                }
            }
        }

        // Copy the new bot tag masks to the compiled bot
        if (hasValue(bot.masks)) {
            compiledBot.masks = {};
            for (let space in bot.masks) {
                compiledBot.masks[space] = {
                    ...bot.masks[space],
                };
            }
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
            this.notifyChange();
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

    updateTagMask(
        bot: CompiledBot,
        tag: string,
        spaces: string[],
        value: any
    ): RealtimeEditMode {
        if (this._globalContext.allowsEditing) {
            let updated = false;
            for (let space of spaces) {
                const mode = this._editModeProvider.getEditMode(space);
                if (mode === RealtimeEditMode.Immediate) {
                    if (!bot.masks) {
                        bot.masks = {};
                    }
                    if (!bot.masks[space]) {
                        bot.masks[space] = {};
                    }
                    bot.masks[space][tag] = value;
                    updated = true;
                }
            }
            if (updated) {
                this._compileTagOrMask(bot, bot, tag);
                this._updatedBots.set(bot.id, bot.script);
                this.notifyChange();
            }

            return RealtimeEditMode.Immediate;
        }

        return RealtimeEditMode.None;
    }

    getTagMask(bot: CompiledBot, tag: string): RealtimeEditMode {
        for (let space of TAG_MASK_SPACE_PRIORITIES) {
            const tagValue = bot.masks?.[space]?.[tag];
            if (hasValue(tagValue)) {
                return tagValue;
            }
        }

        return undefined;
    }

    getListener(bot: CompiledBot, tag: string): CompiledBotListener {
        const listener = bot.listeners[tag];
        if (listener) {
            return listener;
        }
        this.getValue(bot, tag);
        return bot.listeners[tag] || null;
    }

    getSignature(bot: CompiledBot, signature: string): string {
        return !!bot.signatures ? bot.signatures[signature] : undefined;
    }

    private _updateTag(
        newBot: CompiledBot,
        tag: string,
        forceUpdateListener: boolean
    ): any {
        const compiled = newBot.compiledValues[tag];
        try {
            const value = (newBot.values[tag] =
                this._runFormulas && typeof compiled === 'function'
                    ? compiled()
                    : compiled);

            if (
                isScript(value) &&
                (!newBot.listeners[tag] || forceUpdateListener)
            ) {
                newBot.listeners[tag] = this._compile(newBot, tag, value, {
                    allowsEditing: true,
                });
                this._globalContext.recordListenerPresense(
                    newBot.id,
                    tag,
                    !!newBot.listeners[tag]
                );
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

    private _compileTagOrMask(
        bot: CompiledBot,
        existingBot: Bot,
        tag: string
    ): [string, string] {
        let hadMask = false;
        if (existingBot.masks) {
            for (let space of TAG_MASK_SPACE_PRIORITIES) {
                const tagValue = existingBot.masks[space]?.[tag];
                if (hasValue(tagValue)) {
                    if (!bot.masks) {
                        bot.masks = {};
                    }
                    if (!bot.masks[space]) {
                        bot.masks[space] = {};
                    }
                    bot.masks[space][tag] = tagValue;
                    this._compileTagValue(bot, tag, tagValue);
                    return [space, tag];
                } else if (hasValue(bot.masks?.[space]?.[tag])) {
                    // Indicate that there used to be a value for the tag mask
                    // but it has been removed.
                    hadMask = true;
                    break;
                }
            }
        }
        const tagValue = existingBot.tags[tag];
        if (hasValue(tagValue) || tagValue === null) {
            bot.tags[tag] = tagValue;
            this._compileTagValue(bot, tag, tagValue);
            if (hadMask) {
                return [undefined, tag];
            } else {
                return [null, tag];
            }
        }

        // Undefined means that a tag mask was removed.
        return [undefined, tag];
    }

    private _compileTag(bot: CompiledBot, tag: string, tagValue: any) {
        if (bot.masks) {
            for (let space of TAG_MASK_SPACE_PRIORITIES) {
                if (hasValue(bot.masks[space]?.[tag])) {
                    return;
                }
            }
        }
        if (isTagEdit(tagValue)) {
            tagValue = bot.tags[tag] = applyEdit(bot.tags[tag], tagValue);
        } else {
            bot.tags[tag] = tagValue;
        }
        this._compileTagValue(bot, tag, tagValue);
    }

    private _compileTagValue(bot: CompiledBot, tag: string, tagValue: any) {
        let { value, listener } = this._compileValue(bot, tag, tagValue);
        if (listener) {
            bot.listeners[tag] = listener;
            this._globalContext.recordListenerPresense(bot.id, tag, true);
        } else if (!!bot.listeners[tag]) {
            delete bot.listeners[tag];
            this._globalContext.recordListenerPresense(bot.id, tag, false);
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
            const parsed = value.substring(DNA_TAG_PREFIX.length);
            const transformed = replaceMacros(parsed);
            try {
                value = JSON.parse(transformed);
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
        }

        return { value, listener };
    }

    private _compile(
        bot: CompiledBot,
        tag: string,
        script: string,
        options: CompileOptions
    ) {
        if (this._forceSignedScripts) {
            if (this._exemptSpaces.indexOf(bot.space) < 0) {
                const hash = tagValueHash(bot.id, tag, script);
                if (!bot.signatures || bot.signatures[hash] !== tag) {
                    throw new Error(
                        'Unable to compile script. It is not signed with a valid certificate.'
                    );
                }
            }
        }

        return this._compiler.compile(script, {
            // TODO: Support all the weird features
            context: {
                bot,
                tag,
                creator: null as RuntimeBot,
                config: null as RuntimeBot,
            },
            before: (ctx) => {
                // if (!options.allowsEditing) {
                //     ctx.wasEditable = ctx.global.allowsEditing;
                //     ctx.global.allowsEditing = false;
                // }
                ctx.creator = ctx.bot
                    ? this._getRuntimeBot(ctx.bot.script.tags.creator)
                    : null;
                ctx.config = ctx.bot
                    ? this._getRuntimeBot(ctx.bot.script.tags.configBot)
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
                this: (ctx) => (ctx.bot ? ctx.bot.script : null),
                bot: (ctx) => (ctx.bot ? ctx.bot.script : null),
                tags: (ctx) => (ctx.bot ? ctx.bot.script.tags : null),
                raw: (ctx) => (ctx.bot ? ctx.bot.script.raw : null),
                masks: (ctx) => (ctx.bot ? ctx.bot.script.masks : null),
                creator: (ctx) => ctx.creator,
                config: (ctx) => ctx.config,
                configTag: (ctx) =>
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
     * We use this property in action.reject() to resolve the original action value so that doing a action.reject() in a onServerAction works properly.
     *
     * @param context The sandbox context.
     * @param value The value that should be converted.
     */
    private _mapBotsToRuntimeBots(value: any): any {
        return this._mapBotsToRuntimeBotsCore(value, 0, new Map());
    }

    private _mapBotsToRuntimeBotsCore(
        value: any,
        depth: number,
        map: Map<any, any>
    ) {
        if (depth > 1000) {
            throw new DeepObjectError();
        }
        if (isBot(value)) {
            return this._globalContext.state[value.id] || value;
        } else if (Array.isArray(value) && value.some(isBot)) {
            let arr = value.map((b) =>
                isBot(b) ? this._globalContext.state[b.id] || b : b
            );
            (<any>arr)[ORIGINAL_OBJECT] = value;
            return arr;
        } else {
            if (map.has(value)) {
                return map.get(value);
            }
            if (
                hasValue(value) &&
                !Array.isArray(value) &&
                !(value instanceof ArrayBuffer) &&
                typeof value === 'object' &&
                Object.getPrototypeOf(value) === Object.prototype
            ) {
                let result = {
                    [ORIGINAL_OBJECT]: value,
                } as any;
                map.set(value, result);
                forOwn(value, (value, key, object) => {
                    result[key] = this._mapBotsToRuntimeBotsCore(
                        value,
                        depth + 1,
                        map
                    );
                });
                return result;
                // return transform(
                //     value,
                //     (result, value, key) =>
                //         this._transformBotsToRuntimeBots(result, value, key),
                //     { [ORIGINAL_OBJECT]: value }
                // );
            } else if (
                hasValue(value) &&
                Array.isArray(value) &&
                !(value instanceof ArrayBuffer)
            ) {
                const result = [] as any[];
                map.set(value, result);
                result.push(
                    ...value.map((v) =>
                        this._mapBotsToRuntimeBotsCore(v, depth + 1, map)
                    )
                );
                return result;
            }
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

interface UncompiledScript {
    bot: CompiledBot;
    tag: string;
    script: string;
    hash: string;
}
