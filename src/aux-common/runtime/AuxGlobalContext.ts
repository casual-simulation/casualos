import {
    ScriptBot,
    BotAction,
    Bot,
    BotTags,
    isBot,
    PrecalculatedBot,
} from '../bots';
import sortedIndexBy from 'lodash/sortedIndexBy';
import { ScriptBotFactory } from './ScriptBot';

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
    bots: ScriptBot[];

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
    playerBot: ScriptBot;

    /**
     * The current bot.
     */
    currentBot: ScriptBot;

    /**
     * Enqueues the given action.
     * @param action The action to enqueue.
     */
    enqueueAction(action: BotAction): void;

    /**
     * Converts the given bot into a non-script enabled version.
     * @param bot The bot.
     */
    unwrapBot(bot: Bot | BotTags): Bot | BotTags;

    /**
     * Adds the given bot to the state and creates a new script bot to represent it.
     * @param bot The bot that should be created.
     */
    createBot(bot: Bot): ScriptBot;
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
export function addToContext(context: AuxGlobalContext, ...bots: ScriptBot[]) {
    for (let bot of bots) {
        const index = sortedIndexBy(context.bots, bot, sb => sb.id);
        context.bots.splice(index, 0, bot);
    }
}

/**
 * Removes the given bots from the given context.
 * @param context The context that the bots should be removed from.
 * @param bots The bots that should be removed.
 */
export function removeFromContext(
    context: AuxGlobalContext,
    ...bots: ScriptBot[]
) {
    for (let bot of bots) {
        const index = sortedIndexBy(context.bots, bot, sb => sb.id);
        context.bots.splice(index, 1);
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
    bots: ScriptBot[] = [];

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
    playerBot: ScriptBot = null;

    /**
     * The current bot.
     */
    currentBot: ScriptBot = null;

    private _scriptFactory: ScriptBotFactory;

    /**
     * Creates a new global context.
     * @param version The version number.
     * @param device The device that we're running on.
     * @param scriptFactory The factory that should be used to create new script bots.
     */
    constructor(
        version: AuxVersion,
        device: AuxDevice,
        scriptFactory: ScriptBotFactory
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

    createBot(bot: Bot): ScriptBot {
        const script = this._scriptFactory.createScriptBot(bot);
        addToContext(this, script);
        return script;
    }
}
