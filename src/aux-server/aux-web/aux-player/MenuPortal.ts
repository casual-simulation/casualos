/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { SubscriptionLike } from 'rxjs';
import { Subscription, Subject } from 'rxjs';
import { tap, startWith } from 'rxjs/operators';
import { sortBy } from 'es-toolkit/compat';
import type { DimensionItem } from './DimensionItem';
import type {
    Simulation,
    BotDimensionsUpdate,
    SimulationManager,
} from '@casual-simulation/aux-vm';
import type { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { getBotIndex } from '@casual-simulation/aux-common';
import { MenuPortalConfig } from './MenuPortalConfig';
import type { RemoteSimulation } from '@casual-simulation/aux-vm-client';

/**
 * Defines a dimension that watches a set of simulations for changes to items in a dimension.
 */
export class MenuPortal implements SubscriptionLike {
    items: DimensionItem[] = [];
    extraStyle: object = {};

    private _dimensionTags: string[] = [];
    private _itemsUpdated = new Subject<DimensionItem[]>();
    private _configUpdated = new Subject<void>();

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
    private _config: MenuPortalConfig;

    constructor(
        simulationManager: SimulationManager<RemoteSimulation>,
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

    get configUpdated() {
        return this._configUpdated.pipe(startWith([undefined]));
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    private _onSimulationAdded(sim: RemoteSimulation): void {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        if (!this._config) {
            this._config = new MenuPortalConfig(this._dimensionTags[0], sim);
            sub.add(this._config);
            sub.add(
                this._config.onUpdated.subscribe(() => {
                    this._updateConfig();
                })
            );
        }

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

    private _updateConfig() {
        if (this._config) {
            this.extraStyle = this._config.style;
        } else {
            this.extraStyle = {};
        }
        this._configUpdated.next();
    }

    private _onSimulationRemoved(sim: Simulation): void {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        const botIds = [...this._botItemMap.keys()];
        for (let id of botIds) {
            const item = this._botItemMap.get(id);
            if (item.simulationId === sim.id) {
                this._botItemMap.delete(id);
            }
        }
        let menu = [...this._botItemMap.values()];
        let sorted = sortBy(menu, (i) => this._menuItemIndex(null, i));
        this.items = sorted;
        this._itemsUpdated.next(this.items);
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
        let order = -Infinity;
        let hasOrder = false;
        for (let dimension of item.dimensions) {
            let sort = getBotIndex(calc, item.bot, dimension);
            if (sort > order) {
                order = sort;
                hasOrder = true;
            }
        }
        if (hasOrder) {
            return order;
        } else {
            return 0;
        }
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
