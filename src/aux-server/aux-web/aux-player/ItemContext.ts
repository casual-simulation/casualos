import { appManager } from '../shared/AppManager';
import { Subscription, Subject, SubscriptionLike } from 'rxjs';
import { tap, startWith } from 'rxjs/operators';
import sortBy from 'lodash/sortBy';
import { ContextItem } from './ContextItem';
import { Simulation, BotContextsUpdate } from '@casual-simulation/aux-vm';
import {
    getBotIndex,
    Bot,
    BotCalculationContext,
} from '@casual-simulation/aux-common';

/**
 * Defines a context that watches a set of simulations for changes to items in a context.
 */
export class ItemContext implements SubscriptionLike {
    items: ContextItem[] = [];

    private _contextTags: string[] = [];
    private _itemsUpdated = new Subject<ContextItem[]>();

    private _sub: Subscription;
    private _simulations: Map<Simulation, Subscription> = new Map();
    /**
     * A map of context IDs to a list of bot IDs that define the context.
     */
    private _contextMap: Map<string, Set<string>> = new Map();

    /**
     * A map of context IDs to a set of bots IDs that define the context.
     */
    private _botContextMap: Map<string, Set<string>> = new Map();

    /**
     * A map of bot IDs to menu item.
     */
    private _botItemMap: Map<string, ContextItem> = new Map();

    constructor(contextTags: string[]) {
        this._contextTags = contextTags;
        this._sub = new Subscription();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._onSimulationRemoved(sim)))
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
            sim.contexts
                .watchContexts(...this._contextTags)
                .pipe(tap(update => this._updateMenuContexts(sim, update)))
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

    private _updateMenuContexts(
        sim: Simulation,
        updates: BotContextsUpdate
    ): void {
        let hasUpdate = false;
        for (let event of updates.contextEvents) {
            if (event.type === 'context_added') {
                if (event.contextBot.id !== sim.helper.userId) {
                    continue;
                }

                let list = this._getBotIdsDefiningContext(event.context);
                list.add(event.contextBot.id);

                let bots = this._getBotsInContext(event.context);
                for (let bot of event.existingBots) {
                    bots.add(bot.id);
                    this._addMenuItem(bot, event.context, sim);
                }
            } else if (event.type === 'context_removed') {
                if (event.contextBot.id !== sim.helper.userId) {
                    continue;
                }

                let list = this._getBotIdsDefiningContext(event.context);
                list.delete(event.contextBot.id);
                if (list.size === 0) {
                    let bots = this._getBotsInContext(event.context);
                    bots.clear();
                }
            } else if (event.type === 'bot_added_to_context') {
                let list = this._getBotIdsDefiningContext(event.context);
                if (list.size <= 0) {
                    continue;
                }

                let bots = this._getBotsInContext(event.context);
                bots.add(event.bot.id);

                this._addMenuItem(event.bot, event.context, sim);

                hasUpdate = true;
            } else if (event.type === 'bot_removed_from_context') {
                let bots = this._getBotsInContext(event.context);
                bots.delete(event.bot.id);

                let item = this._botItemMap.get(event.bot.id);
                if (!item) {
                    item = {
                        bot: event.bot,
                        simulationId: sim.id,
                        contexts: new Set([event.context]),
                    };
                }

                item.contexts.delete(event.context);
                if (item.contexts.size <= 0) {
                    this._botItemMap.delete(event.bot.id);
                }
                hasUpdate = true;
            }
        }

        for (let update of updates.updatedBots) {
            if (this._botItemMap.has(update.bot.id)) {
                let item = this._botItemMap.get(update.bot.id);
                item.bot = update.bot;
                hasUpdate = true;
            }
        }

        if (hasUpdate) {
            let menu = [...this._botItemMap.values()];
            let sorted = sortBy(menu, i =>
                this._menuItemIndex(updates.calc, i)
            );
            this.items = sorted;
            this._itemsUpdated.next(this.items);
        }
    }

    private _addMenuItem(bot: Bot, context: string, sim: Simulation) {
        let item = this._botItemMap.get(bot.id);
        if (!item) {
            item = {
                bot: bot,
                simulationId: sim.id,
                contexts: new Set([context]),
            };
        } else {
            item.contexts.add(context);
        }

        this._botItemMap.set(bot.id, item);
        return item;
    }

    private _menuItemIndex(
        calc: BotCalculationContext,
        item: ContextItem
    ): number {
        let order = 0;
        for (let context of item.contexts) {
            let sort = getBotIndex(calc, item.bot, context);
            if (sort > order) {
                order = sort;
            }
        }
        return order;
    }

    private _getBotIdsDefiningContext(context: string) {
        let list = this._contextMap.get(context);
        if (!list) {
            list = new Set();
            this._contextMap.set(context, list);
        }
        return list;
    }

    private _getBotsInContext(context: string) {
        let map = this._botContextMap.get(context);
        if (!map) {
            map = new Set();
            this._botContextMap.set(context, map);
        }
        return map;
    }
}
