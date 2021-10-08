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
} from '../bots';
import {
    RuntimeBotFactory,
    RuntimeBotsState,
    RealtimeEditMode,
    RuntimeBatcher,
} from './RuntimeBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { ScriptError, RanOutOfEnergyError } from './AuxResults';
import { sortBy, sortedIndex, sortedIndexOf, sortedIndexBy } from 'lodash';
import './PerformanceNowPolyfill';
import { Observable, Subscription, SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import TWEEN from '@tweenjs/tween.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * The interval between animation frames in miliseconds when using setInterval().
 */
export const SET_INTERVAL_ANIMATION_FRAME_TIME: number = 16;

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
     * Enqueues the given action.
     * @param action The action to enqueue.
     */
    enqueueAction(action: BotAction): void;

    /**
     * Gets the list of actions that have been queued and resets the action queue.
     */
    dequeueActions(): BotAction[];

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
     * @param Whether to use an unguessable task ID. Defaults to false.
     * @param Whether the task is allowed to be resolved via a remote action result. Defaults to false.
     */
    createTask(
        unguessableId?: boolean,
        allowRemoteResolution?: boolean
    ): AsyncTask;

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
     * Starts the animation loop for the context.
     */
    startAnimationLoop(): SubscriptionLike;

    /**
     * Creates a UUID.
     */
    uuid(): string;
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
    handler: () => void;
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
    handler: () => void;
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
    actions: BotAction[] = [];

    /**
     * The list of errors that have been queued.
     */
    errors: ScriptError[] = [];

    /**
     * The map of task IDs to tasks.
     */
    tasks: Map<number | string, AsyncTask> = new Map();

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

    uuid = uuidv4;

    get localTime() {
        return performance.now() - this._startTime;
    }

    private _taskCounter: number = 0;
    private _scriptFactory: RuntimeBotFactory;
    private _batcher: RuntimeBatcher;
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

    /**
     * Creates a new global context.
     * @param version The version number.
     * @param device The device that we're running on.
     * @param scriptFactory The factory that should be used to create new script bots.
     * @param batcher The batcher that should be used to batch changes.
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        scriptFactory: RuntimeBotFactory,
        batcher: RuntimeBatcher
    ) {
        this.version = version;
        this.device = device;
        this._scriptFactory = scriptFactory;
        this._batcher = batcher;
        this._listenerMap = new Map();
        this._botTimerMap = new Map();
        this._botWatcherMap = new Map();
        this._portalWatcherMap = new Map();
        this._startTime = performance.now();
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
    enqueueAction(action: BotAction): void {
        if (action.type === 'remote') {
            const index = this.actions.indexOf(<BotAction>action.event);
            if (index >= 0) {
                this.actions[index] = action;
            } else {
                this.actions.push(action);
                this._batcher.notifyChange();
            }
        } else {
            this.actions.push(action);
            this._batcher.notifyChange();
        }
    }

    dequeueActions(): BotAction[] {
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
                tags: {
                    ...bot.tags,
                },
            };
        }
        return bot;
    }

    createBot(bot: Bot): RuntimeBot {
        const script = this._scriptFactory.createRuntimeBot(bot) || null;
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
        this.enqueueAction(botAdded(bot));
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
            taskId: !unguessableId ? (this._taskCounter += 1) : this.uuid(),
            allowRemoteResolution: allowRemoteResolution || false,
            resolve: resolve,
            reject: reject,
            promise,
        };

        this.tasks.set(task.taskId, task);
        return task;
    }

    resolveTask(taskId: number, result: any, remote: boolean): boolean {
        const task = this.tasks.get(taskId);
        if (task && (task.allowRemoteResolution || remote === false)) {
            this.tasks.delete(taskId);
            task.resolve(result);
            return true;
        }

        return false;
    }

    rejectTask(taskId: number, error: any, remote: boolean): boolean {
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

    private _updateAnimationLoop() {
        TWEEN.update(this.localTime);
    }
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
