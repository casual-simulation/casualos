import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { flatMap } from 'lodash';
import { AuxBotVisualizer } from './AuxBotVisualizer';

/**
 * Defines a class that helps implement DimensionGroup.
 */
export class DimensionGroupHelper<T extends AuxBotVisualizer> {
    /**
     * The bot that this dimension represents.
     */
    bot: Bot;

    /**
     * The dimensions that are represented by this builder dimension.
     */
    dimensions: Set<string>;

    /**
     * A map of dimensions to a map of bot IDs to bots in the dimension group.
     */
    bots: Map<string, Map<string, T>>;

    /**
     * Creates a new dimension group helper.
     * @param bot The bot that this builder represents.
     */
    constructor(bot: Bot) {
        this.bot = bot;
        this.dimensions = new Set();
        this.bots = new Map();
    }

    addDimension(dimension: string) {
        this.dimensions.add(dimension);
    }

    removeDimension(dimension: string): T[] {
        let bots = this.getBotsInDimension(dimension);
        this.dimensions.delete(dimension);
        return [...bots.values()];
    }

    hasBotInDimension(dimension: string, id: string): boolean {
        const bots = this.getBotsInDimension(dimension);
        return bots.has(id);
    }

    getBotInDimension(dimension: string, id: string): T {
        const bots = this.getBotsInDimension(dimension);
        return bots.get(id);
    }

    addBotToDimension(dimension: string, bot: Bot, mesh: T): T {
        const bots = this.getBotsInDimension(dimension);
        bots.set(bot.id, mesh);
        return mesh;
    }

    removeBotFromDimension(dimension: string, bot: T): void {
        const bots = this.getBotsInDimension(dimension);
        bots.delete(bot.bot.id);
    }

    getBotsInDimension(dimension: string): Map<string, T> {
        let map = this.bots.get(dimension);
        if (!map) {
            map = new Map();
            this.bots.set(dimension, map);
        }
        return map;
    }

    /**
     * Gets the bots that are contained by this builder dimension.
     */
    getBots() {
        return flatMap([...this.bots.values()].map((b) => [...b.values()]));
    }

    /**
     * Notifies the builder dimension that the given bot was added to the state.
     * @param bot The bot that was added.
     * @param calc The bot calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext): void {
        if (bot.id !== this.bot.id) {
            return;
        }
        this.bot = bot;
    }

    /**
     * Notifies the builder dimension that the given bot was updated.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated on the bot.
     * @param calc The bot calculation context that should be used.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext): void {
        if (bot.id !== this.bot.id) {
            return;
        }
        this.bot = bot;
    }

    /**
     * Notifies the builder dimension that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {}
}
