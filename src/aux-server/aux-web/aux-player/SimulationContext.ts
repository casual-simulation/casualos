import {
    Bot,
    calculateBotValue,
    BotCalculationContext,
    TagUpdatedEvent,
    isBotInContext,
    getBotPosition,
    getBotIndex,
    botContextSortOrder,
    hasValue,
    isSimulation,
    getBotChannel,
} from '@casual-simulation/aux-common';
import remove from 'lodash/remove';
import sortBy from 'lodash/sortBy';
import { PlayerSimulation3D } from './scene/PlayerSimulation3D';
import { Subject, Observable } from 'rxjs';

/**
 * Defines an interface for an item that is in a user's menu.
 */
export default interface SimulationItem {
    bot: Bot;
    simulation: PlayerSimulation3D;
    simulationToLoad: string;
    context: string;
}

/**
 * SimulationContext is a helper class for managing the set of simulations that a user has loaded.
 */
export class SimulationContext {
    /**
     * The simulation that the context is for.
     */
    simulation: PlayerSimulation3D;

    /**
     * The context that this object represents.
     */
    context: string = null;

    /**
     * All the bots that are in this context.
     */
    bots: Bot[] = [];

    /**
     * The bots in this contexts mapped into simulation items.
     * Bots are ordered in ascending order based on their index in the context.
     */
    items: SimulationItem[] = [];

    /**
     * Gets an observable that resolves whenever this simulation's items are updated.
     */
    get itemsUpdated(): Observable<void> {
        return this._itemsUpdated;
    }

    private _itemsUpdated: Subject<void>;
    private _itemsDirty: boolean;

    constructor(simulation: PlayerSimulation3D, context: string) {
        if (context == null || context == undefined) {
            throw new Error('Menu context cannot be null or undefined.');
        }
        this.simulation = simulation;
        this.context = context;
        this.bots = [];
        this._itemsUpdated = new Subject<void>();
    }

    /**
     * Notifies this context that the given bot was added to the state.
     * @param bot The bot.
     * @param calc The calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext) {
        const isInContext = !!this.bots.find(f => f.id == bot.id);
        const shouldBeInContext =
            isBotInContext(calc, bot, this.context) && isSimulation(calc, bot);

        if (!isInContext && shouldBeInContext) {
            this._addBot(bot, calc);
        }
    }

    /**
     * Notifies this context that the given bot was updated.
     * @param bot The bot.
     * @param updates The changes made to the bot.
     * @param calc The calculation context that should be used.
     */
    botUpdated(bot: Bot, updates: Set<string>, calc: BotCalculationContext) {
        const isInContext = !!this.bots.find(f => f.id == bot.id);
        const shouldBeInContext =
            isBotInContext(calc, bot, this.context) && isSimulation(calc, bot);

        if (!isInContext && shouldBeInContext) {
            this._addBot(bot, calc);
        } else if (isInContext && !shouldBeInContext) {
            this._removeBot(bot.id);
        } else if (isInContext && shouldBeInContext) {
            this._updateBot(bot, updates, calc);
        }
    }

    /**
     * Notifies this context that the given bot was removed from the state.
     * @param bot The ID of the bot that was removed.
     * @param calc The calculation context.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        this._removeBot(id);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._itemsDirty) {
            this._resortItems(calc);
            this._itemsDirty = false;
        }
    }

    dispose(): void {
        this._itemsUpdated.unsubscribe();
    }

    private _addBot(bot: Bot, calc: BotCalculationContext) {
        this.bots.push(bot);
        this._itemsDirty = true;
    }

    private _removeBot(id: string) {
        remove(this.bots, f => f.id === id);
        this._itemsDirty = true;
    }

    private _updateBot(
        bot: Bot,
        updates: Set<string>,
        calc: BotCalculationContext
    ) {
        let botIndex = this.bots.findIndex(f => f.id == bot.id);
        if (botIndex >= 0) {
            this.bots[botIndex] = bot;
            this._itemsDirty = true;
        }
    }

    private _resortItems(calc: BotCalculationContext): void {
        this.items = sortBy(this.bots, f =>
            botContextSortOrder(calc, f, this.context)
        ).map(f => {
            return {
                bot: f,
                simulation: this.simulation,
                simulationToLoad: getBotChannel(calc, f),
                context: this.context,
            };
        });

        this._itemsUpdated.next();
    }
}
