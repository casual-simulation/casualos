import { BotCalculationContext, Bot } from '@casual-simulation/aux-common';
import { AuxBotVisualizer } from './AuxBotVisualizer';

/**
 * Defines an interface for an object that provides a container for one or more contexts.
 */
export interface DimensionGroup {
    /**
     * The bot that this group is representing.
     */
    bot: Bot;

    /**
     * The dimensions that are represented by this dimension group.
     */
    dimensions: Set<string>;

    /**
     * The tag of the portal that this dimension group represents.
     */
    portalTag: string;

    /**
     * Gets the list of bots
     */
    getBots(): AuxBotVisualizer[];

    /**
     * Adds the given dimension to this group.
     * @param dimension The dimension that is being added.
     */
    addDimension(dimension: string): void;

    /**
     * Removes the given dimension from this group.
     * @param dimension The dimension that should be removed.
     */
    removeDimension(dimension: string): AuxBotVisualizer[];

    /**
     * Determines if this group has a bot with the given ID in the given dimension.
     * @param dimension The dimension.
     * @param id The bot ID.
     */
    hasBotInDimension(dimension: string, id: string): boolean;

    /**
     * Gets the bot visualizer with the given ID from the given dimension.
     * @param dimension The dimension that the bot is in.
     * @param id The ID of the bot.
     */
    getBotInDimension(dimension: string, id: string): AuxBotVisualizer;

    /**
     * Adds the given bot to the given dimension in this group.
     * Returns the visualizer that was created.
     * @param dimension The dimension.
     * @param bot The bot.
     */
    addBotToDimension(dimension: string, bot: Bot): AuxBotVisualizer;

    /**
     * Removes the given bot from the given dimension.
     * @param dimension The dimension.
     * @param bot The bot.
     */
    removeBotFromDimension(dimension: string, bot: AuxBotVisualizer): void;

    /**
     * Indicates that the bot for the dimension group was updated.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated.
     * @param calc The calculation context.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext): void;

    /**
     * Indicates that the bot for the dimension group was updated.
     * @param bot The bot.
     * @param calc The calculation context.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): void;

    /**
     * Disposes of this dimension group.
     */
    dispose(): void;
}
