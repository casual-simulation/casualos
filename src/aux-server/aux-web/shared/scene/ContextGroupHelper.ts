import { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import flatMap from 'lodash/flatMap';
import { AuxBotVisualizer } from './AuxBotVisualizer';

/**
 * Defines a class that helps implement ContextGroup.
 */
export class ContextGroupHelper<T extends AuxBotVisualizer> {
    /**
     * The bot that this context represents.
     */
    bot: Bot;

    /**
     * The contexts that are represented by this builder context.
     */
    contexts: Set<string>;

    /**
     * A map of contexts to a map of bot IDs to bots in the context group.
     */
    bots: Map<string, Map<string, T>>;

    /**
     * Creates a new context group helper.
     * @param bot The bot that this builder represents.
     * @param getContexts A function that calculates the contexts that should be displayed for the given bot.
     */
    constructor(bot: Bot) {
        this.bot = bot;
        this.contexts = new Set();
        this.bots = new Map();
    }

    addContext(context: string) {
        this.contexts.add(context);
    }

    removeContext(context: string): T[] {
        let bots = this.getBotsInContext(context);
        this.contexts.delete(context);
        return [...bots.values()];
    }

    hasBotInContext(context: string, id: string): boolean {
        const bots = this.getBotsInContext(context);
        return bots.has(id);
    }

    getBotInContext(context: string, id: string): T {
        const bots = this.getBotsInContext(context);
        return bots.get(id);
    }

    addBotToContext(context: string, bot: Bot, mesh: T): T {
        const bots = this.getBotsInContext(context);
        bots.set(bot.id, mesh);
        return mesh;
    }

    removeBotFromContext(context: string, bot: T): void {
        const bots = this.getBotsInContext(context);
        bots.delete(bot.bot.id);
    }

    getBotsInContext(context: string): Map<string, T> {
        let map = this.bots.get(context);
        if (!map) {
            map = new Map();
            this.bots.set(context, map);
        }
        return map;
    }

    /**
     * Gets the bots that are contained by this builder context.
     */
    getBots() {
        return flatMap([...this.bots.values()].map(b => [...b.values()]));
    }

    /**
     * Notifies the builder context that the given bot was added to the state.
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
     * Notifies the builder context that the given bot was updated.
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
     * Notifies the builder context that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {}
}
