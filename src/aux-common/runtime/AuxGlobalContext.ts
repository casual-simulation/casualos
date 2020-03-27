import { ScriptBot } from '../bots';
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
