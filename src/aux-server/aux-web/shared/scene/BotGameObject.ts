import {
    BotCalculationContext,
    TagUpdatedEvent,
    Bot,
} from '@casual-simulation/aux-common';

/**
 * Defines an interface for game objects which represent a bot.
 */
export interface BotGameObject {
    frameUpdate(calc: BotCalculationContext): void;

    /**
     * Notifies the builder context that the given bot was added to the state.
     * @param bot The bot that was added.
     * @param calc The bot calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): void;

    /**
     * Notifies the game object that the given bot was updated.
     * @param bot The bot that was updated.
     * @param updates The updates that happened on the bot.
     * @param calc The bot calculation context that should be used.
     */
    botUpdated(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ): void;

    /**
     * Notifies the builder context that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext): void;
}
