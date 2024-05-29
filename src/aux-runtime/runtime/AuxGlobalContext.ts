import {
    BotAction,
    Bot,
    BotTags,
    isBot,
    PrecalculatedBot,
    botAdded,
    botRemoved,
    DEFAULT_ENERGY,
    RuntimeBot,
    getOriginalObject,
    ORIGINAL_OBJECT,
    ImportFunc,
    ExportFunc,
} from '@casual-simulation/aux-common/bots';
import {
    RuntimeBotFactory,
    RuntimeBotsState,
    RealtimeEditMode,
    RuntimeBatcher,
    RuntimeInterpreterGeneratorProcessor,
} from './RuntimeBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { ScriptError, RanOutOfEnergyError } from './AuxResults';
import {
    sortBy,
    sortedIndex,
    sortedIndexOf,
    sortedIndexBy,
    transform,
} from 'lodash';
import './PerformanceNowPolyfill';
import {
    Observable,
    ReplaySubject,
    Subject,
    Subscription,
    SubscriptionLike,
} from 'rxjs';
import { tap } from 'rxjs/operators';
import TWEEN from '@tweenjs/tween.js';
import { v4 as uuidv4 } from 'uuid';
import stableStringify from '@casual-simulation/fast-json-stable-stringify';
import { ensureBotIsSerializable } from '@casual-simulation/aux-common/partitions/PartitionUtils';
import type {
    InterpreterContinuation,
    InterpreterStop,
} from '@casual-simulation/js-interpreter';
import { isGenerator } from '@casual-simulation/js-interpreter/InterpreterUtils';
import { RuntimeActions } from './RuntimeEvents';
import seedrandom from 'seedrandom';
import { GenericError } from './CasualOSError';

/**
 * The interval between animation frames in miliseconds when using setInterval().
 */
export const SET_INTERVAL_ANIMATION_FRAME_TIME: number = 16;

/**
 * A symbol that can be specified on objects to influence how they are stringified
 * when printed for debug/mock/error purposes.
 */
export const DEBUG_STRING = Symbol('debug_string');

/**
 * Holds global values that need to be accessible from the runtime.
 */
export interface AuxGlobalContext {
    /**
     * The ordered list of script bots.
     */
    bots: RuntimeBot[];

    /**
     * The state that the runtime bots occupy.
     */
    state: RuntimeBotsState;

    /**
     * The list of actions that are currently queued in this context.
     */
    actions: RuntimeActions[];

    /**
     * The list of errors that are currently queued in this context.
     */
    errors: ScriptError[];

    /**
     * The version.
     */
    version: AuxVersion;

    /**
     * The device.
     */
    device: AuxDevice;

    /**
     * The player bot.
     */
    playerBot: RuntimeBot;

    /**
     * The current energy that the context has.
     */
    energy: number;

    /**
     * The number of miliseconds since the session has started.
     */
    localTime: number;

    /**
     * The unix time that the session started at.
     */
    startTime: number;

    /**
     * Whether async API actions should be mocked.
     */
    mockAsyncActions: boolean;

    /**
     * The global values that the context is using.
     */
    global: any;

    /**
     * The pseudo-random number generator that should be used by the context.
     */
    pseudoRandomNumberGenerator: seedrandom.PRNG;

    /**
     * Gets or sets the calculated latency between this client and the inst server in miliseconds.
     */
    instLatency: number;

    /**
     * Gets or sets the calculated time offset between this client and the inst server in miliseconds.
     */
    instTimeOffset: number;

    /**
     * Gets or sets the difference between time offsets that are included in the calculated inst time offset.
     * Values are in miliseconds.
     * Can be a useful indicator of closely the local clock has been synced to the server clock.
     */
    instTimeOffsetSpread: number;

    /**
     * Whether to force the context to produce async tasks that always have unguessable IDs.
     * Defaults to false.
     */
    forceUnguessableTaskIds: boolean;

    /**
     * Enqueues the given action.
     * @param action The action to enqueue.
     */
    enqueueAction(action: RuntimeActions): void;

    /**
     * Gets the list of actions that have been queued and resets the action queue.
     */
    dequeueActions(): RuntimeActions[];

    /**
     * Records the given error.
     * @param error The error to record.
     */
    enqueueError(error: ScriptError | RanOutOfEnergyError): void;

    /**
     * Gets the list of errors that have been queued and resets the error queue.
     */
    dequeueErrors(): ScriptError[];

    /**
     * Converts the given bot into a non-script enabled version.
     * @param bot The bot.
     */
    unwrapBot(bot: Bot | BotTags): Bot | BotTags;

    /**
     * Adds the given bot to the state and creates a new script bot to represent it.
     * @param bot The bot that should be created.
     */
    createBot(bot: Bot): RuntimeBot;

    /**
     * Destroys the given bot.
     * @param bot The bot to destroy.
     */
    destroyBot(bot: RuntimeBot): void;

    /**
     * Gets the list of bot IDs that have a listener for the given tag.
     * @param tag The tag.
     */
    getBotIdsWithListener(tag: string): string[];

    /**
     * Records whether the given ID has a listener for the given tag.
     * @param id The ID of the bot.
     * @param tag The tag that the bot has a listener for.
     * @param hasListener Whether the bot has a listener for the  given tag.
     */
    recordListenerPresense(id: string, tag: string, hasListener: boolean): void;

    /**
     * Records the given bot timer for the bot.
     * @param id The ID of the bot.
     * @param info The timer info.
     */
    recordBotTimer(id: string, info: BotTimer): void;

    /**
     * Removes the given bot timer from the bot.
     * Note that this does not cancel the timer, it only removes it from the timer record.
     * @param id The ID of the bot.
     * @param type The type of the timer.
     * @param timer The timer to remove.
     */
    removeBotTimer(id: string, type: BotTimer['type'], timerId: number): void;

    /**
     * Processes the given bot timer resulit.
     * For native runtimes this does nothing, but for interpreted runtimes this ensures that the generator breakpoints are correctly processed by the runtime.
     * @param result The result that should be processed.
     */
    processBotTimerResult(
        result: void | Generator<InterpreterStop, any, InterpreterContinuation>
    ): void;

    /**
     * Gets the list of bot timers for the given bot.
     * @param id The ID of the bot.
     */
    getBotTimers(id: string): BotTimer[];

    /**
     * Gets the list of bot timers that were setup to watch the given bot ID.
     * @param id The ID of the bot that the timers are watching.
     */
    getWatchersForBot(id: string): WatchBotTimer[];

    /**
     * Gets the list of portal timers that were setup to watch the given portal ID.
     * @param id The ID of the portal that the timers are watching.
     */
    getWatchersForPortal(id: string): WatchPortalTimer[];

    /**
     * Gets the list of portal IDs that are being watched.
     */
    getWatchedPortals(): Set<string>;

    /**
     * Cancels the timer with the given timer ID and bot ID.
     * @param id The ID of the bot.
     * @param timerId The ID of the timer.
     */
    cancelAndRemoveBotTimer(
        id: string,
        type: BotTimer['type'],
        timerId: number
    ): void;

    /**
     * Cancels the list of timers for the given bot ID.
     * @param id The ID of the bot.
     */
    cancelBotTimers(id: string): void;

    /**
     * Cancels all the timers that bots have created.
     */
    cancelAllBotTimers(): void;

    /**
     * Cancels and removes the timers with the given timer ID.
     * @param timerId The ID of the timer.
     * @param type The type of the timers to cancel. If null, timers of all types are canceled.
     */
    cancelAndRemoveTimers(timerId: number, type?: string): void;

    /**
     * Gets the number of timers.
     */
    getNumberOfActiveTimers(): number;

    /**
     * Creates a new task.
     * @param unguessableId Whether to use an unguessable task ID. Defaults to false.
     * @param allowRemoteResolution Whether the task is allowed to be resolved via a remote action result. Defaults to false.
     */
    createTask(
        unguessableId?: boolean,
        allowRemoteResolution?: boolean
    ): AsyncTask;

    /**
     * Creates a new iterable task.
     * @param unguessableId Whether to use an unguessable task ID. Defaults to false.
     * @param allowRemoteResolution Whether the task is allowed to be resolved via a remote action result. Defaults to false.
     */
    createIterable(
        unguessableId?: boolean,
        allowRemoteResolution?: boolean
    ): AsyncIterableTask;

    /**
     * Completes the task with the given task ID with the given result.
     * Returns whether the task was handled by this context.
     * @param taskId The ID of the task.
     * @param result The result.
     * @param remote Whether this call is being triggered from a remote device.
     *               This should be true if resolveTask() is being called in response to a remote or device action.
     */
    resolveTask(taskId: number | string, result: any, remote: boolean): boolean;

    /**
     * Completes the task with the given task ID with the given error.
     * * Returns whether the task was handled by this context.
     * @param taskId The ID of the task.
     * @param error The error.
     * @param remote Whether this call is being triggered from a remote device.
     *               This should be true if resolveTask() is being called in response to a remote or device action.
     */
    rejectTask(taskId: number | string, error: any, remote: boolean): boolean;

    /**
     * Provides the next value for the given iterable task.
     * @param taskId The ID of the task.
     * @param value The value to provide.
     * @param remote Whether this call is being triggered from a remote device.
     *               This should be true if resolveTask() is being called in response to a remote or device action.
     */
    iterableNext(taskId: number | string, value: any, remote: boolean): boolean;

    /**
     * Completes the iterable task.
     * @param taskId The ID of the task.
     * @param remote Whether this call is being triggered from a remote device.
     *               This should be true if resolveTask() is being called in response to a remote or device action.
     */
    iterableComplete(taskId: number | string, remote: boolean): boolean;

    /**
     * Instructs the iterable task to throw the given error.
     * @param taskId The ID of the task.
     * @param value The value to provide.
     * @param remote Whether this call is being triggered from a remote device.
     *               This should be true if resolveTask() is being called in response to a remote or device action.
     */
    iterableThrow(
        taskId: number | string,
        value: any,
        remote: boolean
    ): boolean;

    /**
     * Gets a list of timers that contains the amount of time a tag has run for in miliseconds.
     */
    getShoutTimers(): {
        tag: string;
        timeMs: number;
    }[];

    /**
     * Adds the given number of miliseconds to the timer for the given shout.
     * @param shout The name of the shout.
     * @param ms The number of miliseconds to add.
     */
    addShoutTime(shout: string, ms: number): void;

    /**
     * Gets information on how long it took different aspects of the instance to load.
     */
    getLoadTimes(): {
        [key: string]: number;
    };

    /**
     * Records the given time to the load times object.
     * @param key The key that indicates what the time represents.
     * @param ms The number of miliseconds.
     */
    setLoadTime(key: string, ms: number): void;

    /**
     * Starts the animation loop for the context.
     */
    startAnimationLoop(): SubscriptionLike;

    /**
     * Creates a UUID.
     */
    uuid(): string;

    /**
     * Sets the data that should be used to mock the given function.
     * @param func The function that the return values should be set for.
     * @param returnValues The list of return values that should be used for the mock.
     */
    setMockReturns(func: any, returnValues: any[]): void;

    /**
     * Sets the data that should be used to mock the given function for the given arguments.
     * @param func The function.
     * @param args The arguments that should be matched against.
     * @param returnValue The return value that should be used for the mock.
     */
    setMockReturn(func: any, args: any[], returnValue: any): void;

    /**
     * Gets the data that should be used as the function's return value.
     * @param func The function.
     */
    getNextMockReturn(func: any, functionName: string, args: any[]): any;
}

/**
 * Defines an interface for an asynchronous task.
 */
export interface AsyncTask {
    /**
     * The ID of the task.
     */
    taskId: number | string;

    /**
     * Whether the task is allowed to be resolved via a remote action result.
     */
    allowRemoteResolution: boolean;

    /**
     * The promise that the task contains.
     */
    promise: Promise<any>;

    /**
     * The function that is used to resolve the task with a result.
     */
    resolve: (val: any) => void;

    /**
     * The function that is used to reject the task with an error.
     */
    reject: (err: any) => void;
}

export type AsyncIterableTaskPromiseResult = {
    iterable: AsyncIterable<any>;
    result: any;
};

/**
 * Defines an interface for an asynchronous iterable task.
 * The task can be used in one of two ways:
 *
 * 1. The task can be used to provide an async iterable that can be used to stream values to the caller.
 *    In this case, the caller will be provided with the iterable directly and values can be sent to it via the next(), complete(), and throw() functions.
 * 2. The task can be used to provide a promise that resolves with an async iterable that can be used to stream values to the caller.
 *    In this case, the caller will be provided with the promise and it will be resolved with the iterable either when the resolve() function is called or when the next() function is called.
 */
export interface AsyncIterableTask extends AsyncTask {
    /**
     * The promise that the task contains.
     */
    promise: Promise<AsyncIterableTaskPromiseResult>;

    /**
     * The iterable that the task contains.
     */
    iterable: AsyncIterable<any>;

    /**
     * The subject that the iterable uses to provide values.
     */
    subject: ReplaySubject<any>;

    /**
     * Resolves the promise of the task.
     * @param value The value to resolve with.
     */
    resolve: (value: any) => void;

    /**
     * The next value to provide to the iterablwe.
     * @param val The value to provide.
     */
    next: (val: any) => void;

    /**
     * Completes the iterable.
     */
    complete: () => void;

    /**
     * Throws the given error.
     * @param err The error to throw.
     */
    throw: (err: any) => void;
}

/**
 * Defines an interface for a timer that was created by a bot (e.g. setTimeout() or setInterval()).
 */
export type BotTimer =
    | TimeoutOrIntervalTimer
    | AnimationTimer
    | WatchPortalTimer
    | WatchBotTimer;

/**
 * Defines an interface for a setTimeout() or setInterval() timer that was created by a bot.
 */
export interface TimeoutOrIntervalTimer {
    /**
     * The ID of the timer.
     */
    timerId: number;

    /**
     * The type of the timer.
     */
    type: 'timeout' | 'interval';
}

/**
 * Defines an interface for a animation timer that was created by a bot.
 */
export interface AnimationTimer {
    /**
     * The ID of the timer.
     */
    timerId: number;

    /**
     * The type of the timer.
     */
    type: 'animation';

    /**
     * The tag that the timer is for.
     */
    tag: string;

    /**
     * The group ID that the timer exists in.
     */
    groupId?: string;

    /**
     * A function used to cancel the timer.
     */
    cancel: () => void;
}

/**
 * Defines an interface for a subscription to watching a set of bots that was created by a bot.
 */
export interface WatchPortalTimer {
    /**
     * The ID of the timer.
     */
    timerId: number;

    /**
     * The type of the timer.
     */
    type: 'watch_portal';

    /**
     * The tag that the timer is for.
     */
    tag: string;

    /**
     * The ID of the portal that the timer is for.
     */
    portalId: string;

    /**
     * The function that should be called when the portal changes.
     */
    handler: () => void | Generator<
        InterpreterStop,
        any,
        InterpreterContinuation
    >;
}

/**
 * Defines an interface for a subscription to watching a set of bots that was created by a bot.
 */
export interface WatchBotTimer {
    /**
     * The ID of the timer.
     */
    timerId: number;

    /**
     * The type of the timer.
     */
    type: 'watch_bot';

    /**
     * The tag that the timer was created by.
     */
    tag: string;

    /**
     * The ID of the bot that the timer is for.
     */
    botId: string;

    /**
     * The function that should be called when the bot changes.
     */
    handler: () => void | Generator<
        InterpreterStop,
        any,
        InterpreterContinuation
    >;
}

/**
 * Gets the index of the bot in the given context.
 * Returns a negative number if the bot is not in the list.
 * @param context The context.
 * @param bot The bot.
 */
function indexInContext(context: AuxGlobalContext, bot: Bot): number {
    const index = sortedIndexBy(context.bots, <RuntimeBot>bot, (sb) => sb.id);
    const expected = context.bots.length > index ? context.bots[index] : null;
    if (!!expected && expected.id === bot.id) {
        return index;
    }
    return -1;
}

/**
 * Inserts the given bot into the global context.
 * @param context The context.
 * @param bot The bot.
 */
export function addToContext(context: AuxGlobalContext, ...bots: RuntimeBot[]) {
    for (let bot of bots) {
        if (!!context.state[bot.id]) {
            throw new Error('Bot already exists in the context!');
        }
        const index = sortedIndexBy(context.bots, bot, (sb) => sb.id);
        context.bots.splice(index, 0, bot);
        context.state[bot.id] = bot;
    }
}

/**
 * Removes the given bots from the given context.
 * @param context The context that the bots should be removed from.
 * @param bots The bots that should be removed.
 */
export function removeFromContext(
    context: AuxGlobalContext,
    bots: RuntimeBot[],
    cancelTimers: boolean = true
) {
    for (let bot of bots) {
        const index = indexInContext(context, bot);
        if (index < 0) {
            continue;
        }
        context.bots.splice(index, 1);
        delete context.state[bot.id];

        if (cancelTimers) {
            context.cancelBotTimers(bot.id);
        }
    }
}

/**
 * Gets whether a bot with the given ID is in the given context.
 * @param context The context.
 * @param bot The bot.
 */
export function isInContext(context: AuxGlobalContext, bot: Bot) {
    return indexInContext(context, bot) >= 0;
}

/**
 * Defines a global context that stores all information in memory.
 */
export class MemoryGlobalContext implements AuxGlobalContext {
    /**
     * The ordered list of script bots.
     */
    bots: RuntimeBot[] = [];

    /**
     * The state that the runtime bots occupy.
     */
    state: RuntimeBotsState = {};

    /**
     * The list of actions that have been queued.
     */
    actions: RuntimeActions[] = [];

    /**
     * The list of errors that have been queued.
     */
    errors: ScriptError[] = [];

    /**
     * The map of task IDs to tasks.
     */
    tasks: Map<number | string, AsyncTask> = new Map();

    /**
     * The map of task IDs to iterable tasks.
     */
    iterableTasks: Map<number | string, AsyncIterableTask> = new Map();

    /**
     * The version.
     */
    version: AuxVersion;

    /**
     * The device.
     */
    device: AuxDevice;

    /**
     * The player bot.
     */
    playerBot: RuntimeBot = null;

    /**
     * The current energy that the context has.
     */
    energy: number = DEFAULT_ENERGY;

    /**
     * Whether async API actions should be mocked.
     */
    mockAsyncActions: boolean;

    pseudoRandomNumberGenerator: seedrandom.PRNG;

    global: any = {};

    uuid = uuidv4;

    instLatency: number = NaN;

    instTimeOffset: number = NaN;

    instTimeOffsetSpread: number = NaN;

    forceUnguessableTaskIds: boolean = false;

    get localTime() {
        return Date.now() - this._startTime;
    }

    get startTime() {
        return this._startTime;
    }

    private _taskCounter: number = 0;
    private _scriptFactory: RuntimeBotFactory;
    private _batcher: RuntimeBatcher;
    private _generatorProcessor: RuntimeInterpreterGeneratorProcessor;
    private _shoutTimers: {
        [shout: string]: number;
    } = {};
    private _listenerMap: Map<string, string[]>;
    private _botTimerMap: Map<string, BotTimer[]>;
    private _botWatcherMap: Map<string, WatchBotTimer[]>;
    private _portalWatcherMap: Map<string, WatchPortalTimer[]>;
    private _numberOfTimers: number = 0;
    private _startTime: number;
    private _animationLoop: Subscription;
    private _mocks: Map<any, any[] | Map<string, any>>;
    private _loadTimes: {
        [key: string]: number;
    } = {};

    /**
     * Creates a new global context.
     * @param version The version number.
     * @param device The device that we're running on.
     * @param scriptFactory The factory that should be used to create new script bots.
     * @param batcher The batcher that should be used to batch changes.
     * @param generatorProcessor The processor that should be used to process generators created from bot timer handlers.
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        scriptFactory: RuntimeBotFactory,
        batcher: RuntimeBatcher,
        generatorProcessor: RuntimeInterpreterGeneratorProcessor
    ) {
        this.version = version;
        this.device = device;
        this._scriptFactory = scriptFactory;
        this._batcher = batcher;
        this._generatorProcessor = generatorProcessor;
        this._listenerMap = new Map();
        this._botTimerMap = new Map();
        this._botWatcherMap = new Map();
        this._portalWatcherMap = new Map();
        this._mocks = new Map();
        this._startTime = Date.now();
        this.pseudoRandomNumberGenerator = null;
    }

    getBotIdsWithListener(tag: string): string[] {
        const set = this._listenerMap.get(tag);
        if (!set) {
            return [];
        }

        return set.slice();
    }

    recordListenerPresense(
        id: string,
        tag: string,
        hasListener: boolean
    ): void {
        let set = this._listenerMap.get(tag);
        if (!hasListener && !set) {
            // we don't have a listener to record
            // and there is no list for the tag
            // so there is nothing to do.
            return;
        }

        if (!set) {
            set = [];
            this._listenerMap.set(tag, set);
        }

        if (hasListener) {
            const index = sortedIndex(set, id);

            // ensure that our indexing is in bounds
            // to prevent the array from being put into slow-mode
            // see https://stackoverflow.com/a/26737403/1832856
            if (index < set.length && index >= 0) {
                const current = set[index];
                if (current !== id) {
                    set.splice(index, 0, id);
                }
            } else {
                set.splice(index, 0, id);
            }
        } else {
            const index = sortedIndexOf(set, id);
            if (index >= 0) {
                set.splice(index, 1);
            }

            // Delete the tag from the list if there are no more IDs
            if (set.length <= 0) {
                this._listenerMap.delete(tag);
            }
        }
    }

    recordBotTimer(id: string, info: BotTimer): void {
        let list = this._botTimerMap.get(id);
        if (!list) {
            list = [];
            this._botTimerMap.set(id, list);
        }
        list.push(info);
        this._numberOfTimers += 1;

        if (info.type === 'watch_bot') {
            let watchers = this._botWatcherMap.get(info.botId);
            if (!watchers) {
                watchers = [];
                this._botWatcherMap.set(info.botId, watchers);
            }
            watchers.push(info);
        } else if (info.type === 'watch_portal') {
            let watchers = this._portalWatcherMap.get(info.portalId);
            if (!watchers) {
                watchers = [];
                this._portalWatcherMap.set(info.portalId, watchers);
            }
            watchers.push(info);
        }
    }

    removeBotTimer(
        id: string,
        type: BotTimer['type'],
        timer: number | string
    ): void {
        let list = this._botTimerMap.get(id);
        if (list) {
            let index = list.findIndex(
                (t) => t.type === type && t.timerId === timer
            );
            if (index >= 0) {
                list.splice(index, 1);
                this._numberOfTimers = Math.max(0, this._numberOfTimers - 1);
            }
        }
    }

    processBotTimerResult(
        result: void | Generator<InterpreterStop, any, InterpreterContinuation>
    ) {
        if (isGenerator(result)) {
            this._generatorProcessor.processGenerator(result);
        }
    }

    getBotTimers(id: string): BotTimer[] {
        let timers = this._botTimerMap.get(id);
        if (timers) {
            return timers.slice();
        }
        return [];
    }

    getWatchersForBot(id: string): WatchBotTimer[] {
        let watchers = this._botWatcherMap.get(id);
        if (watchers) {
            return watchers.slice();
        }
        return [];
    }

    getWatchersForPortal(id: string): WatchPortalTimer[] {
        let watchers = this._portalWatcherMap.get(id);
        if (watchers) {
            return watchers.slice();
        }
        return [];
    }

    getWatchedPortals(): Set<string> {
        return new Set(this._portalWatcherMap.keys());
    }

    cancelAndRemoveBotTimer(
        id: string,
        type: BotTimer['type'],
        timerId: number
    ) {
        let timers = this._botTimerMap.get(id);
        if (!timers) {
            return;
        }
        for (let i = 0; i < timers.length; i++) {
            let timer = timers[i];
            if (timer.timerId === timerId && timer.type === type) {
                timers.splice(i, 1);
                this._clearTimer(timer);
                i -= 1;
            }
        }
    }

    cancelBotTimers(id: string): void {
        let list = this._botTimerMap.get(id);
        if (list) {
            this._clearTimers(list);
        }
        this._botTimerMap.delete(id);
    }

    cancelAllBotTimers() {
        for (let list of this._botTimerMap.values()) {
            this._clearTimers(list);
        }

        this._botTimerMap.clear();
    }

    cancelAndRemoveTimers(timerId: number, type?: string) {
        for (let list of this._botTimerMap.values()) {
            for (let i = 0; i < list.length; i++) {
                const timer = list[i];
                if (
                    timer.timerId === timerId &&
                    (!type || timer.type === type)
                ) {
                    this._clearTimer(timer);
                    list.splice(i, 1);
                    i -= 1;
                }
            }
        }
    }

    getNumberOfActiveTimers() {
        return this._numberOfTimers;
    }

    private _clearTimers(list: BotTimer[]) {
        for (let timer of list) {
            this._clearTimer(timer);
        }
    }

    private _clearTimer(timer: BotTimer) {
        this._numberOfTimers = Math.max(0, this._numberOfTimers - 1);
        if (timer.type === 'timeout') {
            clearTimeout(timer.timerId);
        } else if (timer.type === 'interval') {
            clearInterval(timer.timerId);
        } else if (timer.type === 'animation') {
            timer.cancel();
        } else if (timer.type === 'watch_bot') {
            let watchers = this._botWatcherMap.get(timer.botId);
            if (watchers) {
                let index = watchers.findIndex(
                    (w) => w.timerId === timer.timerId
                );
                if (index >= 0) {
                    watchers.splice(index, 1);
                }
            }
        } else if (timer.type === 'watch_portal') {
            let watchers = this._portalWatcherMap.get(timer.portalId);
            if (watchers) {
                let index = watchers.findIndex(
                    (w) => w.timerId === timer.timerId
                );
                if (index >= 0) {
                    watchers.splice(index, 1);
                }
            }
        }
    }

    /**
     * Enqueues the given action.
     * @param action The action to enqueue.
     */
    enqueueAction(action: RuntimeActions): void {
        if (action.type === 'remote') {
            const index = this.actions.indexOf(<RuntimeActions>action.event);
            if (index >= 0) {
                this.actions[index] = action;
            } else {
                this.actions.push(action);
                this._batcher.notifyActionEnqueued(action);
                this._batcher.notifyChange();
            }
        } else {
            this.actions.push(action);
            this._batcher.notifyActionEnqueued(action);
            this._batcher.notifyChange();
        }
    }

    dequeueActions(): RuntimeActions[] {
        let actions = this.actions;
        this.actions = [];
        return actions;
    }

    // TODO: Improve to correctly handle when a non ScriptError object is added
    // but contains symbol properties that reference the throwing bot and tag.
    // The AuxRuntime should look for these error objects and create ScriptErrors for them.
    enqueueError(error: ScriptError | RanOutOfEnergyError): void {
        if (error instanceof RanOutOfEnergyError) {
            throw error;
        }
        this.errors.push(error);
        this._batcher.notifyChange();
    }

    dequeueErrors(): ScriptError[] {
        let errors = this.errors;
        this.errors = [];
        return errors;
    }

    /**
     * Converts the given bot into a non-script enabled version.
     * @param bot The bot.
     */
    unwrapBot(bot: Bot | BotTags): Bot | BotTags {
        if (isBot(bot)) {
            return {
                id: bot.id,
                space: bot.space,

                // TODO: Fix for proxy objects
                tags: transform(
                    bot.tags,
                    (result, value, key) => {
                        result[key] = getOriginalObject(value);
                    },
                    {} as BotTags
                ),
            };
        }
        return bot;
    }

    createBot(bot: Bot): RuntimeBot {
        const newBot = ensureBotIsSerializable(bot);
        const script = this._scriptFactory.createRuntimeBot(newBot) || null;
        if (script) {
            addToContext(this, script);

            if (script.listeners) {
                for (let key in script.listeners) {
                    if (typeof script.listeners[key] === 'function') {
                        this.recordListenerPresense(script.id, key, true);
                    }
                }
            }
        }
        this.enqueueAction(botAdded(newBot));
        return script;
    }

    /**
     * Destroys the given bot.
     * @param bot The bot to destroy.
     */
    destroyBot(bot: RuntimeBot): void {
        const index = indexInContext(this, bot);
        if (index < 0) {
            return;
        }
        const mode = this._scriptFactory.destroyScriptBot(bot);
        if (mode === RealtimeEditMode.Immediate) {
            this.bots.splice(index, 1);
            delete this.state[bot.id];
            this.cancelBotTimers(bot.id);

            if (bot.listeners) {
                for (let key in bot.listeners) {
                    if (typeof bot.listeners[key] === 'function') {
                        this.recordListenerPresense(bot.id, key, false);
                    }
                }
            }
        }
        this.enqueueAction(botRemoved(bot.id));
    }

    createTask(
        unguessableId: boolean,
        allowRemoteResolution: boolean
    ): AsyncTask {
        let resolve: AsyncTask['resolve'];
        let reject: AsyncTask['reject'];
        let promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const task: AsyncTask = {
            taskId:
                !unguessableId && !this.forceUnguessableTaskIds
                    ? (this._taskCounter += 1)
                    : !this.forceUnguessableTaskIds
                    ? this.uuid()
                    : uuidv4(),
            allowRemoteResolution: allowRemoteResolution || false,
            resolve: resolve,
            reject: reject,
            promise,
        };

        this.tasks.set(task.taskId, task);
        return task;
    }

    createIterable(
        unguessableId?: boolean,
        allowRemoteResolution?: boolean
    ): AsyncIterableTask {
        const subject = new ReplaySubject();
        let resolved = false;
        let resolve: AsyncIterableTask['resolve'];
        let reject: AsyncIterableTask['reject'];
        const promise = new Promise<AsyncIterableTaskPromiseResult>(
            (res, rej) => {
                resolve = (value) => {
                    resolved = true;
                    res({
                        iterable: subject,
                        result: value,
                    });
                };
                reject = rej;
            }
        );
        const task: AsyncIterableTask = {
            taskId:
                !unguessableId && !this.forceUnguessableTaskIds
                    ? (this._taskCounter += 1)
                    : !this.forceUnguessableTaskIds
                    ? this.uuid()
                    : uuidv4(),
            allowRemoteResolution: allowRemoteResolution || false,
            resolve,
            reject,
            promise,
            iterable: subject,
            subject,
            next: (val) => {
                if (!resolved) {
                    resolve({ success: true });
                }
                subject.next(val);
            },
            complete: () => subject.complete(),
            throw: (err) => subject.error(err),
        };

        this.iterableTasks.set(task.taskId, task);
        return task;
    }

    iterableNext(
        taskId: string | number,
        value: any,
        remote: boolean
    ): boolean {
        const task = this.iterableTasks.get(taskId);
        if (task && (task.allowRemoteResolution || remote === false)) {
            task.next(value);
            return true;
        }

        return false;
    }

    iterableComplete(taskId: string | number, remote: boolean): boolean {
        const task = this.iterableTasks.get(taskId);
        if (task && (task.allowRemoteResolution || remote === false)) {
            this.iterableTasks.delete(taskId);
            task.complete();
            return true;
        }

        return false;
    }

    iterableThrow(
        taskId: string | number,
        value: any,
        remote: boolean
    ): boolean {
        const task = this.iterableTasks.get(taskId);
        if (task && (task.allowRemoteResolution || remote === false)) {
            this.iterableTasks.delete(taskId);
            task.throw(value);
            return true;
        }

        return false;
    }

    resolveTask(
        taskId: number | string,
        result: any,
        remote: boolean
    ): boolean {
        const task = this.tasks.get(taskId);
        if (task && (task.allowRemoteResolution || remote === false)) {
            this.tasks.delete(taskId);
            task.resolve(result);
            return true;
        }

        const iterableTask = this.iterableTasks.get(taskId);
        if (
            iterableTask &&
            (iterableTask.allowRemoteResolution || remote === false)
        ) {
            iterableTask.resolve(result);
            return true;
        }

        return false;
    }

    rejectTask(taskId: number | string, error: any, remote: boolean): boolean {
        const task = this.tasks.get(taskId);
        if (task && (task.allowRemoteResolution || remote === false)) {
            this.tasks.delete(taskId);
            task.reject(error);
            return true;
        }

        return false;
    }

    getShoutTimers() {
        const keys = Object.keys(this._shoutTimers);
        const list = keys.map((k) => ({
            tag: k,
            timeMs: this._shoutTimers[k],
        }));

        return sortBy(list, (timer) => -timer.timeMs);
    }

    addShoutTime(shout: string, ms: number) {
        if (ms < 0) {
            throw new Error('Cannot add negative time to a shout timer.');
        }
        if (!(shout in this._shoutTimers)) {
            this._shoutTimers[shout] = 0;
        }

        this._shoutTimers[shout] += ms;
    }

    getLoadTimes(): { [key: string]: number } {
        return {
            ...this._loadTimes,
        };
    }

    setLoadTime(key: string, ms: number): void {
        this._loadTimes[key] = ms;
    }

    startAnimationLoop(): SubscriptionLike {
        if (!this._animationLoop) {
            const sub = animationLoop()
                .pipe(tap(() => this._updateAnimationLoop()))
                .subscribe();

            this._animationLoop = new Subscription(() => {
                sub.unsubscribe();
                this._animationLoop = null;
            });
        }

        return this._animationLoop;
    }

    /**
     * Sets the data that should be used to mock the given function.
     * @param func The function that the return values should be set for.
     * @param returnValues The list of return values that should be used for the mock.
     */
    setMockReturns(func: any, returnValues: any[]): void {
        if (ORIGINAL_OBJECT in func) {
            func = func[ORIGINAL_OBJECT];
        }
        this._mocks.set(func, returnValues.slice());
    }

    /**
     * Sets the data that should be used to mock the given function for the given arguments.
     * @param func The function.
     * @param args The arguments that should be matched against.
     * @param returnValue The return value that should be used for the mock.
     */
    setMockReturn(func: any, args: any[], returnValue: any): void {
        if (ORIGINAL_OBJECT in func) {
            func = func[ORIGINAL_OBJECT];
        }

        let mocks = this._mocks.get(func);
        let map: Map<string, any>;
        if (mocks instanceof Map) {
            map = mocks;
        } else {
            map = new Map();
            this._mocks.set(func, map);
        }
        const argJson = stableStringify(args, { space: 2 });
        map.set(argJson, returnValue);
    }

    /**
     * Gets the data that should be used as the function's return value.
     * @param func The function.
     */
    getNextMockReturn(func: any, functionName: string, args: any[]): any {
        if (ORIGINAL_OBJECT in func) {
            func = func[ORIGINAL_OBJECT];
        }
        if (!this._mocks.has(func)) {
            throw new Error(
                `No mask data for function: ${debugStringifyFunction(
                    functionName,
                    args
                )}`
            );
        }
        let arrayOrMap = this._mocks.get(func);
        if (arrayOrMap instanceof Map) {
            const argJson = stableStringify(args, { space: 2 });
            if (arrayOrMap.has(argJson)) {
                return arrayOrMap.get(argJson);
            } else {
                throw new Error(
                    `No mask data for function (no matching input): ${debugStringifyFunction(
                        functionName,
                        args
                    )}`
                );
            }
        } else {
            if (arrayOrMap.length > 0) {
                return arrayOrMap.shift();
            } else {
                throw new Error(
                    `No mask data for function (out of return values): ${debugStringifyFunction(
                        functionName,
                        args
                    )}`
                );
            }
        }
    }

    private _updateAnimationLoop() {
        TWEEN.update(this.localTime);
    }
}

/**
 * Creates a debug string that is useful for visualizing a function call.
 * @param functionName The name of the function.
 * @param args The arguments that were passed to the function.
 * @returns
 */
export function debugStringifyFunction(
    functionName: string,
    args: any[]
): string {
    const argList = args.map((a) => debugStringify(a)).join(', ');
    return `${functionName}(${argList})`;
}

/**
 * Creates a debug string from the given value.
 * @param value
 * @returns
 */
export function debugStringify(value: any): string {
    if (
        (typeof value === 'object' || typeof value === 'function') &&
        DEBUG_STRING in value
    ) {
        return value[DEBUG_STRING];
    }
    return stableStringify(value, { space: 2 });
}

function animationLoop(): Observable<void> {
    return new Observable<void>((observer) => {
        let interval = setInterval(() => {
            observer.next();
        }, SET_INTERVAL_ANIMATION_FRAME_TIME);

        return () => {
            clearInterval(interval);
        };
    });
}
