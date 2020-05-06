import { Bot, PrecalculatedBot } from './Bot';

/**
 * Defines an interface for objects that are able to provide the necessary information required to calculate
 * formula values and actions.
 */
export interface BotObjectsContext {
    /**
     * The objects in the context.
     */
    objects: (Bot | PrecalculatedBot)[];
}
