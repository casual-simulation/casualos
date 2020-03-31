import { ScriptBot, BotAction } from '../bots';
import sortedIndexBy from 'lodash/sortedIndexBy';

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
     * Enqueues the given action.
     * @param action The action to enqueue.
     */
    enqueueAction(action: BotAction): void;
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
     * Creates a new global context.
     * @param version The version number.
     */
    constructor(version: AuxVersion) {
        this.version = version;
    }

    /**
     * Enqueues the given action.
     * @param action The action to enqueue.
     */
    enqueueAction(action: BotAction): void {
        this.actions.push(action);
    }
}
