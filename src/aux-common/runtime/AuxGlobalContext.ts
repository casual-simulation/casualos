import {
    BotAction,
    Bot,
    BotTags,
    isBot,
    PrecalculatedBot,
    botAdded,
    botRemoved,
} from '../bots';
import sortedIndexBy from 'lodash/sortedIndexBy';
import { RuntimeBot, RuntimeBotFactory, RuntimeBotsState } from './RuntimeBot';

/**
 * Holds global values that need to be accessible from the runtime.
 */
export interface AuxGlobalContext {
    /**
     * Whether editing is currently allowed.
     */
    allowsEditing: boolean;

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
     * The current bot.
     */
    currentBot: RuntimeBot;

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
}

/**
 * Contains information about the version of AUX that is running.
 */
export interface AuxVersion {
    /**
     * The commit of the hash that AUX was built from.
     */
    hash: string;

    /**
     * The full version number.
     */
    version: string;

    /**
     * The major portion of the version.
     */
    major: number;

    /**
     * The minor portion of the version.
     */
    minor: number;

    /**
     * The patch portion of the version.
     */
    patch: number;
}

/**
 * Contains information about the device that AUX is running on.
 */
export interface AuxDevice {
    /**
     * Whether the device supports augmented reality features.
     */
    supportsAR: boolean;

    /**
     * Whether the device supports virtual reality features.
     */
    supportsVR: boolean;
}

/**
 * Inserts the given bot into the global context.
 * @param context The context.
 * @param bot The bot.
 */
export function addToContext(context: AuxGlobalContext, ...bots: RuntimeBot[]) {
    for (let bot of bots) {
        const index = sortedIndexBy(context.bots, bot, sb => sb.id);
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
    ...bots: RuntimeBot[]
) {
    for (let bot of bots) {
        const index = sortedIndexBy(context.bots, bot, sb => sb.id);
        context.bots.splice(index, 1);
        delete context.state[bot.id];
    }
}

/**
 * Defines a global context that stores all information in memory.
 */
export class MemoryGlobalContext implements AuxGlobalContext {
    /**
     * Whether editing is currently allowed.
     */
    allowsEditing: boolean = true;

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
     * The current bot.
     */
    currentBot: RuntimeBot = null;

    private _scriptFactory: RuntimeBotFactory;

    /**
     * Creates a new global context.
     * @param version The version number.
     * @param device The device that we're running on.
     * @param scriptFactory The factory that should be used to create new script bots.
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        scriptFactory: RuntimeBotFactory
    ) {
        this.version = version;
        this.device = device;
        this._scriptFactory = scriptFactory;
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
            }
        } else {
            this.actions.push(action);
        }
    }

    dequeueActions(): BotAction[] {
        let actions = this.actions;
        this.actions = [];
        return actions;
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
        const script = this._scriptFactory.createRuntimeBot(bot);
        addToContext(this, script);
        this.enqueueAction(botAdded(bot));
        return script;
    }

    /**
     * Destroys the given bot.
     * @param bot The bot to destroy.
     */
    destroyBot(bot: RuntimeBot): void {
        this._scriptFactory.destroyScriptBot(bot);
        removeFromContext(this, bot);
        this.enqueueAction(botRemoved(bot.id));
    }
}
