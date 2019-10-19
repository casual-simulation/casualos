import { BotCalculationContext, Bot } from '@casual-simulation/aux-common';
import { AuxBotVisualizer } from './AuxBotVisualizer';

/**
 * Defines an interface for an object that provides a container for one or more contexts.
 */
export interface ContextGroup {
    /**
     * The bot that this group is representing.
     */
    bot: Bot;

    /**
     * The contexts that are represented by this context group.
     */
    contexts: Set<string>;

    /**
     * Gets the list of bots
     */
    getBots(): AuxBotVisualizer[];

    /**
     * Adds the given context to this group.
     * @param context The context that is being added.
     */
    addContext(context: string): void;

    /**
     * Removes the given context from this group.
     * @param context The context that should be removed.
     */
    removeContext(context: string): AuxBotVisualizer[];

    /**
     * Determines if this group has a bot with the given ID in the given context.
     * @param context The context.
     * @param id The bot ID.
     */
    hasBotInContext(context: string, id: string): boolean;

    /**
     * Gets the bot visualizer with the given ID from the given context.
     * @param context The context that the bot is in.
     * @param id The ID of the bot.
     */
    getBotInContext(context: string, id: string): AuxBotVisualizer;

    /**
     * Adds the given bot to the given context in this group.
     * Returns the visualizer that was created.
     * @param context The context.
     * @param bot The bot.
     */
    addBotToContext(context: string, bot: Bot): AuxBotVisualizer;

    /**
     * Removes the given bot from the given context.
     * @param context The context.
     * @param bot The bot.
     */
    removeBotFromContext(context: string, bot: AuxBotVisualizer): void;

    /**
     * Indicates that the bot for the context group was updated.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated.
     * @param calc The calculation context.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext): void;

    /**
     * Indicates that the bot for the context group was updated.
     * @param bot The bot.
     * @param calc The calculation context.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): void;

    /**
     * Disposes of this context group.
     */
    dispose(): void;
}
