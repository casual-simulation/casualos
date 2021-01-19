import { Subscription, Subject, SubscriptionLike } from 'rxjs';
import { tap, startWith } from 'rxjs/operators';
import sortBy from 'lodash/sortBy';
import { DimensionItem } from './DimensionItem';
import {
    Simulation,
    BotDimensionsUpdate,
    SimulationManager,
} from '@casual-simulation/aux-vm';
import {
    getBotIndex,
    Bot,
    BotCalculationContext,
} from '@casual-simulation/aux-common';

/**
 * Defines a dimension that watches a set of simulations for changes to items in a dimension.
 */
export class ItemDimension implements SubscriptionLike {
    items: DimensionItem[] = [];

    private _dimensionTags: string[] = [];
    private _itemsUpdated = new Subject<DimensionItem[]>();

    private _sub: Subscription;
    private _simulations: Map<Simulation, Subscription> = new Map();
    /**
     * A map of dimension IDs to a list of bot IDs that define the dimension.
     */
    private _dimensionMap: Map<string, Set<string>> = new Map();

    /**
     * A map of dimension IDs to a set of bots IDs that define the dimension.
     */
    private _botDimensionMap: Map<string, Set<string>> = new Map();

    /**
     * A map of bot IDs to menu item.
     */
    private _botItemMap: Map<string, DimensionItem> = new Map();

    constructor(
        simulationManager: SimulationManager<Simulation>,
        dimensionTags: string[]
    ) {
        this._dimensionTags = dimensionTags;
        this._sub = new Subscription();

        this._sub.add(
            simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    get itemsUpdated() {
        return this._itemsUpdated.pipe(startWith(this.items));
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    private _onSimulationAdded(sim: Simulation): void {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.dimensions
                .watchDimensions(
                    this._dimensionTags,
                    (bot) => bot.id === sim.helper.userId
                )
                .pipe(tap((update) => this._updateMenuDimensions(sim, update)))
                .subscribe()
        );
    }

    private _onSimulationRemoved(sim: Simulation): void {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
    }

    private _updateMenuDimensions(
        sim: Simulation,
        updates: BotDimensionsUpdate
    ): void {
        let hasUpdate = false;
        for (let event of updates.events) {
            if (event.type === 'dimension_added') {
                if (event.dimensionBot.id !== sim.helper.userId) {
                    continue;
                }

                let list = this._getBotIdsDefiningDimension(event.dimension);
                list.add(event.dimensionBot.id);

                let bots = this._getBotsInDimension(event.dimension);
                for (let bot of event.existingBots) {
                    bots.add(bot.id);
                    this._addMenuItem(bot, event.dimension, sim);
                }

                hasUpdate = true;
            } else if (event.type === 'dimension_removed') {
                if (event.dimensionBot.id !== sim.helper.userId) {
                    continue;
                }

                let list = this._getBotIdsDefiningDimension(event.dimension);
                list.delete(event.dimensionBot.id);
                if (list.size === 0) {
                    let bots = this._getBotsInDimension(event.dimension);
                    for (let id of bots) {
                        const item = this._botItemMap.get(id);
                        if (item && item.dimensions.has(event.dimension)) {
                            if (item.dimensions.size <= 1) {
                                this._botItemMap.delete(id);
                            } else {
                                item.dimensions.delete(event.dimension);
                            }
                        }
                    }
                    bots.clear();
                }
                hasUpdate = true;
            } else if (event.type === 'bot_added_to_dimension') {
                let list = this._getBotIdsDefiningDimension(event.dimension);
                if (list.size <= 0) {
                    continue;
                }

                let bots = this._getBotsInDimension(event.dimension);
                bots.add(event.bot.id);

                this._addMenuItem(event.bot, event.dimension, sim);

                hasUpdate = true;
            } else if (event.type === 'bot_removed_from_dimension') {
                let bots = this._getBotsInDimension(event.dimension);
                bots.delete(event.bot.id);

                let item = this._botItemMap.get(event.bot.id);
                if (!item) {
                    item = {
                        bot: event.bot,
                        simulationId: sim.id,
                        dimensions: new Set([event.dimension]),
                    };
                }

                item.dimensions.delete(event.dimension);
                if (item.dimensions.size <= 0) {
                    this._botItemMap.delete(event.bot.id);
                }
                hasUpdate = true;
            }
        }

        for (let update of updates.updatedBots) {
            if (this._botItemMap.has(update.bot.id)) {
                let item = this._botItemMap.get(update.bot.id);

                // We make a new item to force change detection
                // in Vue.js for menus.
                let newItem = {
                    ...item,
                    bot: update.bot,
                };
                this._botItemMap.set(update.bot.id, newItem);
                hasUpdate = true;
            }
        }

        if (hasUpdate) {
            let menu = [...this._botItemMap.values()];
            let sorted = sortBy(menu, (i) =>
                this._menuItemIndex(updates.calc, i)
            );
            this.items = sorted;
            this._itemsUpdated.next(this.items);
        }
    }

    private _addMenuItem(bot: Bot, dimension: string, sim: Simulation) {
        let item = this._botItemMap.get(bot.id);
        if (!item) {
            item = {
                bot: bot,
                simulationId: sim.id,
                dimensions: new Set([dimension]),
            };
        } else {
            item.dimensions.add(dimension);
        }

        this._botItemMap.set(bot.id, item);
        return item;
    }

    private _menuItemIndex(
        calc: BotCalculationContext,
        item: DimensionItem
    ): number {
        let order = 0;
        for (let dimension of item.dimensions) {
            let sort = getBotIndex(calc, item.bot, dimension);
            if (sort > order) {
                order = sort;
            }
        }
        return order;
    }

    private _getBotIdsDefiningDimension(dimension: string) {
        let list = this._dimensionMap.get(dimension);
        if (!list) {
            list = new Set();
            this._dimensionMap.set(dimension, list);
        }
        return list;
    }

    private _getBotsInDimension(dimension: string) {
        let map = this._botDimensionMap.get(dimension);
        if (!map) {
            map = new Set();
            this._botDimensionMap.set(dimension, map);
        }
        return map;
    }
}
