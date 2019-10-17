import {
    Bot,
    BotCalculationContext,
    TagUpdatedEvent,
    hasValue,
    calculateBotValue,
    AuxDomain,
    getBotConfigContexts,
} from '@casual-simulation/aux-common';
import { difference, flatMap } from 'lodash';
import { Simulation3D } from './Simulation3D';
import { ContextGroupUpdate, ContextGroup } from './ContextGroup';
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

    private _getContexts: (calc: BotCalculationContext, bot: Bot) => string[];

    /**
     * Creates a new context group helper.
     * @param bot The bot that this builder represents.
     * @param getContexts A function that calculates the contexts that should be displayed for the given bot.
     */
    constructor(
        bot: Bot,
        getContexts: (calc: BotCalculationContext, bot: Bot) => string[]
    ) {
        this.bot = bot;
        this.contexts = new Set();
        this.bots = new Map();
        this._getContexts = getContexts;
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
    botAdded(bot: Bot, calc: BotCalculationContext): ContextGroupUpdate {
        if (bot.id !== this.bot.id) {
            return null;
        }
        this.bot = bot;
        return this._updateContexts(bot, calc, true);
    }

    /**
     * Notifies the builder context that the given bot was updated.
     * @param bot The bot that was updated.
     * @param tags The tags that were updated on the bot.
     * @param calc The bot calculation context that should be used.
     */
    botUpdated(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ): ContextGroupUpdate {
        if (bot.id !== this.bot.id) {
            return null;
        }
        this.bot = bot;
        return this._updateContexts(bot, calc, false);
    }

    /**
     * Notifies the builder context that the given bot was removed from the state.
     * @param id The ID of the bot that was removed.
     * @param calc The bot calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {}

    /**
     * Updates the contexts that this context group should be displaying.
     * @param bot The context bot.
     * @param calc The bot calculation context that should be used.
     */
    private _updateContexts(
        bot: Bot,
        calc: BotCalculationContext,
        firstUpdate: boolean
    ) {
        const contexts = this._getContexts(calc, bot);
        // TODO: Handle scenarios where builder.context is empty or null
        if (contexts) {
            return this._addContexts(bot, contexts, calc, firstUpdate);
        }
        return {
            addedContexts: [],
            removedContexts: [],
            removedBots: [],
        };
    }

    protected _updateThis(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ) {}

    private _addContexts(
        bot: Bot,
        newContexts: string[],
        calc: BotCalculationContext,
        firstUpdate: boolean
    ): ContextGroupUpdate {
        let contexts = newContexts || [];

        const currentContexts = this.currentContexts();
        const missingContexts = difference(contexts, currentContexts);
        const removedContexts = difference(currentContexts, contexts);
        let removedBots: T[] = [];

        for (let c of missingContexts) {
            this.contexts.add(c);
        }
        for (let c of removedContexts) {
            this.contexts.delete(c);

            const bots = this.getBotsInContext(c);
            for (let [id, bot] of bots) {
                removedBots.push(bot);
                this._removeBot(bot, bots);
            }
        }

        return {
            addedContexts: missingContexts,
            removedContexts: removedContexts,
            removedBots: removedBots,
        };
    }

    private _removeBot(mesh: T, bots: Map<string, T>) {
        bots.delete(mesh.bot.id);
    }

    private currentContexts(): string[] {
        return [...this.contexts.keys()];
    }
}
