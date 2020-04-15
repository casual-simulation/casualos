import {
    BotCalculationContext,
    Bot,
    LocalActions,
} from '@casual-simulation/aux-common';

/**
 * Defines an interface for a visualizer for a bot.
 */
export interface AuxBotVisualizer {
    /**
     * The bot used by this visualizer.
     */
    bot: Bot;

    /**
     * Indicates to the visualizer that the bot was updated.
     * @param bot The bot.
     * @param tags The tags that changed.
     * @param calc The calculation context.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext): void;

    /**
     * Updates the visualizer for the frame.
     * @param calc The calculation context.
     */
    frameUpdate(calc: BotCalculationContext): void;

    /**
     * Handles the given local event.
     * @param event The event.
     * @param calc The calculation context.
     */
    localEvent(event: LocalActions, calc: BotCalculationContext): void;

    /**
     * Disposes of all the resources this bot uses.
     */
    dispose(): void;
}
