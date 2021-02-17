import {
    Bot,
    calculateBotValue,
    BotCalculationContext,
    TagUpdatedEvent,
    isBotInDimension,
    getBotPosition,
    getBotIndex,
    botDimensionSortOrder,
    hasValue,
    isSimulation,
    getBotChannel,
} from '@casual-simulation/aux-common';
import { remove } from 'lodash';
import { sortBy } from 'lodash';
import { PlayerPageSimulation3D } from './scene/PlayerPageSimulation3D';
import { Subject, Observable } from 'rxjs';

/**
 * Defines an interface for an item that is in a user's menu.
 */
export default interface SimulationItem {
    bot: Bot;
    simulation: PlayerPageSimulation3D;
    simulationToLoad: string;
    dimension: string;
}

/**
 * SimulationDimension is a helper class for managing the set of simulations that a user has loaded.
 */
export class SimulationDimension {
    /**
     * The simulation that the dimension is for.
     */
    simulation: PlayerPageSimulation3D;

    /**
     * The dimension that this object represents.
     */
    dimension: string = null;

    /**
     * All the bots that are in this dimension.
     */
    bots: Bot[] = [];

    /**
     * The bots in this dimensions mapped into simulation items.
     * Bots are ordered in ascending order based on their index in the dimensions.
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

    constructor(simulation: PlayerPageSimulation3D, dimension: string) {
        if (dimension == null || dimension == undefined) {
            throw new Error('Menu dimension cannot be null or undefined.');
        }
        this.simulation = simulation;
        this.dimension = dimension;
        this.bots = [];
        this._itemsUpdated = new Subject<void>();
    }

    /**
     * Notifies this dimension that the given bot was added to the state.
     * @param bot The bot.
     * @param calc The calculation context that should be used.
     */
    botAdded(bot: Bot, calc: BotCalculationContext) {
        const isInDimension = !!this.bots.find((f) => f.id == bot.id);
        const shouldBeInDimension =
            isBotInDimension(calc, bot, this.dimension) &&
            isSimulation(calc, bot);

        if (!isInDimension && shouldBeInDimension) {
            this._addBot(bot, calc);
        }
    }

    /**
     * Notifies this dimension that the given bot was updated.
     * @param bot The bot.
     * @param updates The changes made to the bot.
     * @param calc The calculation context that should be used.
     */
    botUpdated(bot: Bot, updates: Set<string>, calc: BotCalculationContext) {
        const isInDimension = !!this.bots.find((f) => f.id == bot.id);
        const shouldBeInDimension =
            isBotInDimension(calc, bot, this.dimension) &&
            isSimulation(calc, bot);

        if (!isInDimension && shouldBeInDimension) {
            this._addBot(bot, calc);
        } else if (isInDimension && !shouldBeInDimension) {
            this._removeBot(bot.id);
        } else if (isInDimension && shouldBeInDimension) {
            this._updateBot(bot, updates, calc);
        }
    }

    /**
     * Notifies this dimension that the given bot was removed from the state.
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
        remove(this.bots, (f) => f.id === id);
        this._itemsDirty = true;
    }

    private _updateBot(
        bot: Bot,
        updates: Set<string>,
        calc: BotCalculationContext
    ) {
        let botIndex = this.bots.findIndex((f) => f.id == bot.id);
        if (botIndex >= 0) {
            this.bots[botIndex] = bot;
            this._itemsDirty = true;
        }
    }

    private _resortItems(calc: BotCalculationContext): void {
        this.items = sortBy(this.bots, (f) =>
            botDimensionSortOrder(calc, f, this.dimension)
        ).map((f) => {
            return {
                bot: f,
                simulation: this.simulation,
                simulationToLoad: getBotChannel(calc, f),
                dimension: this.dimension,
            };
        });

        this._itemsUpdated.next();
    }
}
