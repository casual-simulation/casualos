/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type {
    StateUpdatedEvent,
    Bot,
    UpdatedBot,
    PrecalculatedBot,
    BotSpace,
    PartialBot,
    BotTagMasks,
    RuntimeBot,
    UpdateBotAction,
    BotModule,
    IdentifiedBotModule,
    ImportFunc,
    ExportFunc,
    BotModuleResult,
    SourceModule,
    ResolvedBotModule,
    ImportMetadata,
    DynamicListener,
} from '@casual-simulation/aux-common/bots';
import {
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
    updatedBot,
    TAG_MASK_SPACE_PRIORITIES,
    CLEAR_CHANGES_SYMBOL,
    DNA_TAG_PREFIX,
    isRuntimeBot,
    createBot,
    ON_ERROR,
    action,
    isBotInDimension,
    asyncResult,
    registerBuiltinPortal,
    defineGlobalBot,
    isBotLink,
    parseBotLink,
    isBotDate,
    parseBotDate,
    formatBotDate,
    isTaggedString,
    parseTaggedString,
    parseNumber,
    isTaggedNumber,
    isBotVector,
    parseBotVector,
    formatBotVector,
    isBotRotation,
    parseBotRotation,
    formatBotRotation,
    parseTaggedNumber,
    REPLACE_BOT_SYMBOL,
    isModule,
    calculateStringTagValue,
    ON_RESOLVE_MODULE,
} from '@casual-simulation/aux-common/bots';
import type { Observable, SubscriptionLike } from 'rxjs';
import { Subject, Subscription } from 'rxjs';
import type {
    AuxCompiledScript,
    CompiledBotModule,
    AuxCompileOptions,
} from './AuxCompiler';
import {
    AuxCompiler,
    getInterpretableFunction,
    isInterpretableFunction,
    IMPORT_META_FACTORY,
    IMPORT_FACTORY,
    EXPORT_FACTORY,
} from './AuxCompiler';
import type { AuxGlobalContext } from './AuxGlobalContext';
import {
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
    isInContext,
} from './AuxGlobalContext';
import type {
    AuxDebuggerOptions,
    AuxLibrary,
    DebuggerCallFrame,
    DebuggerFunctionLocation,
    DebuggerPause,
    DebuggerVariable,
    PauseTrigger,
    PauseTriggerOptions,
    TagSpecificApiOptions,
} from './AuxLibrary';
import { createDefaultLibrary, GET_RUNTIME } from './AuxLibrary';
import type {
    RuntimeBotInterface,
    RuntimeBotFactory,
    RealtimeEditConfig,
    RuntimeInterpreterGeneratorProcessor,
} from './RuntimeBot';
import { createRuntimeBot, RealtimeEditMode } from './RuntimeBot';
import type {
    CompiledBot,
    CompiledBotsState,
    RuntimeBreakpoint,
    RuntimeStop,
    RuntimeStopState,
} from './CompiledBot';
import type {
    ScriptError,
    ActionResult,
    ProcessActionResult,
} from './AuxResults';
import { RanOutOfEnergyError } from './AuxResults';
import type { AuxVersion } from './AuxVersion';
import type { AuxDevice } from './AuxDevice';
import type { RuntimePromise } from './Utils';
import {
    isPromise,
    isRuntimePromise,
    isUrl,
    markAsRuntimePromise,
} from './Utils';
import type { AuxRealtimeEditModeProvider } from './AuxRealtimeEditModeProvider';
import { DefaultRealtimeEditModeProvider } from './AuxRealtimeEditModeProvider';
import { sortBy, forOwn, merge, union } from 'lodash';
import { applyTagEdit, isTagEdit } from '@casual-simulation/aux-common/bots';
import type { CurrentVersion } from '@casual-simulation/aux-common';
import type { RuntimeStateVersion } from './RuntimeStateVersion';
import { updateRuntimeVersion } from './RuntimeStateVersion';
import { replaceMacros } from './Transpiler';
import { DateTime } from 'luxon';
import { Rotation, Vector2, Vector3 } from '@casual-simulation/aux-common/math';
import type {
    Interpreter as InterpreterType,
    InterpreterContinuation,
    InterpreterStop,
} from '@casual-simulation/js-interpreter';
import type {
    DeclarativeEnvironmentRecord as DeclarativeEnvironmentRecordType,
    DefinePropertyOrThrow as DefinePropertyOrThrowType,
    Descriptor as DescriptorType,
    ExecutionContextStack,
    Value as ValueType,
} from '@casual-simulation/engine262';
import {
    isGenerator,
    markAsUncopiableObject,
    UNCOPIABLE,
} from '@casual-simulation/js-interpreter/InterpreterUtils';
import { v4 as uuid } from 'uuid';
import { importInterpreter as _dynamicImportInterpreter } from './AuxRuntimeDynamicImports';
import { UNMAPPABLE } from '@casual-simulation/aux-common/bots/BotEvents';
import type {
    DebuggerTagMaskUpdate,
    DebuggerTagUpdate,
    RuntimeActions,
} from './RuntimeEvents';

import {
    DeepObjectError,
    convertToCopiableValue,
} from '@casual-simulation/aux-common/partitions/PartitionUtils';

let Interpreter: typeof InterpreterType;
let DeclarativeEnvironmentRecord: typeof DeclarativeEnvironmentRecordType;
let DefinePropertyOrThrow: typeof DefinePropertyOrThrowType;
let Descriptor: typeof DescriptorType;
let Value: typeof ValueType;
let hasModule = false;
let interpreterImportPromise: Promise<void>;

export function registerInterpreterModule(module: any) {
    hasModule = true;
    Interpreter = module.Interpreter;
    DeclarativeEnvironmentRecord = module.DeclarativeEnvironmentRecord;
    DefinePropertyOrThrow = module.DefinePropertyOrThrow;
    Descriptor = module.Descriptor;
    Value = module.Value;
}

function importInterpreter(): Promise<void> {
    if (hasModule) {
        return Promise.resolve();
    }
    if (interpreterImportPromise) {
        return interpreterImportPromise;
    } else {
        return (interpreterImportPromise = _importInterpreterCore());
    }
}

async function _importInterpreterCore(): Promise<void> {
    const module = await _dynamicImportInterpreter();
    registerInterpreterModule(module);
}

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime
    implements
        RuntimeBotInterface,
        RuntimeBotFactory,
        RuntimeInterpreterGeneratorProcessor,
        SubscriptionLike
{
    private _compiledState: CompiledBotsState = {};
    private _existingMasks: { [id: string]: BotTagMasks } = {};
    private _compiler = new AuxCompiler();
    private _onActions: Subject<RuntimeActions[]>;
    private _onErrors: Subject<ScriptError[]>;
    private _onRuntimeStop: Subject<RuntimeStop>;
    private _stopState: RuntimeStopState = null;
    private _breakpoints: Map<string, RuntimeBreakpoint> = new Map();
    private _currentStopCount = 0;
    private _currentPromise: MaybeRuntimePromise<any> = null;

    private _actionBatch: RuntimeActions[] = [];
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
    private _exemptSpaces: BotSpace[];
    private _batchPending: boolean = false;
    private _jobQueueCheckPending: boolean = false;
    private _jobQueueCheckCount: number = 0;
    private _processingErrors: boolean = false;
    private _portalBots: Map<string, string> = new Map();
    private _builtinPortalBots: string[] = [];
    private _globalChanges: { [key: string]: any } = {};
    private _globalObject: any;
    private _interpretedApi: AuxLibrary['api'];
    private _interpretedTagSpecificApi: AuxLibrary['tagSpecificApi'];
    private _beforeActionListeners: ((action: RuntimeActions) => void)[] = [];
    private _scriptActionEnqueuedListeners: ((
        action: RuntimeActions
    ) => void)[] = [];
    private _scriptUpdatedTagListeners: ((
        update: DebuggerTagUpdate
    ) => void)[] = [];
    private _scriptUpdatedTagMaskListeners: ((
        update: DebuggerTagMaskUpdate
    ) => void)[] = [];
    // private _beforeScriptEnterListeners: ((
    //     trace: DebuggerScriptEnterTrace
    // ) => void)[] = [];
    // private _afterScriptExitListeners: ((
    //     trace: DebuggerScriptExitTrace
    // ) => void)[] = [];

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
    private _currentDebugger: any = null;

    private _libraryFactory: (context: AuxGlobalContext) => AuxLibrary;
    private _interpreter: InterpreterType;

    /**
     * The map of module IDs to their exports.
     * Only used for global modules, which are modules that are not attached to a bot (e.g. source modules).
     */
    private _cachedGlobalModules: Map<string, Promise<BotModuleResult>> =
        new Map();

    /**
     * The map of system IDs to their respective bot IDs.
     */
    private _systemMap: Map<string, Set<string>> = new Map();

    /**
     * The number of times that the runtime can call onError for an error from the same script.
     */
    repeatedErrorLimit: number = 1000;

    get library() {
        return this._library;
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

    get canTriggerBreakpoint() {
        return !!this._interpreter && this._interpreter.debugging;
    }

    get systemMap() {
        return this._systemMap;
    }

    /**
     * Creates a new AuxRuntime using the given library factory.
     * @param libraryFactory
     * @param forceSignedScripts Whether to force the runtime to only allow scripts that are signed.
     * @param exemptSpaces The spaces that are exempt from requiring signed scripts.
     * @param interpreter The interpreter that should be used for the runtime.
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        libraryFactory: (
            context: AuxGlobalContext
        ) => AuxLibrary = createDefaultLibrary,
        editModeProvider: AuxRealtimeEditModeProvider = new DefaultRealtimeEditModeProvider(),
        exemptSpaces: BotSpace[] = ['local', 'tempLocal'],
        forceSyncScripts: boolean = false,
        interpreter: InterpreterType = null
    ) {
        this._libraryFactory = libraryFactory;
        this._interpreter = interpreter;
        this._globalContext = new MemoryGlobalContext(
            version,
            device,
            this,
            this,
            this
        );
        this._forceSyncScripts = forceSyncScripts;
        this._globalContext.mockAsyncActions = forceSyncScripts;
        this._library = merge(libraryFactory(this._globalContext), {
            api: {
                os: {
                    createDebugger: this._createDebugger.bind(this),
                    getExecutingDebugger: this._getExecutingDebugger.bind(this),
                },
            },
        });
        this._editModeProvider = editModeProvider;
        this._exemptSpaces = exemptSpaces;
        this._onActions = new Subject();
        this._onErrors = new Subject();
        this._onRuntimeStop = new Subject();

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
                } else if (key in target) {
                    return Reflect.get(target, key);
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

        if (this._interpreter) {
            // Use the interpreted versions of APIs

            this._interpretedApi = { ...this._library.api };
            this._interpretedTagSpecificApi = {
                ...this._library.tagSpecificApi,
            };

            for (let key in this._interpretedApi) {
                const val = this._interpretedApi[key];
                if (isInterpretableFunction(val)) {
                    this._interpretedApi[key] = getInterpretableFunction(val);
                }
            }

            for (let key in this._interpretedTagSpecificApi) {
                const val = this._interpretedTagSpecificApi[key];

                if (isInterpretableFunction(val)) {
                    this._interpretedTagSpecificApi[key] =
                        getInterpretableFunction(val);
                }
            }
        }
    }

    private async _importModule(
        module: string | ResolvedBotModule,
        meta: ImportMetadata,
        dependencyChain: string[] = [],
        allowCustomResolution: boolean = true
    ): Promise<BotModuleResult> {
        try {
            let m: ResolvedBotModule;
            let bot: CompiledBot;
            const allowResolution =
                meta.tag !== ON_RESOLVE_MODULE && allowCustomResolution;
            if (typeof module !== 'string') {
                m = module;
                if (!m) {
                    throw new Error('Module not found: ' + module);
                }
            } else {
                const globalModule = this._cachedGlobalModules.get(module);
                if (globalModule) {
                    return await globalModule;
                }

                m = await this.resolveModule(module, meta, allowResolution);
                if (!m) {
                    throw new Error('Module not found: ' + module);
                }

                if (dependencyChain.length > 1) {
                    const index = dependencyChain.indexOf(m.id);
                    if (index >= 0) {
                        throw new Error(
                            `Circular dependency detected: ${dependencyChain
                                .slice(index)
                                .join(' -> ')} -> ${m.id}`
                        );
                    }
                }

                if ('botId' in m) {
                    bot = this._compiledState[m.botId];
                    if (bot) {
                        const exports = bot.exports[m.tag];
                        if (exports) {
                            return await exports;
                        }
                    }
                }
            }

            const promise = this._importModuleCore(
                m,
                [...dependencyChain, m.id],
                allowResolution
            );
            if (bot) {
                bot.exports[(m as IdentifiedBotModule).tag] = promise;
            } else {
                this._cachedGlobalModules.set(m.id, promise);
            }

            return await promise;
        } finally {
            this._scheduleJobQueueCheck();
        }
    }

    private async _importModuleCore(
        m: ResolvedBotModule,
        dependencyChain: string[],
        allowCustomResolution: boolean
    ): Promise<BotModuleResult> {
        try {
            const exports: BotModuleResult = {};
            const importFunc: ImportFunc = (id, meta) =>
                this._importModule(
                    id,
                    meta,
                    dependencyChain,
                    allowCustomResolution
                );
            const exportFunc: ExportFunc = async (valueOrSource, e, meta) => {
                const result = await this._resolveExports(
                    valueOrSource,
                    e,
                    meta,
                    dependencyChain,
                    allowCustomResolution
                );
                this._scheduleJobQueueCheck();
                Object.assign(exports, result);
            };

            if ('botId' in m) {
                const bot = this._compiledState[m.botId];
                const module = bot?.modules[m.tag];
                if (module) {
                    await module.moduleFunc(importFunc, exportFunc);
                }
            } else if ('source' in m) {
                const source = (m as SourceModule).source;
                const mod = this._compile(null, null, source, {});

                if (mod.moduleFunc) {
                    await mod.moduleFunc(importFunc, exportFunc);
                }
            } else if ('exports' in m) {
                Object.assign(exports, m.exports);
            } else if ('url' in m) {
                return await this.dynamicImport(m.url);
            }
            return exports;
        } finally {
            this._scheduleJobQueueCheck();
        }
    }

    private async _resolveExports(
        valueOrSource: string | object,
        exports: (string | [string, string])[],
        meta: ImportMetadata,
        dependencyChain: string[],
        allowCustomResolution: boolean
    ): Promise<BotModuleResult> {
        if (typeof valueOrSource === 'string') {
            const sourceModule = await this._importModule(
                valueOrSource,
                meta,
                dependencyChain,
                allowCustomResolution
            );
            if (exports) {
                const result: BotModuleResult = {};
                for (let val of exports) {
                    if (typeof val === 'string') {
                        result[val] = sourceModule[val];
                    } else {
                        const [source, target] = val;
                        const key = target ?? source;
                        result[key] = sourceModule[source];
                    }
                }
                return result;
            } else {
                return sourceModule;
            }
        } else {
            return valueOrSource;
        }
    }

    /**
     * Performs a dynamic import() of the given module.
     * Uses the JS Engine's native import() functionality.
     * @param module The module that should be imported.
     * @returns Returns a promise that resolves with the module's exports.
     */
    async dynamicImport(module: string): Promise<BotModuleResult> {
        return await import(/* @vite-ignore */ module);
    }

    /**
     * Attempts to resolve the module with the given name.
     * @param moduleName The name of the module to resolve.
     * @param meta The metadata that should be used to resolve the module.
     */
    async resolveModule(
        moduleName: string,
        meta?: ImportMetadata,
        allowCustomResolution: boolean = true
    ): Promise<ResolvedBotModule> {
        if (meta?.tag === ON_RESOLVE_MODULE) {
            allowCustomResolution = false;
        }

        if (moduleName === 'casualos') {
            let exports = {
                ...this._library.api,
            };

            const bot = meta?.botId ? this._compiledState[meta.botId] : null;
            const ctx: TagSpecificApiOptions = {
                bot,
                tag: meta?.tag,
                creator: bot
                    ? this._getRuntimeBot(bot.script.tags.creator)
                    : null,
                config: null,
            };
            for (let key in this._library.tagSpecificApi) {
                if (
                    !Object.prototype.hasOwnProperty.call(
                        this._library.tagSpecificApi,
                        key
                    )
                ) {
                    continue;
                }
                const result = this._library.tagSpecificApi[key](ctx);
                exports[key] = result;
            }

            return {
                id: 'casualos',
                exports,
            };
        }

        if (allowCustomResolution) {
            const shoutResult = this.shout(ON_RESOLVE_MODULE, undefined, {
                module: moduleName,
                meta,
            });
            const actionResult: ActionResult = isRuntimePromise(shoutResult)
                ? await shoutResult
                : shoutResult;

            for (let scriptResult of actionResult.results) {
                const result = await scriptResult;
                if (result) {
                    if (typeof result === 'object') {
                        if (
                            typeof result.botId === 'string' &&
                            typeof result.tag === 'string'
                        ) {
                            const bot = this._compiledState[result.botId];
                            const mod = bot?.modules[result.tag];
                            if (mod) {
                                return {
                                    botId: result.botId,
                                    id: moduleName,
                                    tag: result.tag,
                                };
                            }
                        } else if (
                            typeof result.exports === 'object' &&
                            result.exports
                        ) {
                            return {
                                id: moduleName,
                                exports: result.exports,
                            };
                        }
                    } else if (typeof result === 'string') {
                        if (isUrl(result)) {
                            return {
                                id: moduleName,
                                url: result,
                            };
                        } else {
                            return {
                                id: moduleName,
                                source: result,
                            };
                        }
                    }
                }
            }
        }

        const isRelativeImport =
            moduleName.startsWith('.') || moduleName.startsWith(':');

        if (isRelativeImport) {
            if (!meta) {
                throw new Error(
                    'Cannot resolve relative import without metadata'
                );
            }

            const bot = this._compiledState[meta.botId];
            if (!bot) {
                throw new Error('Cannot resolve relative import without bot');
            }

            const system = calculateStringTagValue(
                null,
                bot,
                'system',
                `🔗${bot.id}`
            );
            const split = system.split('.');

            for (let i = 0; i < moduleName.length; i++) {
                if (moduleName[i] === ':') {
                    split.pop();
                } else if (moduleName[i] === '.') {
                    /* empty */
                } else {
                    moduleName =
                        split.join('.') + '.' + moduleName.substring(i);
                    break;
                }
            }
        }

        if (moduleName.startsWith('🔗')) {
            const [id, tag] = moduleName.substring('🔗'.length).split('.');
            const bot = this._compiledState[id];
            if (bot && tag) {
                return {
                    id: moduleName,
                    botId: bot.id,
                    tag: tag,
                };
            }
        }

        const lastIndex = moduleName.lastIndexOf('.');
        if (lastIndex >= 0) {
            const system = moduleName.substring(0, lastIndex);
            const tag = moduleName.substring(lastIndex + 1);
            const botIds = this._systemMap.get(system);
            if (botIds) {
                for (let id of botIds) {
                    const bot = this._compiledState[id];
                    if (bot && bot.modules[tag]) {
                        return {
                            botId: id,
                            id: moduleName,
                            tag: tag,
                        };
                    }
                }
            }
        }

        return {
            id: moduleName,
            url: moduleName,
        };
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
    get onActions(): Observable<RuntimeActions[]> {
        return this._onActions;
    }

    /**
     * An observable that resolves whenever the runtime issues an error.
     */
    get onErrors(): Observable<ScriptError[]> {
        return this._onErrors;
    }

    /**
     * An observable that resolves whenever the runtime pauses in a script.
     */
    get onRuntimeStop(): Observable<RuntimeStop> {
        return this._onRuntimeStop;
    }

    /**
     * Processes the given bot actions and dispatches the resulting actions in the future.
     * @param actions The actions to process.
     */
    process(actions: RuntimeActions[]) {
        if (this._beforeActionListeners.length > 0) {
            for (let func of this._beforeActionListeners) {
                for (let action of actions) {
                    try {
                        func(action);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

        this._processBatch();
        const result = this._processCore(actions);
        this._processBatch();

        return result;
    }

    private _getExecutingDebugger() {
        return this._currentDebugger;
    }

    private async _createDebugger(options?: AuxDebuggerOptions) {
        const forceSyncScripts =
            typeof options?.allowAsynchronousScripts === 'boolean'
                ? !options.allowAsynchronousScripts
                : false;

        await importInterpreter();

        const interpreter = options?.pausable ? new Interpreter() : null;

        const runtime = new AuxRuntime(
            this._globalContext.version,
            this._globalContext.device,
            this._libraryFactory,
            this._editModeProvider,
            this._exemptSpaces,
            forceSyncScripts,
            interpreter
        );
        runtime._autoBatch = true;
        let idCount = 0;
        if (!options?.useRealUUIDs) {
            runtime._globalContext.uuid = () => {
                idCount += 1;
                return `uuid-${idCount}`;
            };
        }
        let allActions = [] as RuntimeActions[];
        let allErrors = [] as ScriptError[];

        let create: any;

        if (
            interpreter &&
            isInterpretableFunction(runtime._library.tagSpecificApi.create)
        ) {
            const func = getInterpretableFunction(
                runtime._library.tagSpecificApi.create
            )({
                bot: null,
                config: null,
                creator: null,
                tag: null,
            });

            create = (...args: any[]) => {
                const result = func(...args);
                if (isGenerator(result)) {
                    return runtime._processGenerator(result);
                }
                return result;
            };
        } else {
            create = runtime._library.tagSpecificApi.create({
                bot: null,
                config: null,
                creator: null,
                tag: null,
            });
        }

        const isCommonAction = (action: RuntimeActions) => {
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

        const api = {
            ...runtime._library.api,
        };

        if (interpreter) {
            for (let key in runtime._library.api) {
                const val = runtime._library.api[key];
                if (isInterpretableFunction(val)) {
                    const func = getInterpretableFunction(val);
                    api[key] = (...args: any[]) => {
                        const result = func(...args);
                        if (isGenerator(result)) {
                            return runtime._processGenerator(result);
                        }
                        return result;
                    };
                }
            }
        }

        if (interpreter && options?.pausable) {
            interpreter.debugging = true;
        }

        const debug = {
            [UNCOPIABLE]: true,
            ...api,
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
            onBeforeUserAction: (
                listener: (action: RuntimeActions) => void
            ) => {
                runtime._beforeActionListeners.push(listener);
            },
            onScriptActionEnqueued: (
                listener: (action: RuntimeActions) => void
            ) => {
                runtime._scriptActionEnqueuedListeners.push(listener);
            },
            onAfterScriptUpdatedTag: (
                listener: (update: DebuggerTagUpdate) => void
            ) => {
                runtime._scriptUpdatedTagListeners.push(listener);
            },
            onAfterScriptUpdatedTagMask: (
                listener: (update: DebuggerTagMaskUpdate) => void
            ) => {
                runtime._scriptUpdatedTagMaskListeners.push(listener);
            },
            getCallStack() {
                if (!interpreter) {
                    throw new Error(
                        'getCallStack() is only supported on pausable debuggers.'
                    );
                }
                return runtime._mapCallStack(
                    interpreter.agent.executionContextStack
                );
            },
            async performUserAction(...actions: RuntimeActions[]) {
                const result = await runtime.process(actions);
                return result.map((r) => (r ? r.results : null));
            },
            // TODO: Determine whether to support this
            // onBeforeScriptEnter: (
            //     listener: (trace: DebuggerScriptEnterTrace) => void
            // ) => {
            //     runtime._beforeScriptEnterListeners.push(listener);
            // },
            // onAfterScriptExit: (
            //     listener: (trace: DebuggerScriptExitTrace) => void
            // ) => {
            //     runtime._afterScriptExitListeners.push(listener);
            // },
            setPauseTrigger(
                b: RuntimeBot | string | PauseTrigger,
                tag: string,
                options: PauseTriggerOptions
            ) {
                if (typeof b === 'object' && 'triggerId' in b) {
                    runtime.setBreakpoint({
                        id: b.triggerId,
                        botId: b.botId,
                        tag: b.tag,
                        lineNumber: b.lineNumber,
                        columnNumber: b.columnNumber,
                        states: b.states ?? ['before'],
                        disabled: !(b.enabled ?? true),
                    });

                    return b;
                } else {
                    const id: string = isBot(b) ? b.id : (b as string);
                    const trigger: PauseTrigger = {
                        triggerId: uuid(),
                        botId: id,
                        tag: tag,
                        ...options,
                    };
                    runtime.setBreakpoint({
                        id: trigger.triggerId,
                        botId: id,
                        tag: tag,
                        lineNumber: trigger.lineNumber,
                        columnNumber: trigger.columnNumber,
                        states: trigger.states ?? ['before'],
                        disabled: false,
                    });

                    return trigger;
                }
            },
            removePauseTrigger(triggerOrId: string | PauseTrigger) {
                let id =
                    typeof triggerOrId === 'string'
                        ? triggerOrId
                        : triggerOrId.triggerId;
                runtime.removeBreakpoint(id);
            },
            disablePauseTrigger(triggerOrId: string | PauseTrigger) {
                if (typeof triggerOrId === 'string') {
                    let trigger = runtime._breakpoints.get(triggerOrId);
                    if (trigger) {
                        trigger.disabled = true;
                    }
                } else {
                    runtime.setBreakpoint({
                        id: triggerOrId.triggerId,
                        botId: triggerOrId.botId,
                        tag: triggerOrId.tag,
                        lineNumber: triggerOrId.lineNumber,
                        columnNumber: triggerOrId.columnNumber,
                        states: triggerOrId.states ?? ['before'],
                        disabled: true,
                    });
                }
            },
            enablePauseTrigger(triggerOrId: string | PauseTrigger) {
                if (typeof triggerOrId === 'string') {
                    let trigger = runtime._breakpoints.get(triggerOrId);
                    if (trigger) {
                        trigger.disabled = false;
                    }
                } else {
                    runtime.setBreakpoint({
                        id: triggerOrId.triggerId,
                        botId: triggerOrId.botId,
                        tag: triggerOrId.tag,
                        lineNumber: triggerOrId.lineNumber,
                        columnNumber: triggerOrId.columnNumber,
                        states: triggerOrId.states ?? ['before'],
                        disabled: false,
                    });
                }
            },
            listPauseTriggers() {
                let triggers: PauseTrigger[] = [];
                for (let breakpoint of runtime._breakpoints.values()) {
                    triggers.push({
                        triggerId: breakpoint.id,
                        botId: breakpoint.botId,
                        tag: breakpoint.tag,
                        columnNumber: breakpoint.columnNumber,
                        lineNumber: breakpoint.lineNumber,
                        states: breakpoint.states.slice(),
                        enabled: !breakpoint.disabled,
                    });
                }

                return triggers;
            },
            listCommonPauseTriggers(botOrId: RuntimeBot | string, tag: string) {
                const id = typeof botOrId === 'string' ? botOrId : botOrId.id;
                const bot = runtime.currentState[id];
                const func = bot.listeners[tag] as AuxCompiledScript;
                if (!func) {
                    return [];
                }

                return runtime._compiler.listPossibleBreakpoints(
                    func,
                    runtime._interpreter
                );
            },
            onPause(callback: (pause: DebuggerPause) => void) {
                runtime.onRuntimeStop.subscribe((stop) => {
                    const pause: DebuggerPause = {
                        pauseId: stop.stopId,
                        state: stop.state,
                        callStack: runtime._mapCallStack(stop.stack),
                        trigger: {
                            triggerId: stop.breakpoint.id,
                            botId: stop.breakpoint.botId,
                            tag: stop.breakpoint.tag,
                            lineNumber: stop.breakpoint.lineNumber,
                            columnNumber: stop.breakpoint.columnNumber,
                            states: stop.breakpoint.states,
                        },
                    };

                    callback(pause);
                });
            },
            resume(pause: DebuggerPause) {
                runtime.continueAfterStop(pause.pauseId);
            },
            [GET_RUNTIME]() {
                return runtime;
            },

            get configBot() {
                return runtime.userBot;
            },

            getPortalBots() {
                let portalBots = new Map<string, RuntimeBot>();
                for (let [portal, id] of runtime._portalBots) {
                    portalBots.set(portal, runtime.currentState[id]?.script);
                }
                return portalBots;
            },
            create,
        };

        runtime._currentDebugger = debug;
        this._scheduleJobQueueCheck();
        return debug;
    }

    private _mapCallStack(stack: ExecutionContextStack) {
        const interpreter = this._interpreter;
        return stack.map((s) => {
            const callSite: any = (s as any).callSite;
            const funcName: string = callSite.getFunctionName();

            let funcLocation: DebuggerFunctionLocation = {};

            if (funcName) {
                const f = this._functionMap.get(funcName);
                if (f) {
                    funcLocation.name = f.metadata.diagnosticFunctionName;
                    const location =
                        this._compiler.calculateOriginalLineLocation(f, {
                            lineNumber: callSite.lineNumber,
                            column: callSite.columnNumber,
                        });

                    funcLocation.lineNumber = location.lineNumber + 1;
                    funcLocation.columnNumber = location.column + 1;

                    const tagName = f.metadata.context.tag as string;
                    const bot = f.metadata.context.bot as Bot;

                    if (bot) {
                        funcLocation.botId = bot.id;
                    }
                    if (tagName) {
                        funcLocation.tag = tagName;
                    }
                } else {
                    funcLocation.name = funcName;
                }
            }

            if (
                !hasValue(funcLocation.lineNumber) &&
                !hasValue(funcLocation.columnNumber) &&
                hasValue(callSite.lineNumber) &&
                hasValue(callSite.columnNumber)
            ) {
                funcLocation.lineNumber = callSite.lineNumber;
                funcLocation.columnNumber = callSite.columnNumber;
            }

            if (
                !hasValue(funcLocation.lineNumber) &&
                !hasValue(funcLocation.columnNumber) &&
                !hasValue(funcLocation.name)
            ) {
                funcLocation = null;
            }

            const ret: DebuggerCallFrame = {
                location: funcLocation,
                listVariables() {
                    let variables: DebuggerVariable[] = [];

                    if (
                        s.LexicalEnvironment instanceof
                        DeclarativeEnvironmentRecord
                    ) {
                        addBindingsFromEnvironment(
                            s.LexicalEnvironment,
                            'block'
                        );
                    }

                    if (
                        s.VariableEnvironment instanceof
                        DeclarativeEnvironmentRecord
                    ) {
                        addBindingsFromEnvironment(
                            s.VariableEnvironment,
                            'frame'
                        );

                        let parent = s.VariableEnvironment.OuterEnv;
                        while (parent) {
                            if (
                                parent instanceof DeclarativeEnvironmentRecord
                            ) {
                                addBindingsFromEnvironment(parent, 'closure');
                            }
                            parent = parent.OuterEnv;
                        }
                    }

                    return variables;

                    function addBindingsFromEnvironment(
                        env: DeclarativeEnvironmentRecordType,
                        scope: DebuggerVariable['scope']
                    ) {
                        for (let [
                            nameValue,
                            binding,
                        ] of env.bindings.entries()) {
                            const name = interpreter.copyFromValue(nameValue);

                            const initialized = !!binding.initialized;
                            const mutable = !!binding.mutable;

                            const value = initialized
                                ? interpreter.reverseProxyObject(
                                      binding.value,
                                      false
                                  )
                                : undefined;

                            const variable: DebuggerVariable = {
                                name,
                                value,
                                writable: mutable,
                                scope,
                            };
                            if (!initialized) {
                                variable.initialized = false;
                            }

                            variables.push(variable);
                        }
                    }
                },
                setVariableValue(name: string, value: any) {
                    if (
                        s.LexicalEnvironment instanceof
                        DeclarativeEnvironmentRecord
                    ) {
                        const nameValue = interpreter.copyToValue(name);
                        const proxiedValue = interpreter.proxyObject(value);

                        if (nameValue.Type !== 'normal') {
                            throw interpreter.copyFromValue(nameValue.Value);
                        }

                        if (proxiedValue.Type !== 'normal') {
                            throw interpreter.copyFromValue(proxiedValue.Value);
                        }

                        const result = s.LexicalEnvironment.SetMutableBinding(
                            nameValue.Value,
                            proxiedValue.Value,
                            Value.true
                        );

                        if (result.Type !== 'normal') {
                            throw interpreter.copyFromValue(result.Value);
                        }
                        return interpreter.copyFromValue(result.Value);
                    }
                },
            };

            return ret;
        });
    }

    private _processCore(
        actions: RuntimeActions[]
    ): MaybeRuntimePromise<ProcessActionResult[]> {
        const _this = this;
        const results = [] as ProcessActionResult[];

        function processAction(
            action: RuntimeActions,
            addToResults: boolean
        ): MaybeRuntimePromise<void> {
            let promise = _this._processAction(action);

            if (addToResults) {
                if (isRuntimePromise(promise)) {
                    return markAsRuntimePromise(
                        promise.then((result) => {
                            results.push(result);
                        })
                    );
                } else {
                    results.push(promise);
                }
                return;
            }

            return promise as unknown as MaybeRuntimePromise<void>;
        }

        function handleRejection(
            action: RuntimeActions,
            rejection: { rejected: boolean; newActions: RuntimeActions[] }
        ): MaybeRuntimePromise<void> {
            let promise: MaybeRuntimePromise<void> = processListOfMaybePromises(
                null,
                rejection.newActions,
                (action) => {
                    return processAction(action, false);
                }
            );
            if (rejection.rejected) {
                return;
            }

            if (promise) {
                return markAsRuntimePromise(
                    promise.then((p) => processAction(action, true))
                );
            } else {
                return processAction(action, true);
            }
        }
        let promise = processListOfMaybePromises(null, actions, (action) => {
            let rejection = this._rejectAction(action);

            let result: MaybeRuntimePromise<void>;
            if (isRuntimePromise(rejection)) {
                result = markAsRuntimePromise(
                    rejection.then((result) => handleRejection(action, result))
                );
            } else {
                result = handleRejection(action, rejection);
            }
            return result;
        });

        if (isRuntimePromise(promise)) {
            return markAsRuntimePromise(promise.then(() => results));
        } else {
            return results;
        }
    }

    private _processAction(
        action: RuntimeActions
    ): MaybeRuntimePromise<ProcessActionResult> {
        if (action.type === 'action') {
            const result = this._shout(
                action.eventName,
                action.botIds,
                action.argument,
                false
            );
            if (isRuntimePromise(result)) {
                return markAsRuntimePromise(
                    result
                        .then((result) => this._processCore(result.actions))
                        .then(() => result)
                );
            } else {
                let promise = this._processCore(result.actions);
                if (isRuntimePromise(promise)) {
                    return markAsRuntimePromise(promise.then(() => result));
                } else {
                    return result;
                }
            }
        } else if (action.type === 'run_script') {
            const result = this._execute(action.script, false, false);
            if (isRuntimePromise(result)) {
                return markAsRuntimePromise(
                    result.then((result) => {
                        const p = this._processCore(result.actions);
                        if (isPromise(p)) {
                            return p.then(() => {
                                if (hasValue(action.taskId)) {
                                    this._globalContext.resolveTask(
                                        action.taskId,
                                        result.result,
                                        false
                                    );
                                }
                                return null as any;
                            });
                        } else {
                            if (hasValue(action.taskId)) {
                                if (
                                    this._globalContext.resolveTask(
                                        action.taskId,
                                        result.result,
                                        false
                                    )
                                ) {
                                    this._scheduleJobQueueCheck();
                                }
                            }
                        }
                        return null as any;
                    })
                );
            } else {
                const p = this._processCore(result.actions);
                if (isRuntimePromise(p)) {
                    return markAsRuntimePromise(
                        p.then(() => {
                            if (hasValue(action.taskId)) {
                                if (
                                    this._globalContext.resolveTask(
                                        action.taskId,
                                        result.result,
                                        false
                                    )
                                ) {
                                    this._scheduleJobQueueCheck();
                                }
                            }
                            return null as any;
                        })
                    );
                }
                if (hasValue(action.taskId)) {
                    if (
                        this._globalContext.resolveTask(
                            action.taskId,
                            result.result,
                            false
                        )
                    ) {
                        this._scheduleJobQueueCheck();
                    }
                }
            }
        } else if (action.type === 'apply_state') {
            const events = breakIntoIndividualEvents(this.currentState, action);
            const promise = this._processCore(events);
            if (isRuntimePromise(promise)) {
                return markAsRuntimePromise(promise.then(() => null as any));
            } else {
                return null;
            }
        } else if (action.type === 'async_result') {
            const value =
                action.mapBotsInResult === true
                    ? this._mapBotsToRuntimeBots(action.result)
                    : action.result;
            if (!this._globalContext.resolveTask(action.taskId, value, false)) {
                this._actionBatch.push(action);
            } else {
                this._scheduleJobQueueCheck();
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
            } else {
                this._scheduleJobQueueCheck();
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
            } else {
                this._scheduleJobQueueCheck();
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
            } else {
                this._scheduleJobQueueCheck();
            }
        } else if (action.type === 'iterable_next') {
            if (
                !this._globalContext.iterableNext(
                    action.taskId,
                    action.value,
                    false
                )
            ) {
                this._actionBatch.push(action);
            } else {
                this._scheduleJobQueueCheck();
            }
        } else if (action.type === 'iterable_complete') {
            if (!this._globalContext.iterableComplete(action.taskId, false)) {
                this._actionBatch.push(action);
            } else {
                this._scheduleJobQueueCheck();
            }
        } else if (action.type === 'iterable_throw') {
            if (
                !this._globalContext.iterableThrow(
                    action.taskId,
                    action.error,
                    false
                )
            ) {
                this._actionBatch.push(action);
            } else {
                this._scheduleJobQueueCheck();
            }
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
                    defineGlobalBot(action.portalId, newBot.id)
                );
            } else {
                const botId = this._portalBots.get(action.portalId);
                this._actionBatch.push(defineGlobalBot(action.portalId, botId));
            }
        } else if (action.type === 'define_global_bot') {
            if (this._portalBots.get(action.name) !== action.botId) {
                this._registerPortalBot(action.name, action.botId);
                this._actionBatch.push(action);
            }
            if (hasValue(action.taskId)) {
                const promise = this._processCore([
                    asyncResult(action.taskId, null),
                ]);
                if (isRuntimePromise(promise)) {
                    return markAsRuntimePromise(
                        promise.then(() => null as any)
                    );
                } else {
                    return null;
                }
            }
        } else {
            this._actionBatch.push(action);
        }
        return null;
    }

    private _registerPortalBot(portalId: string, botId: string) {
        const hadPortalBot = this._portalBots.has(portalId);
        this._portalBots.set(portalId, botId);
        if (!hadPortalBot) {
            const variableName = `${portalId}Bot`;
            const getValue = () => {
                const botId = this._portalBots.get(portalId);
                if (hasValue(botId)) {
                    return this.context.state[botId];
                } else {
                    return undefined;
                }
            };
            Object.defineProperty(this._globalObject, variableName, {
                get: getValue,
                enumerable: false,
                configurable: true,
            });

            if (this._interpreter) {
                const proxiedGetResult =
                    this._interpreter.proxyObject(getValue);
                if (proxiedGetResult.Type !== 'normal') {
                    throw this._interpreter.copyFromValue(
                        proxiedGetResult.Value
                    );
                }

                DefinePropertyOrThrow(
                    this._interpreter.realm.GlobalObject,
                    new Value(variableName),
                    new Descriptor({
                        Get: proxiedGetResult.Value,
                        Configurable: Value.true,
                    })
                );
            }
        }
    }

    private _rejectAction(action: RuntimeActions): MaybeRuntimePromise<{
        rejected: boolean;
        newActions: RuntimeActions[];
    }> {
        const result = this._shout(
            ON_ACTION_ACTION_NAME,
            null,
            {
                action: action,
            },
            false
        );

        if (isRuntimePromise(result)) {
            return markAsRuntimePromise(
                result.then((result) => {
                    return handleResult(result);
                })
            );
        }

        return handleResult(result);

        function handleResult(result: ActionResult) {
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
    }

    /**
     * Executes the given function based on the current execution state of the runtime.
     * If the runtime is stopped, then the given function will be executed after the current promise finishes.
     * If the runtime is executing normally, then the given function will be executed immediately.
     * Returns the function result if the function executes immediately,
     * or returns a runtime promise if the function executes after the current promise.
     *
     * This function essentially forces the given function to execute synchronously with respect to other functions wrapped with this function.
     *
     * @param func The function to execute.
     *
     */
    private _wrapWithCurrentPromise<T>(func: () => MaybeRuntimePromise<T>) {
        if (this._stopState && isRuntimePromise(this._currentPromise)) {
            // We have hit a breakpoint,
            // only trigger this shout after the current state has finished.
            return (this._currentPromise = markAsRuntimePromise(
                this._currentPromise.then(() => {
                    return func();
                })
            ));
        }
        return (this._currentPromise = func());
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * @param eventName The name of the event.
     * @param botIds The Bot IDs that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): MaybeRuntimePromise<ActionResult> {
        return this._synchronousShout(eventName, botIds, arg, true, true);
    }

    /**
     * Executes the given shout synchronously with respect to other scripts that may be running or paused.
     * @param eventName The name of the event that should be executed.
     * @param botIds The IDs of the bots that the shout should be sent to.
     * @param arg The argument that should be sent with the shout.
     * @param batch Whether to batch events.
     * @param resetEnergy Whether to reset the runtime energy before executing the shout.
     */
    private _synchronousShout(
        eventName: string,
        botIds: string[],
        arg: any,
        batch: boolean,
        resetEnergy: boolean = true
    ) {
        return this._wrapWithCurrentPromise(() => {
            return this._shout(eventName, botIds, arg, batch, resetEnergy);
        });
    }

    private _shout(
        eventName: string,
        botIds: string[],
        arg: any,
        batch: boolean,
        resetEnergy: boolean = true
    ): MaybeRuntimePromise<ActionResult> {
        try {
            arg = this._mapBotsToRuntimeBots(arg);
            if (this._interpreter) {
                const result = this._interpreter.proxyObject(arg);
                if (result.Type !== 'normal') {
                    throw new Error(`Unable to proxy shout argument!`);
                }
                arg = result.Value;
            }
        } catch (err) {
            arg = err;
        }
        const result = this._batchScriptResults(
            () => {
                if (this.canTriggerBreakpoint) {
                    const results = (
                        hasValue(botIds)
                            ? getInterpretableFunction(
                                  this._library.api.whisper
                              )(botIds, eventName, arg)
                            : getInterpretableFunction(this._library.api.shout)(
                                  eventName,
                                  arg
                              )
                    ) as Generator<
                        InterpreterStop,
                        any[],
                        InterpreterContinuation
                    >;

                    return this._processGenerator(results);
                } else {
                    const results = hasValue(botIds)
                        ? this._library.api.whisper(botIds, eventName, arg)
                        : this._library.api.shout(eventName, arg);

                    this._scheduleJobQueueCheck();

                    return results;
                }
            },
            batch,
            resetEnergy
        );

        if (isRuntimePromise(result)) {
            return markAsRuntimePromise(
                result.then(({ actions, errors, result }) => {
                    return {
                        actions,
                        errors,
                        results: result,
                        listeners: [] as Bot[],
                    };
                })
            );
        }

        return {
            actions: result.actions,
            errors: result.errors,
            results: result.result,
            listeners: [],
        };
    }

    /**
     * Executes the given script.
     * @param script The script to run.
     */
    execute(script: string) {
        return this._wrapWithCurrentPromise(() => {
            return this._execute(script, true, true);
        });
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
        let nextUpdate: StateUpdatedEvent = {
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
            version: update.version,
        };

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
        this._currentVersion = updateRuntimeVersion(
            newVersion,
            this._currentVersion
        );
        return this._currentVersion;
    }

    private _sendOnBotsAddedShouts(
        newBots: [CompiledBot, PrecalculatedBot][],
        nextUpdate: StateUpdatedEvent
    ) {
        if (newBots && nextUpdate.addedBots.length > 0) {
            try {
                this._synchronousShout(
                    ON_BOT_ADDED_ACTION_NAME,
                    nextUpdate.addedBots,
                    undefined,
                    true,
                    false
                );
                this._synchronousShout(
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

    private _sendOnBotsRemovedShouts(
        botIds: string[]
    ): MaybeRuntimePromise<void | ActionResult> {
        if (botIds.length > 0) {
            try {
                let promise: MaybeRuntimePromise<void>;
                for (let bot of botIds) {
                    const watchers = this._globalContext.getWatchersForBot(bot);
                    promise = processListOfMaybePromises(
                        promise,
                        watchers,
                        (watcher) => {
                            const generator = watcher.handler();
                            if (isGenerator(generator)) {
                                return this._processGenerator(generator);
                            }
                        }
                    );
                }

                if (promise) {
                    return markAsRuntimePromise(
                        promise
                            .then(() => {
                                return this._synchronousShout(
                                    ON_ANY_BOTS_REMOVED_ACTION_NAME,
                                    null,
                                    {
                                        botIDs: botIds,
                                    },
                                    true,
                                    false
                                );
                            })
                            .catch((err) => {
                                if (!(err instanceof RanOutOfEnergyError)) {
                                    throw err;
                                } else {
                                    console.warn(err);
                                }
                            })
                    );
                } else {
                    const maybePromise = this._synchronousShout(
                        ON_ANY_BOTS_REMOVED_ACTION_NAME,
                        null,
                        {
                            botIDs: botIds,
                        },
                        true,
                        false
                    );

                    if (isRuntimePromise(maybePromise)) {
                        return markAsRuntimePromise(
                            maybePromise.catch((err) => {
                                if (!(err instanceof RanOutOfEnergyError)) {
                                    throw err;
                                } else {
                                    console.warn(err);
                                }
                            })
                        );
                    }
                }
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
                let promise = processListOfMaybePromises(
                    null,
                    updates,
                    (update) => {
                        if (!update) {
                            return;
                        }

                        let promise = this._synchronousShout(
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
                        return processListOfMaybePromises(
                            promise,
                            watchers,
                            (watcher) => {
                                const generator = watcher.handler();
                                if (isGenerator(generator)) {
                                    return this._processGenerator(generator);
                                }
                                return generator;
                            }
                        );
                    }
                );

                if (isPromise(promise)) {
                    return promise
                        .then(() => {
                            return this._synchronousShout(
                                ON_ANY_BOTS_CHANGED_ACTION_NAME,
                                null,
                                updates,
                                true,
                                false
                            );
                        })
                        .catch((err) => {
                            if (!(err instanceof RanOutOfEnergyError)) {
                                throw err;
                            } else {
                                console.warn(err);
                            }
                        });
                } else {
                    const maybePromise = this._synchronousShout(
                        ON_ANY_BOTS_CHANGED_ACTION_NAME,
                        null,
                        updates,
                        true,
                        false
                    );

                    if (isPromise(maybePromise)) {
                        return maybePromise.catch((err) => {
                            if (!(err instanceof RanOutOfEnergyError)) {
                                throw err;
                            } else {
                                console.warn(err);
                            }
                        });
                    } else {
                        return maybePromise;
                    }
                }
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

        return processListOfMaybePromises(null, portals, (portal) => {
            const dimension: string = userBot.values[portal];
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
                        if (bot) {
                            if (isBotInDimension(null, bot, dimension)) {
                                hasChange = true;
                                break;
                            }
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

                return processListOfMaybePromises(null, watchers, (watcher) => {
                    const generator = watcher.handler();
                    if (isGenerator(generator)) {
                        return this._processGenerator(generator);
                    }
                });
            }
        });
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

                let replacedBot = false;
                if (existing.masks) {
                    for (let space in existing.masks) {
                        const masks = existing.masks[space];
                        if (masks) {
                            if (!replacedBot) {
                                replacedBot = true;
                                bot = {
                                    ...bot,
                                };
                                if (bot.masks) {
                                    bot.masks = {
                                        ...bot.masks,
                                    };
                                } else {
                                    bot.masks = {};
                                }
                                bot.masks[space] = Object.assign(
                                    {},
                                    bot.masks[space] ?? {},
                                    masks
                                );
                            }
                        }
                    }
                }
            }

            let newBot: CompiledBot = this._createCompiledBot(bot, false);

            if (!!existing) {
                const changes = existing.script.changes;
                const maskChanges = existing.script.maskChanges;

                for (let key in changes) {
                    newBot.tags[key] =
                        newBot.values[key] =
                        newBot.script.changes[key] =
                            changes[key];
                }
                for (let space of TAG_MASK_SPACE_PRIORITIES) {
                    const changedMasks = maskChanges[space];
                    let newMasks: BotTagMasks;
                    let addNewMasks = false;
                    let hasNewMasks = false;
                    if (!newBot?.masks?.[space]) {
                        addNewMasks = true;
                        newMasks = {};
                    } else {
                        newMasks = newBot.masks[space];
                    }
                    if (changedMasks) {
                        if (!newBot.script.maskChanges[space]) {
                            newBot.script.maskChanges[space] = {};
                        }
                        for (let key in changedMasks) {
                            hasNewMasks = true;
                            newMasks[key] = newBot.script.maskChanges[space][
                                key
                            ] = changedMasks[key];
                        }
                    }

                    if (addNewMasks && hasNewMasks) {
                        if (!newBot.masks) {
                            newBot.masks = {};
                        }
                        newBot.masks[space] = newMasks;
                    }
                }

                newBot.dynamicListeners = existing.dynamicListeners;
                newBot.listenerOverrides = existing.listenerOverrides;
                existing.script[REPLACE_BOT_SYMBOL](newBot.script);
            }

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

                const system: string = bot.values['system'];
                if (hasValue(system)) {
                    const map = this._systemMap.get(system);
                    map?.delete(bot.id);
                }

                for (let breakpoint of bot.breakpoints) {
                    this._interpreter.removeBreakpointById(breakpoint.id);
                    this._breakpoints.delete(breakpoint.id);
                }
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
                            const originalValue =
                                tag in compiled.originalTagEditValues
                                    ? compiled.originalTagEditValues[tag]
                                    : compiled.tags[tag];
                            compiled.tags[tag] = applyTagEdit(
                                originalValue,
                                tagValue
                            );
                        } else {
                            compiled.tags[tag] = tagValue;
                        }
                        delete compiled.originalTagEditValues[tag];
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
                                const originalValue =
                                    compiled.originalTagMaskEditValues[space] &&
                                    tag in
                                        compiled.originalTagMaskEditValues[
                                            space
                                        ]
                                        ? compiled.originalTagMaskEditValues[
                                              space
                                          ][tag]
                                        : compiled.masks[space][tag];
                                compiled.masks[space][tag] = applyTagEdit(
                                    originalValue,
                                    tagValue
                                );
                            } else {
                                compiled.masks[space][tag] = tagValue;
                            }
                            delete compiled.originalTagMaskEditValues[space]?.[
                                tag
                            ];
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

            for (let breakpoint of compiled.breakpoints) {
                if (updatedTags.has(breakpoint.tag)) {
                    // Update the breakpoint
                    const func = compiled.listeners[breakpoint.tag];
                    if (func) {
                        this._compiler.setBreakpoint({
                            id: breakpoint.id,
                            func: func as AuxCompiledScript,
                            interpreter: this._interpreter,
                            lineNumber: breakpoint.lineNumber,
                            columnNumber: breakpoint.columnNumber,
                            states: breakpoint.states,
                        });
                    } else {
                        this._interpreter.removeBreakpointById(breakpoint.id);
                    }
                }
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

            if (this.canTriggerBreakpoint) {
                this._scheduleJob('notifyChange', () => {
                    this._processBatch();
                });
                return;
            }

            queueMicrotask(() => {
                this._processBatch();
            });
        }
    }

    notifyActionEnqueued(action: RuntimeActions): void {
        if (this._scriptActionEnqueuedListeners.length > 0) {
            for (let listener of this._scriptActionEnqueuedListeners) {
                try {
                    listener(action);
                } catch (err) {
                    console.error(err);
                }
            }
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
                const actions: RuntimeActions[] = [];

                for (let e of errors) {
                    if (e.tag === ON_ERROR) {
                        continue;
                    }

                    if (e.bot && e.tag) {
                        const b = this._compiledState[e.bot.id];

                        if (b) {
                            let currentCount = b.errorCounts[e.tag] || 0;
                            if (currentCount === this.repeatedErrorLimit) {
                                console.warn(
                                    `[AuxRuntime] Repeated error limit reached for tag on bot: ${e.bot.id}.${e.tag}`
                                );
                                console.warn(
                                    `[AuxRuntime] If this happens, then there is likely a bug in your inst that causes @onError and @${e.tag} to call each other infinitely.`
                                );
                            }
                            currentCount = b.errorCounts[e.tag] =
                                currentCount + 1;
                            if (currentCount > this.repeatedErrorLimit) {
                                continue;
                            }
                        }
                    }

                    actions.push(
                        action(ON_ERROR, undefined, undefined, {
                            bot: e.bot,
                            tag: e.tag,
                            error: e.error,
                        })
                    );
                }

                this.process(actions);
            }
        } finally {
            this._processingErrors = false;
        }
    }

    private _batchScriptResults<T>(
        callback: () => MaybeRuntimePromise<T>,
        batch: boolean,
        resetEnergy: boolean
    ): MaybeRuntimePromise<{
        result: T;
        actions: RuntimeActions[];
        errors: ScriptError[];
    }> {
        const result = this._calculateScriptResults(callback, resetEnergy);

        if (isRuntimePromise(result)) {
            return markAsRuntimePromise(
                result.then((results) => {
                    if (batch) {
                        this._actionBatch.push(...results.actions);
                        this.notifyChange();
                    }
                    this._errorBatch.push(...results.errors);
                    return results;
                })
            );
        }

        if (batch) {
            this._actionBatch.push(...result.actions);
        }
        this._errorBatch.push(...result.errors);

        return result;
    }

    private _calculateScriptResults<T>(
        callback: () => MaybeRuntimePromise<T>,
        resetEnergy: boolean
    ): MaybeRuntimePromise<{
        result: T;
        actions: RuntimeActions[];
        errors: ScriptError[];
    }> {
        this._globalContext.playerBot = this.userBot;
        if (resetEnergy) {
            this._globalContext.energy = DEFAULT_ENERGY;
        }
        const result = callback();

        if (isRuntimePromise(result)) {
            return markAsRuntimePromise(
                result.then((results) => {
                    const actions = this._processUnbatchedActions();
                    const errors = this._processUnbatchedErrors();
                    return {
                        result: results,
                        actions: actions,
                        errors: errors,
                    };
                })
            );
        }

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

        for (let action of actions) {
            if (action.type === 'add_bot') {
                if (this._newBots.has(action.id)) {
                    action.bot.tags = {
                        ...action.bot.tags,
                    };
                }
            }
        }

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
            listenerOverrides: {},
            dynamicListeners: {},
            modules: {},
            exports: {},
            values: {},
            script: null,
            originalTagEditValues: {},
            originalTagMaskEditValues: {},
            breakpoints: [],
            errorCounts: {},
        };
        if (BOT_SPACE_TAG in bot) {
            compiledBot.space = bot.space;
        }
        if (hasValue(bot.signatures)) {
            compiledBot.signatures = bot.signatures;
        }

        // Copy existing tag masks to the new bot
        if (!fromFactory && this._existingMasks[bot.id]) {
            bot = { ...bot };
            if (bot.masks) {
                bot.masks = { ...bot.masks };
            }
            const existing = this._existingMasks[bot.id];
            delete this._existingMasks[bot.id];
            for (let space in existing) {
                if (!bot.masks) {
                    bot.masks = {};
                } else if (bot.masks[space]) {
                    bot.masks[space] = { ...bot.masks[space] };
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

    updateTag(
        bot: CompiledBot,
        tag: string,
        newValue: any
    ): RealtimeEditConfig {
        if (isRuntimeBot(newValue)) {
            throw new Error(
                `It is not possible to save bots as tag values. (Setting '${tag}' on ${bot.id})`
            );
        }

        const oldValue = bot.values[tag];
        const space = getBotSpace(bot);
        const mode = this._editModeProvider.getEditMode(space);
        if (mode === RealtimeEditMode.Immediate) {
            this._compileTag(bot, tag, newValue);
        }
        this._updatedBots.set(bot.id, bot.script);
        this.notifyChange();

        if (newValue instanceof DateTime) {
            newValue = formatBotDate(newValue);
        } else if (newValue instanceof Vector2 || newValue instanceof Vector3) {
            newValue = formatBotVector(newValue);
        } else if (newValue instanceof Rotation) {
            newValue = formatBotRotation(newValue);
        }

        if (this._scriptUpdatedTagListeners.length > 0) {
            for (let listener of this._scriptUpdatedTagListeners) {
                try {
                    listener({
                        botId: bot.id,
                        tag,
                        oldValue,
                        newValue,
                    });
                } catch (err) {
                    console.error(err);
                }
            }
        }

        return {
            mode,
            changedValue: newValue,
        };
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
    ): RealtimeEditConfig {
        if (isRuntimeBot(value)) {
            throw new Error(
                `It is not possible to save bots as tag values. (Setting '${tag}' on ${bot.id})`
            );
        }

        let oldValuesAndSpaces = [];
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
                let oldValue = bot.masks[space][tag];
                if (isTagEdit(value)) {
                    if (!bot.originalTagMaskEditValues[space]) {
                        bot.originalTagMaskEditValues[space] = {};
                    }
                    if (!(tag in bot.originalTagMaskEditValues[space])) {
                        bot.originalTagMaskEditValues[space][tag] =
                            bot.masks[space][tag];
                    }
                    bot.masks[space][tag] = applyTagEdit(
                        bot.masks[space][tag],
                        value
                    );
                } else {
                    bot.masks[space][tag] = value;
                }
                updated = true;

                oldValuesAndSpaces.push({
                    space,
                    oldValue,
                });
            }
        }
        if (updated) {
            this._compileTagOrMask(bot, bot, tag);
            this._updatedBots.set(bot.id, bot.script);
            this.notifyChange();
        }

        if (value instanceof DateTime) {
            value = formatBotDate(value);
        } else if (value instanceof Vector2 || value instanceof Vector3) {
            value = formatBotVector(value);
        } else if (value instanceof Rotation) {
            value = formatBotRotation(value);
        }

        if (updated && this._scriptUpdatedTagMaskListeners.length > 0) {
            for (let listener of this._scriptUpdatedTagMaskListeners) {
                for (let { oldValue, space } of oldValuesAndSpaces) {
                    try {
                        listener({
                            botId: bot.id,
                            tag,
                            oldValue,
                            newValue: value,
                            space,
                        });
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

        return {
            mode: RealtimeEditMode.Immediate,
            changedValue: value,
        };
    }

    getTagMask(bot: CompiledBot, tag: string): any {
        for (let space of TAG_MASK_SPACE_PRIORITIES) {
            const tagValue = bot.masks?.[space]?.[tag];
            if (hasValue(tagValue)) {
                return this._compileTagMaskValue(bot, tag, space, tagValue);
            }
        }

        return undefined;
    }

    getListener(bot: CompiledBot, tag: string): DynamicListener | null {
        return bot.listenerOverrides[tag] || bot.listeners[tag] || null;
    }

    setListener(
        bot: CompiledBot,
        tag: string,
        listener: DynamicListener | null
    ): void {
        if (hasValue(listener)) {
            bot.listenerOverrides[tag] = listener;
        } else {
            delete bot.listenerOverrides[tag];
        }
        this._updateListenerPresense(bot, tag);
    }

    getDynamicListeners(
        bot: CompiledBot,
        tag: string
    ): DynamicListener[] | null {
        if (bot.dynamicListeners && bot.dynamicListeners[tag]) {
            return bot.dynamicListeners[tag];
        }
        return null;
    }

    addDynamicListener(
        bot: CompiledBot,
        tag: string,
        listener: DynamicListener
    ): void {
        if (!bot.dynamicListeners) {
            bot.dynamicListeners = {};
        }
        if (!bot.dynamicListeners[tag]) {
            bot.dynamicListeners[tag] = [];
        }
        const listeners = bot.dynamicListeners[tag];
        if (listeners.includes(listener)) {
            // If the listener already exists, do not add it again.
            return;
        }
        listeners.push(listener);
        this._updateListenerPresense(bot, tag);
    }

    removeDynamicListener(
        bot: CompiledBot,
        tag: string,
        listener: DynamicListener
    ): void {
        if (bot.dynamicListeners && bot.dynamicListeners[tag]) {
            const listeners = bot.dynamicListeners[tag];
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
                if (listeners.length <= 0) {
                    delete bot.dynamicListeners[tag];
                }
                this._updateListenerPresense(bot, tag);
            }
        }
    }

    getTagLink(bot: CompiledBot, tag: string): RuntimeBot | RuntimeBot[] {
        const tagValue = bot.values[tag];
        if (isBotLink(tagValue)) {
            const links = parseBotLink(tagValue);
            const bots = links.map((link) => this.context.state[link] || null);
            if (bots.length === 1) {
                return bots[0];
            }
            return bots;
        }
        return undefined;
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
            if (!(tag in bot.originalTagEditValues)) {
                bot.originalTagEditValues[tag] = bot.tags[tag];
            }
            tagValue = bot.tags[tag] = applyTagEdit(bot.tags[tag], tagValue);
        } else {
            if (tag in bot.originalTagEditValues) {
                delete bot.originalTagEditValues[tag];
            }
            if (hasValue(tagValue)) {
                if (
                    this._newBots.has(bot.id) &&
                    (tagValue instanceof DateTime ||
                        tagValue instanceof Vector2 ||
                        tagValue instanceof Vector3 ||
                        tagValue instanceof Rotation)
                ) {
                    bot.tags[tag] = convertToCopiableValue(tagValue);
                } else {
                    bot.tags[tag] = tagValue;
                }
            } else {
                delete bot.tags[tag];
            }
        }
        this._compileTagValue(bot, tag, tagValue);
    }

    private _updateListenerPresense(bot: CompiledBot, tag: string) {
        this._globalContext.recordListenerPresense(
            bot.id,
            tag,
            !!bot.listenerOverrides[tag] ||
                !!bot.listeners[tag] ||
                !!bot.dynamicListeners[tag]
        );
    }

    private _compileTagValue(bot: CompiledBot, tag: string, tagValue: any) {
        let { value, listener, module } = this._compileValue(
            bot,
            tag,
            tagValue
        );
        if (listener) {
            bot.listeners[tag] = listener;
            this._updateListenerPresense(bot, tag);
        } else if (!!bot.listeners[tag]) {
            delete bot.listeners[tag];
            this._updateListenerPresense(bot, tag);
        }

        if (module) {
            bot.modules[tag] = module;
        } else if (!!bot.modules[tag]) {
            delete bot.modules[tag];
        }
        if (bot.exports[tag]) {
            delete bot.exports[tag];
        }

        if (typeof value !== 'function') {
            if (tag === 'system') {
                const originalValue: string = bot.values[tag];
                if (originalValue !== value) {
                    if (hasValue(originalValue)) {
                        let originalSystemBots =
                            this._systemMap.get(originalValue);
                        if (originalSystemBots) {
                            // originalSystemBots = new Set();
                            // this._systemMap.set(originalValue ?? value, originalSystemBots);
                            originalSystemBots.delete(bot.id);
                            if (originalSystemBots.size <= 0) {
                                this._systemMap.delete(originalValue);
                            }
                        }
                    }

                    if (hasValue(value)) {
                        let systemBots = this._systemMap.get(value as string);
                        if (!systemBots) {
                            systemBots = new Set();
                            this._systemMap.set(value as string, systemBots);
                        }
                        systemBots.add(bot.id);
                    }
                }
            }
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
        listener: CompiledBotModule;
        module: CompiledBotModule;
    } {
        let listener: CompiledBotModule;
        let module: CompiledBotModule;
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
        } else if (isModule(value)) {
            try {
                module = this._compile(bot, tag, value, {
                    api: {},
                    tagSpecificApi: {},
                });
            } catch (ex) {
                value = ex;
            }
        } else if (isTaggedString(value)) {
            value = parseTaggedString(value);
        } else if (isNumber(value)) {
            value = parseNumber(value);
        } else if (isTaggedNumber(value)) {
            // Tagged numbers that are not valid numbers
            // should always be NaN.
            value = NaN;
        } else if (value === 'true') {
            value = true;
        } else if (value === 'false') {
            value = false;
        } else if (isBotDate(value)) {
            const result = parseBotDate(value);
            if (result) {
                value = result;
            }
        } else if (isBotVector(value)) {
            const result = parseBotVector(value);
            if (result) {
                value = result;
            }
        } else if (isBotRotation(value)) {
            const result = parseBotRotation(value);
            if (result) {
                value = result;
            }
        }

        if (listener?.moduleFunc && !module) {
            module = listener;
        }

        return { value, listener, module };
    }

    private _compileTagMaskValue(
        bot: CompiledBot,
        tag: string,
        space: BotSpace,
        value: any
    ): any {
        let changedValue = false;
        let newValue = value;
        if (isFormula(value)) {
            const parsed = value.substring(DNA_TAG_PREFIX.length);
            const transformed = replaceMacros(parsed);
            try {
                newValue = JSON.parse(transformed);
                changedValue = true;
            } catch (ex) {
                newValue = ex;
            }
        }
        if (isTaggedString(value)) {
            newValue = parseTaggedString(value);
            changedValue = true;
        } else if (isTaggedNumber(value)) {
            const parsed = parseTaggedNumber(value);
            if (isNumber(parsed)) {
                newValue = parseNumber(parsed);
                changedValue = true;
            }
        } else if (isBotDate(value)) {
            const result = parseBotDate(value);
            if (result) {
                newValue = result;
                changedValue = true;
            }
        } else if (isBotVector(value)) {
            const result = parseBotVector(value);
            if (result) {
                newValue = result;
                changedValue = true;
            }
        } else if (isBotRotation(value)) {
            const result = parseBotRotation(value);
            if (result) {
                newValue = result;
                changedValue = true;
            }
        }

        if (changedValue) {
            bot.masks[space][tag] = newValue;
            return newValue;
        } else {
            return value;
        }
    }

    private _compile(
        bot: CompiledBot | null,
        tag: string,
        script: string,
        options: CompileOptions
    ): CompiledBotModule {
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

        const meta: ImportMetadata = markAsUncopiableObject({
            botId: bot?.id,
            tag: tag,
        });

        Object.defineProperty(meta, 'resolve', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: async (module: string) => {
                return await this.resolveModule(module, meta, true);
            },
        });

        const constants = {
            ...(options.api ?? this._library.api),
            tagName: tag,
            globalThis: this._globalObject,
            [IMPORT_META_FACTORY]: meta,
            __energyCheck: this._library.api.__energyCheck,
        };

        const specifics = {
            ...(options.tagSpecificApi ?? this._library.tagSpecificApi),
        };

        if (this._interpreter) {
            delete constants.globalThis;
            // if (this.canTriggerBreakpoint) {
            Object.assign(constants, options.api ?? this._interpretedApi);
            Object.assign(
                specifics,
                options.tagSpecificApi ?? this._interpretedTagSpecificApi
            );
            // }
        }

        const func = this._compiler.compile(script, {
            // TODO: Support all the weird features

            functionName: functionName,
            diagnosticFunctionName: diagnosticFunctionName,
            fileName: fileName,
            forceSync: this._forceSyncScripts,
            interpreter: this._interpreter,
            context: {
                bot,
                tag,
                creator: null as RuntimeBot,
            },
            before: (ctx) => {
                ctx.creator = ctx.bot
                    ? this._getRuntimeBot(ctx.bot.script.tags.creator)
                    : null;

                //  TODO: Determine whether to support this
                // if (this._beforeScriptEnterListeners.length > 0) {
                //     for (let listener of this._beforeScriptEnterListeners) {
                //         try {
                //             listener({
                //                 botId: ctx.bot.id,
                //                 tag: ctx.tag,
                //                 enterType: 'call',
                //             });
                //         } catch (err) {
                //             console.error(err);
                //         }
                //     }
                // }
            },
            onError: (err, ctx, meta) => {
                const data = this._handleError(err, ctx.bot, ctx.tag);
                throw data;
            },
            constants: constants,
            variables: {
                ...(specifics as any),
                this: (ctx) => (ctx.bot ? ctx.bot.script : null),
                thisBot: (ctx) => (ctx.bot ? ctx.bot.script : null),
                bot: (ctx) => (ctx.bot ? ctx.bot.script : null),
                tags: (ctx) => (ctx.bot ? ctx.bot.script.tags : null),
                raw: (ctx) => (ctx.bot ? ctx.bot.script.raw : null),
                masks: (ctx) => (ctx.bot ? ctx.bot.script.masks : null),
                creatorBot: (ctx) => ctx.creator,
                configBot: () => this.context.playerBot,
                links: (ctx) => (ctx.bot ? ctx.bot.script.links : null),

                // Default import function
                [`_${IMPORT_FACTORY}`]:
                    () => (module: string, meta: ImportMetadata) =>
                        this._importModule(module, meta),
            },
            arguments: [
                ['that', 'data'],
                '$__bot',
                '$__tag',
                IMPORT_FACTORY,
                EXPORT_FACTORY,
            ],
        }) as CompiledBotModule;

        if (hasValue(bot)) {
            this._functionMap.set(functionName, func);
            const botFunctionNames = this._getFunctionNamesForBot(bot.id);
            botFunctionNames.add(functionName);
        }

        if (func.metadata.isModule) {
            const moduleFunc: BotModule['moduleFunc'] = (imports, exports) => {
                const importFunc = (module: string) => {
                    return imports(module, meta);
                };
                const exportFunc = (
                    valueOrSource: string,
                    exp: (string | [string, string])[]
                ) => exports(valueOrSource, exp, meta);
                return this._wrapWithCurrentPromise(() => {
                    // Pass null for the argument, bot, and tag
                    // because module functions do not accept arguments
                    // and have the bot and tag injected automatically
                    let result = func(null, null, null, importFunc, exportFunc);
                    this._scheduleJobQueueCheck();
                    return result;
                });
            };
            func.moduleFunc = moduleFunc;
        } else {
            func.moduleFunc = null;
        }

        return func;
    }

    private _handleError(err: any, bot: Bot, tag: string): ScriptError {
        if (err instanceof RanOutOfEnergyError) {
            throw err;
        }
        // Script errors are uncopiable because otherwise the interpreter might try
        // and run into weird issues.
        let data: ScriptError = markAsUncopiableObject({
            error: err,
            bot: bot,
            tag: tag,
        });
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
        } else if (typeof value === 'string') {
            if (isTaggedString(value)) {
                return parseTaggedString(value);
            } else if (isTaggedNumber(value)) {
                return parseNumber(value);
            } else if (isBotVector(value)) {
                return parseBotVector(value);
            } else if (isBotDate(value)) {
                return parseBotDate(value);
            } else if (isBotRotation(value)) {
                return parseBotRotation(value);
            } else if (isBotLink(value)) {
                const ids = parseBotLink(value);
                if (ids && ids.length > 1) {
                    return ids.map((id) => this._globalContext.state[id]);
                } else if (ids && ids.length > 0) {
                    return this._globalContext.state[ids[0]];
                } else {
                    return null;
                }
            }
        } else {
            if (map.has(value)) {
                return map.get(value);
            }
            if (
                typeof value === 'object' &&
                value !== null &&
                value[UNMAPPABLE] === true
            ) {
                return value;
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

    setBreakpoint(breakpoint: RuntimeBreakpoint) {
        const bot = this.currentState[breakpoint.botId];

        const breakpointIndex = bot.breakpoints.findIndex(
            (b) => b.id === breakpoint.id
        );
        if (breakpointIndex >= 0) {
            bot.breakpoints[breakpointIndex] = breakpoint;
        } else {
            bot.breakpoints.push(breakpoint);
        }
        this._breakpoints.set(breakpoint.id, breakpoint);

        const func = bot.listeners[breakpoint.tag];
        if (func) {
            this._compiler.setBreakpoint({
                id: breakpoint.id,
                func: func as AuxCompiledScript,
                interpreter: this._interpreter,
                lineNumber: breakpoint.lineNumber,
                columnNumber: breakpoint.columnNumber,
                states: breakpoint.states,
            });
        }
    }

    removeBreakpoint(breakpointId: string) {
        const breakpoint = this._breakpoints.get(breakpointId);

        if (breakpoint) {
            this._breakpoints.delete(breakpointId);
            const bot = this.currentState[breakpoint.botId];

            const breakpointIndex = bot.breakpoints.findIndex(
                (b) => b.id === breakpoint.id
            );
            if (breakpointIndex >= 0) {
                bot.breakpoints.splice(breakpointIndex, 1);
            }

            this._interpreter.removeBreakpointById(breakpoint.id);
        }
    }

    continueAfterStop(
        stopId: RuntimeStop['stopId'],
        continuation?: InterpreterContinuation
    ) {
        const state = this._stopState;
        if (!state || state.stopId !== stopId) {
            return;
        }
        this._stopState = null;

        this._globalContext.actions.push(...state.actions);
        this._globalContext.errors.push(...state.errors);
        this._executeGenerator(
            state.resolve,
            state.reject,
            state.generator,
            continuation
        );
        // this._processGenerator(state.generator, continuation).then(state.resolve, state.reject);
    }

    private _scheduleJob(queueName: string, job: () => any): void {
        if (this._interpreter) {
            this._interpreter.realm.scope(() => {
                this._interpreter.agent.queueJob(queueName, () => {
                    job();
                    return Value.undefined;
                });
            });
        }
    }

    private _scheduleJobQueueCheck(): void {
        if (this._interpreter) {
            // Increment the current job queue check count and save it.
            // This is used to short-circuit job queue checks if future checks are scheduled
            // before this one runs.
            this._jobQueueCheckCount++;
            const currentCheck = this._jobQueueCheckCount;

            this._jobQueueCheckPending = true;
            // Queue a microtask to fire before the current task finishes
            queueMicrotask(() => {
                // Short circuit if another check has been scheduled.
                if (this._jobQueueCheckCount !== currentCheck) {
                    return;
                }

                // Queue another microtask to ensure that the job queue gets processed
                // after all current microtasks are executed.
                // This allows _scheduleJobQueueCheck() to be scheduled before other microtasks are queued.
                queueMicrotask(() => {
                    // Short circuit if another check has been scheduled.
                    if (
                        this._jobQueueCheckCount !== currentCheck ||
                        this._interpreter.agent.jobQueue.length <= 0
                    ) {
                        return;
                    }
                    this._processJobQueueNow();

                    if (this._interpreter.agent.jobQueue.length <= 0) {
                        // Check to see if any more jobs have been added after the job queue has been processed
                        // and trigger another job queue check if they have.
                        this._scheduleJobQueueCheck();
                    }
                });
            });
        }
    }

    // private _processJobQueueMicrotask() {
    //     queueMicrotask(() => {
    //         this._processJobQueueNow();
    //     });
    // }

    private _processJobQueueNow() {
        // TODO: Determine whether to support this
        // let scriptJobs: { botId: string; tag: string }[] = [];
        // for (let job of this._interpreter.agent.jobQueue) {
        //     if (
        //         job.callerScriptOrModule &&
        //         FUNCTION_METADATA in job.callerScriptOrModule
        //     ) {
        //         const meta: AuxScriptMetadata = (
        //             job.callerScriptOrModule as any
        //         )[FUNCTION_METADATA] as AuxScriptMetadata;
        //         const context = meta.context as {
        //             bot: CompiledBot;
        //             tag: string;
        //         };
        //         const botId = context.bot.id;
        //         const tag = context.tag;
        //         scriptJobs.push({
        //             botId,
        //             tag,
        //         });
        //     }
        // }
        // if (
        //     scriptJobs.length > 0 &&
        //     this._beforeScriptEnterListeners.length > 0
        // ) {
        //     for (let job of scriptJobs) {
        //         for (let listener of this._beforeScriptEnterListeners) {
        //             try {
        //                 listener({
        //                     enterType: 'task',
        //                     botId: job.botId,
        //                     tag: job.tag,
        //                 });
        //             } catch (err) {
        //                 console.error(err);
        //             }
        //         }
        //     }
        // }

        const queueGen = this._interpreter.runJobQueue();
        while (true) {
            const next = queueGen.next();
            if (next.done) {
                break;
            } else {
                // TODO: Process breakpoint
            }
        }

        this._jobQueueCheckPending = false;
    }

    processGenerator<T>(
        generator: Generator<InterpreterStop, T, InterpreterContinuation>
    ): void {
        this._processGenerator(generator);
    }

    private _processGenerator<T>(
        generator: Generator<InterpreterStop, T, InterpreterContinuation>,
        continuation?: InterpreterContinuation
    ): RuntimePromise<T> {
        return markAsRuntimePromise(
            new Promise((resolve, reject) => {
                this._executeGenerator(
                    resolve,
                    reject,
                    generator,
                    continuation
                );
            })
        );
    }

    private _executeGenerator<T>(
        resolve: (result: T) => void,
        reject: (err: any) => void,
        generator: Generator<InterpreterStop, T, InterpreterContinuation>,
        continuation?: InterpreterContinuation
    ) {
        try {
            let result: T;
            while (true) {
                const next = generator.next(continuation);
                if (next.done === true) {
                    result = next.value;
                    break;
                } else {
                    this._currentStopCount += 1;

                    const actions = this._processUnbatchedActions();
                    const errors = this._processUnbatchedErrors();

                    const state: RuntimeStopState = {
                        stopId: this._currentStopCount,
                        generator,
                        resolve,
                        reject,
                        actions,
                        errors,
                    };

                    this._stopState = state;
                    let breakpoint = this._breakpoints.get(
                        next.value.breakpoint.id
                    );
                    this._onRuntimeStop.next({
                        ...next.value,
                        breakpoint,
                        stopId: this._currentStopCount,
                    });
                    return;
                }
            }

            this._scheduleJobQueueCheck();

            resolve(result);
        } catch (err) {
            reject(err);
        }
    }
}

/**
 * Options that are used to influence the behavior of the compiled script.
 */
interface CompileOptions {
    /**
     * The API that should be used instead of the defaults.
     */
    api?: AuxCompileOptions<any>['constants'];

    /**
     * The tag-specific API that should be used instead of the defaults.
     */
    tagSpecificApi?: AuxCompileOptions<any>['variables'];
}

interface UncompiledScript {
    bot: CompiledBot;
    tag: string;
    script: string;
    hash: string;
}

type MaybeRuntimePromise<T> = T | RuntimePromise<T>;

/**
 * Processes the given list of items in a sequential manner, calling the given function for each item.
 * @param list The list of items to process.
 * @param func The function that should be called for each item.
 */
function processListOfMaybePromises<TIn, TOut>(
    promise: MaybeRuntimePromise<TOut>,
    list: Iterable<TIn>,
    func: (input: TIn) => MaybeRuntimePromise<TOut>
): MaybeRuntimePromise<TOut | void> {
    for (let item of list) {
        if (!isRuntimePromise(promise)) {
            const p = func(item);
            if (isRuntimePromise(p)) {
                promise = p;
            }
        } else {
            const copiedItem = item;
            promise = promise.then(() => {
                return func(copiedItem);
            }) as MaybeRuntimePromise<TOut>;
        }
    }

    if (isPromise(promise)) {
        return markAsRuntimePromise(promise);
    }
    return promise;
}
