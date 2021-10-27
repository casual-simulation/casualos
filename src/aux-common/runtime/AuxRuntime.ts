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
    UpdateBotAction,
    isRuntimeBot,
    OpenCustomPortalAction,
    createBot,
    openCustomPortal,
    ON_ERROR,
    action,
    isBotInDimension,
    asyncResult,
    BotActions,
    registerBuiltinPortal,
    botAdded,
} from '../bots';
import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';
import { AuxCompiler, AuxCompiledScript } from './AuxCompiler';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
    isInContext,
} from './AuxGlobalContext';
import {
    AuxDebuggerOptions,
    AuxLibrary,
    createDefaultLibrary,
} from './AuxLibrary';
import {
    RuntimeBotInterface,
    RuntimeBotFactory,
    createRuntimeBot,
    RealtimeEditMode,
} from './RuntimeBot';
import { CompiledBot, CompiledBotsState } from './CompiledBot';
import { ScriptError, ActionResult, RanOutOfEnergyError } from './AuxResults';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import {
    convertToCopiableValue,
    DeepObjectError,
    formatAuthToken,
} from './Utils';
import {
    AuxRealtimeEditModeProvider,
    SpaceRealtimeEditModeMap,
    DefaultRealtimeEditModeProvider,
} from './AuxRealtimeEditModeProvider';
import { sortBy, forOwn, merge, union } from 'lodash';
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
    implements RuntimeBotInterface, RuntimeBotFactory, SubscriptionLike
{
    private _compiledState: CompiledBotsState = {};
    private _existingMasks: { [id: string]: BotTagMasks } = {};
    private _compiler = new AuxCompiler();
    private _onActions: Subject<BotAction[]>;
    private _onErrors: Subject<ScriptError[]>;

    private _actionBatch: BotAction[] = [];
    private _errorBatch: ScriptError[] = [];

    private _userId: string;
    private _sub: Subscription;
    private _currentVersion: RuntimeStateVersion = {
        localSites: {},
        vector: {},
    };

    private _updatedBots = new Map<string, RuntimeBot>();
    private _newBots = new Map<string, Bot>();

    // TODO: Update version number
    // TODO: Update device
    private _globalContext: AuxGlobalContext;

    private _library: AuxLibrary;
    private _editModeProvider: AuxRealtimeEditModeProvider;
    private _forceSignedScripts: boolean;
    private _exemptSpaces: BotSpace[];
    private _batchPending: boolean = false;
    private _processingErrors: boolean = false;
    private _portalBots: Map<string, string> = new Map();
    private _builtinPortalBots: string[] = [];
    private _globalChanges: { [key: string]: any } = {};
    private _globalObject: any;

    /**
     * The counter that is used to generate function names.
     */
    private _functionNameCounter = 0;

    /**
     * A map of function names to their respective functions.
     */
    private _functionMap: Map<string, AuxCompiledScript> = new Map();

    /**
     * A map of bot IDs to a list of function names.
     */
    private _botFunctionMap: Map<string, Set<string>> = new Map();

    /**
     * Whether changes should be automatically batched.
     */
    private _autoBatch: boolean = true;

    private _forceSyncScripts: boolean = false;

    private _libraryFactory: (context: AuxGlobalContext) => AuxLibrary;

    get forceSignedScripts() {
        return this._forceSignedScripts;
    }

    get context() {
        return this._globalContext;
    }

    get currentVersion() {
        return this._currentVersion;
    }

    get globalObject() {
        return this._globalObject;
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
        exemptSpaces: BotSpace[] = ['local', 'tempLocal'],
        forceSyncScripts: boolean = false
    ) {
        this._libraryFactory = libraryFactory;
        this._globalContext = new MemoryGlobalContext(
            version,
            device,
            this,
            this
        );
        this._forceSyncScripts = forceSyncScripts;
        this._globalContext.mockAsyncActions = forceSyncScripts;
        this._library = merge(libraryFactory(this._globalContext), {
            api: {
                os: {
                    createDebugger: this._createDebugger.bind(this),
                },
            },
        });
        this._editModeProvider = editModeProvider;
        this._forceSignedScripts = forceSignedScripts;
        this._exemptSpaces = exemptSpaces;
        this._onActions = new Subject();
        this._onErrors = new Subject();

        let sub = (this._sub = new Subscription(() => {
            this._globalContext.cancelAllBotTimers();
        }));
        sub.add(this._globalContext.startAnimationLoop());

        if (globalThis.addEventListener) {
            const unhandledRejectionListener = (
                event: PromiseRejectionEvent
            ) => {
                const data = this._handleError(event.reason, null, null);
                this._globalContext.enqueueError(data);
                event.preventDefault();
            };
            globalThis.addEventListener(
                'unhandledrejection',
                unhandledRejectionListener
            );
            sub.add(() => {
                globalThis.removeEventListener(
                    'unhandledrejection',
                    unhandledRejectionListener
                );
            });
        }

        this._globalObject = new Proxy(globalThis, {
            get: (target: any, key: string, receiver: any) => {
                if (key in this._globalChanges) {
                    return Reflect.get(this._globalChanges, key);
                }
                return Reflect.get(target, key, receiver);
            },
            set: (target: any, key: string, value: any, receiver: any) => {
                return Reflect.set(this._globalChanges, key, value);
            },
            deleteProperty: (target: any, key: string) => {
                return Reflect.deleteProperty(this._globalChanges, key);
            },
            defineProperty: (target: any, key, options: any) => {
                return Reflect.defineProperty(
                    this._globalChanges,
                    key,
                    options
                );
            },
            ownKeys: (target: any) => {
                const addedKeys = Reflect.ownKeys(this._globalChanges);
                const otherKeys = Reflect.ownKeys(target);
                return union(addedKeys, otherKeys);
            },
            has: (target: any, key: string) => {
                return (
                    Reflect.has(this._globalChanges, key) ||
                    Reflect.has(target, key)
                );
            },
            getOwnPropertyDescriptor: (target: any, key: string) => {
                if (key in this._globalChanges) {
                    return Reflect.getOwnPropertyDescriptor(
                        this._globalChanges,
                        key
                    );
                }
                return Reflect.getOwnPropertyDescriptor(target, key);
            },
        });
        this._globalContext.global = this._globalObject;
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

    get userId(): string {
        return this._userId;
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
        this._processCore(actions);
        this._processBatch();
    }

    private _createDebugger(options?: AuxDebuggerOptions) {
        const runtime = new AuxRuntime(
            this._globalContext.version,
            this._globalContext.device,
            this._libraryFactory,
            this._editModeProvider,
            this._forceSignedScripts,
            this._exemptSpaces,
            !options?.allowAsynchronousScripts
        );
        runtime._autoBatch = false;
        let idCount = 0;
        if (!options?.useRealUUIDs) {
            runtime._globalContext.uuid = () => {
                idCount += 1;
                return `uuid-${idCount}`;
            };
        }
        let allActions = [] as BotAction[];
        let allErrors = [] as ScriptError[];

        let create = runtime._library.tagSpecificApi.create({
            bot: null,
            config: null,
            creator: null,
            tag: null,
        });

        const isCommonAction = (action: BotAction) => {
            return !(
                action.type === 'add_bot' ||
                action.type === 'remove_bot' ||
                action.type === 'update_bot' ||
                action.type === 'apply_state'
            );
        };

        const getAllActions = () => {
            const actions = runtime._processUnbatchedActions();
            allActions.push(...actions);
            return allActions;
        };

        // The config bot is always ID 0 in debuggers
        const configBotId = options?.useRealUUIDs
            ? runtime.context.uuid()
            : 'uuid-0';
        const configBotTags = options?.configBot
            ? isBot(options?.configBot)
                ? options.configBot.tags
                : options.configBot
            : {};
        runtime.context.createBot(
            createBot(configBotId, configBotTags, 'tempLocal')
        );
        runtime.process(
            this._builtinPortalBots.map((b) => registerBuiltinPortal(b))
        );
        runtime.userId = configBotId;

        return {
            ...runtime._library.api,
            getAllActions,
            getCommonActions: () => {
                return getAllActions().filter(isCommonAction);
            },
            getBotActions: () => {
                return getAllActions().filter((a) => !isCommonAction(a));
            },
            getErrors: () => {
                const errors = runtime._processUnbatchedErrors();
                allErrors.push(...errors);
                return allErrors;
            },
            create,
        };
    }

    private _processCore(actions: BotAction[]) {
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
    }

    private _processAction(action: BotAction) {
        if (action.type === 'action') {
            const result = this._shout(
                action.eventName,
                action.botIds,
                action.argument,
                false
            );
            this._processCore(result.actions);
        } else if (action.type === 'run_script') {
            const result = this._execute(action.script, false, false);
            this._processCore(result.actions);
            if (hasValue(action.taskId)) {
                this._globalContext.resolveTask(
                    action.taskId,
                    result.result,
                    false
                );
            }
        } else if (action.type === 'apply_state') {
            const events = breakIntoIndividualEvents(this.currentState, action);
            this._processCore(events);
        } else if (action.type === 'async_result') {
            const value =
                action.mapBotsInResult === true
                    ? this._mapBotsToRuntimeBots(action.result)
                    : action.result;
            if (!this._globalContext.resolveTask(action.taskId, value, false)) {
                this._actionBatch.push(action);
            }
        } else if (action.type === 'async_error') {
            if (
                !this._globalContext.rejectTask(
                    action.taskId,
                    action.error,
                    false
                )
            ) {
                this._actionBatch.push(action);
            }
        } else if (action.type === 'device_result') {
            if (
                !this._globalContext.resolveTask(
                    action.taskId,
                    action.result,
                    true
                )
            ) {
                this._actionBatch.push(action);
            }
        } else if (action.type === 'device_error') {
            if (
                !this._globalContext.rejectTask(
                    action.taskId,
                    action.error,
                    true
                )
            ) {
                this._actionBatch.push(action);
            }
        } else if (action.type === 'open_custom_portal') {
            this._registerPortalBot(action.portalId, action.botId);
            this._actionBatch.push(action);
        } else if (action.type === 'register_custom_app') {
            this._registerPortalBot(action.appId, action.botId);
            this._actionBatch.push(action);
        } else if (action.type === 'register_builtin_portal') {
            if (!this._portalBots.has(action.portalId)) {
                const newBot = this.context.createBot(
                    createBot(this.context.uuid(), undefined, 'tempLocal')
                );
                this._builtinPortalBots.push(action.portalId);
                this._registerPortalBot(action.portalId, newBot.id);
                this._actionBatch.push(
                    openCustomPortal(action.portalId, newBot.id, null, {})
                );
            }
        } else if (action.type === 'define_global_bot') {
            if (this._portalBots.get(action.name) !== action.botId) {
                this._registerPortalBot(action.name, action.botId);
            }
            if (hasValue(action.taskId)) {
                this._processCore([asyncResult(action.taskId, null)]);
            }
        } else if (action.type === 'update_auth_data') {
            const bot = this._compiledState[action.data.userId];
            if (bot) {
                this.updateTag(
                    bot,
                    'authToken',
                    formatAuthToken(action.data.token, action.data.service)
                );
            }
        } else {
            this._actionBatch.push(action);
        }
    }

    private _registerPortalBot(portalId: string, botId: string) {
        const hadPortalBot = this._portalBots.has(portalId);
        this._portalBots.set(portalId, botId);
        if (!hadPortalBot) {
            const variableName = `${portalId}Bot`;
            Object.defineProperty(this._globalObject, variableName, {
                get: () => {
                    const botId = this._portalBots.get(portalId);
                    if (hasValue(botId)) {
                        return this.context.state[botId];
                    } else {
                        return undefined;
                    }
                },
                enumerable: false,
                configurable: true,
            });
        }
    }

    private _rejectAction(action: BotAction): {
        rejected: boolean;
        newActions: BotAction[];
    } {
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
            if (a.type === 'reject' && a.actions.indexOf(action) >= 0) {
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
            fn = this._compile(null, null, script, {});
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
            const { newBots: addedNewBots, newBotIDs: addedBotIds } =
                this._addBotsToState(
                    update.addedBots.map((id) => update.state[id] as Bot),
                    nextUpdate
                );

            newBots = addedNewBots;
            newBotIds = addedBotIds;
        }

        let removedBots = null as CompiledBot[];
        if (update.removedBots.length > 0) {
            removedBots = this._removeBotsFromState(
                update.removedBots,
                nextUpdate
            );
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
        this._triggerPortalChangedHandlers(newBots, removedBots, updates);

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
                for (let bot of botIds) {
                    const watchers = this._globalContext.getWatchersForBot(bot);
                    for (let watcher of watchers) {
                        watcher.handler();
                    }
                }

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

                    const watchers = this._globalContext.getWatchersForBot(
                        update.bot.id
                    );
                    for (let watcher of watchers) {
                        watcher.handler();
                    }
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

    private _triggerPortalChangedHandlers(
        newBots: [CompiledBot, PrecalculatedBot][],
        removedBots: CompiledBot[],
        updates: UpdatedBot[]
    ) {
        const portals = this._globalContext.getWatchedPortals();

        if (!hasValue(this.userId)) {
            return;
        }

        if (portals.size <= 0) {
            return;
        }

        if (
            (!newBots || newBots.length <= 0) &&
            (!removedBots || removedBots.length <= 0) &&
            (!updates || updates.length <= 0)
        ) {
            return;
        }

        const userBot = this.currentState[this.userId];

        if (!userBot) {
            return;
        }

        for (let portal of portals) {
            const dimension = userBot.values[portal];
            let hasChange = false;
            if (hasValue(dimension)) {
                if (newBots && newBots.length > 0) {
                    for (let [_, newBot] of newBots) {
                        if (isBotInDimension(null, newBot, dimension)) {
                            hasChange = true;
                            break;
                        }
                    }
                }

                if (!hasChange && removedBots && removedBots.length > 0) {
                    for (let bot of removedBots) {
                        if (isBotInDimension(null, bot, dimension)) {
                            hasChange = true;
                            break;
                        }
                    }
                }
            }

            if (!hasChange && updates && updates.length > 0) {
                for (let update of updates) {
                    if (hasValue(dimension)) {
                        if (update.tags.includes(dimension)) {
                            hasChange = true;
                            break;
                        }
                    }

                    if (
                        update.bot.id === this.userId &&
                        update.tags.includes(portal)
                    ) {
                        hasChange = true;
                        break;
                    }

                    if (this._portalBots.get(portal) === update.bot.id) {
                        hasChange = true;
                        break;
                    }
                }
            }

            if (hasChange) {
                const watchers =
                    this._globalContext.getWatchersForPortal(portal);
                for (let watcher of watchers) {
                    watcher.handler();
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
                removeFromContext(
                    this._globalContext,
                    [existing.script],
                    false
                );
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
            let tags = Object.keys(bot.values);
            for (let tag of tags) {
                precalculated.values[tag] = convertToCopiableValue(
                    bot.values[tag]
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
        let removedBots: CompiledBot[] = [];
        for (let id of botIds) {
            const bot = this._compiledState[id];
            if (bot) {
                removeFromContext(this._globalContext, [bot.script]);
            }
            removedBots.push(bot);
            delete this._compiledState[id];
            const list = this._getFunctionNamesForBot(id, false);
            if (list) {
                for (let name of list) {
                    this._functionMap.delete(name);
                }
                this._botFunctionMap.delete(id);
            }
            nextUpdate.state[id] = null;
            nextUpdate.removedBots.push(id);
        }

        return removedBots;
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
                partial.values[tag] = convertToCopiableValue(
                    hasValue(compiledValue) ? compiledValue : null
                );
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
        if (!this._batchPending && this._autoBatch) {
            this._batchPending = true;
            queueMicrotask(() => {
                this._processBatch();
            });
        }
    }

    createRuntimeBot(bot: Bot): RuntimeBot {
        const space = getBotSpace(bot);
        const mode = this._editModeProvider.getEditMode(space);
        if (mode === RealtimeEditMode.Immediate) {
            const compiled = this._createCompiledBot(bot, true);
            this._newBots.set(bot.id, bot);
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

        this._processCore(unbatchedActions);
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
        queueMicrotask(() => {
            this._onActions.next(actions);
            this._onErrors.next(errors);
        });

        this._processErrors(errors);
    }

    private _processErrors(errors: ScriptError[]) {
        if (this._processingErrors) {
            return;
        }
        try {
            this._processingErrors = true;

            if (errors.length > 0) {
                let actions = errors
                    .filter((e) => e.tag !== ON_ERROR)
                    .map((e) =>
                        action(ON_ERROR, undefined, undefined, {
                            bot: e.bot,
                            tag: e.tag,
                            error: e.error,
                        })
                    );

                this.process(actions);
            }
        } finally {
            this._processingErrors = false;
        }
    }

    private _batchScriptResults<T>(
        callback: () => T,
        batch: boolean,
        resetEnergy: boolean
    ): { result: T; actions: BotAction[]; errors: ScriptError[] } {
        const results = this._calculateScriptResults(callback, resetEnergy);

        if (batch) {
            this._actionBatch.push(...results.actions);
        }
        this._errorBatch.push(...results.errors);

        return results;
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
        // TODO: Improve to correctly handle when a non ScriptError object is added
        // but contains symbol properties that reference the throwing bot and tag.
        // The AuxRuntime should look for these error objects and create ScriptErrors for them.
        return this._globalContext.dequeueErrors();
    }

    private _processUnbatchedActions() {
        const actions = this._globalContext.dequeueActions();
        const updatedBots = [...this._updatedBots.values()];

        let updates = [] as UpdateBotAction[];
        for (let bot of updatedBots) {
            const hasTagChange = Object.keys(bot.changes).length > 0;
            const hasMaskChange = Object.keys(bot.maskChanges).length > 0;
            const hasChange = hasTagChange || hasMaskChange;
            if (hasChange) {
                const isNewBot = this._newBots.has(bot.id);
                if (isNewBot) {
                    // tag mask changes need to be handled here
                    // because new bots don't share the same reference to the
                    // bot in the add bot event (unlike normal bots)
                    if (hasMaskChange) {
                        const newBot = this._newBots.get(bot.id);
                        newBot.masks = {};
                        for (let space in bot.maskChanges) {
                            newBot.masks[space] = {
                                ...bot.maskChanges[space],
                            };
                        }
                    }
                } else {
                    if (isInContext(this._globalContext, bot)) {
                        let update = {} as PartialBot;
                        if (hasTagChange) {
                            update.tags = { ...bot.changes };
                        }
                        if (hasMaskChange) {
                            update.masks = {};
                            for (let space in bot.maskChanges) {
                                update.masks[space] = {
                                    ...bot.maskChanges[space],
                                };
                            }
                        }
                        updates.push(botUpdated(bot.id, update));
                    }
                }
            }
        }
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
        if (isRuntimeBot(newValue)) {
            throw new Error(
                `It is not possible to save bots as tag values. (Setting '${tag}' on ${bot.id})`
            );
        }

        const space = getBotSpace(bot);
        const mode = this._editModeProvider.getEditMode(space);
        if (mode === RealtimeEditMode.Immediate) {
            this._compileTag(bot, tag, newValue);
        }
        this._updatedBots.set(bot.id, bot.script);
        this.notifyChange();
        return mode;
    }

    getValue(bot: CompiledBot, tag: string): any {
        return bot.values[tag];
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
        if (isRuntimeBot(value)) {
            throw new Error(
                `It is not possible to save bots as tag values. (Setting '${tag}' on ${bot.id})`
            );
        }

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
            if (hasValue(tagValue)) {
                bot.tags[tag] = tagValue;
            } else {
                delete bot.tags[tag];
            }
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
        if (typeof value !== 'function') {
            if (hasValue(value)) {
                bot.values[tag] = value;
            } else {
                delete bot.values[tag];
            }
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
                listener = this._compile(bot, tag, value, {});
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

        script = replaceMacros(script);

        let functionName: string;
        let diagnosticFunctionName: string;
        let fileName: string;
        if (hasValue(bot)) {
            this._functionNameCounter += 1;
            functionName = '_' + this._functionNameCounter;
            diagnosticFunctionName = tag;
            fileName = `${bot.id}.${diagnosticFunctionName}`;
        }

        const func = this._compiler.compile(script, {
            // TODO: Support all the weird features

            functionName: functionName,
            diagnosticFunctionName: diagnosticFunctionName,
            fileName: fileName,
            forceSync: this._forceSyncScripts,
            context: {
                bot,
                tag,
                creator: null as RuntimeBot,
            },
            before: (ctx) => {
                ctx.creator = ctx.bot
                    ? this._getRuntimeBot(ctx.bot.script.tags.creator)
                    : null;
            },
            onError: (err, ctx, meta) => {
                const data = this._handleError(err, ctx.bot, ctx.tag);
                throw data;
            },
            constants: {
                ...this._library.api,
                tagName: tag,
                globalThis: this._globalObject,
            },
            variables: {
                ...this._library.tagSpecificApi,
                this: (ctx) => (ctx.bot ? ctx.bot.script : null),
                thisBot: (ctx) => (ctx.bot ? ctx.bot.script : null),
                bot: (ctx) => (ctx.bot ? ctx.bot.script : null),
                tags: (ctx) => (ctx.bot ? ctx.bot.script.tags : null),
                raw: (ctx) => (ctx.bot ? ctx.bot.script.raw : null),
                masks: (ctx) => (ctx.bot ? ctx.bot.script.masks : null),
                creatorBot: (ctx) => ctx.creator,
                configBot: () => this.context.playerBot,
            },
            arguments: [['that', 'data']],
        });

        if (hasValue(bot)) {
            this._functionMap.set(functionName, func);
            const botFunctionNames = this._getFunctionNamesForBot(bot.id);
            botFunctionNames.add(functionName);
        }

        return func;
    }

    private _handleError(err: any, bot: Bot, tag: string): ScriptError {
        if (err instanceof RanOutOfEnergyError) {
            throw err;
        }
        let data: ScriptError = {
            error: err,
            bot: bot,
            tag: tag,
        };
        if (err instanceof Error) {
            try {
                const newStack = this._compiler.calculateOriginalStackTrace(
                    this._functionMap,
                    err
                );

                if (newStack) {
                    (<any>err).oldStack = err.stack;
                    err.stack = newStack;
                }
            } catch (stackError) {
                console.error(
                    '[AuxRuntime] Unable to transform error stack trace',
                    stackError
                );
            }
        }
        return data;
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
     * We use this property in action.reject() to resolve the original action value so that doing a action.reject() in a onAnyAction works properly.
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

    private _getFunctionNamesForBot(
        botId: string,
        createIfDoesNotExist = true
    ): Set<string> {
        let list = this._botFunctionMap.get(botId);
        if (!list && createIfDoesNotExist) {
            list = new Set();
            this._botFunctionMap.set(botId, list);
        }

        return list;
    }
}

/**
 * Options that are used to influence the behavior of the compiled script.
 */
interface CompileOptions {}

interface UncompiledScript {
    bot: CompiledBot;
    tag: string;
    script: string;
    hash: string;
}
