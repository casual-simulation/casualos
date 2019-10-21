import Component from 'vue-class-component';
import { Inject, Prop } from 'vue-property-decorator';

import PlayerApp from '../PlayerApp/PlayerApp';
import { IGameView } from '../../shared/vue-components/IGameView';
import MenuBot from '../MenuBot/MenuBot';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { PlayerGame } from '../scene/PlayerGame';
import { Game } from '../../shared/scene/Game';
import { map, tap, combineLatest } from 'rxjs/operators';
import { appManager } from '../../shared/AppManager';
import { BotManager } from '@casual-simulation/aux-vm-browser';
import {
    Simulation,
    BotContextsUpdate,
    ContextAddedEvent,
} from '@casual-simulation/aux-vm';
import { MenuItem } from '../MenuItem';
import { Subscription, of } from 'rxjs';
import {
    Bot,
    BotCalculationContext,
    getBotIndex,
} from '@casual-simulation/aux-common';
import { sortBy } from 'lodash';

@Component({
    components: {
        'menu-bot': MenuBot,
    },
})
export default class PlayerGameView extends BaseGameView implements IGameView {
    _game: PlayerGame = null;
    menuExpanded: boolean = false;
    showInventoryCameraHome: boolean = false;
    inventoryViewportStyle: any = {};
    mainViewportStyle: any = {};

    hasMainViewport: boolean = false;
    hasInventoryViewport: boolean = false;
    menu: MenuItem[] = [];

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];
    @Prop() context: string;

    lastMenuCount: number = null;

    private _simulations: Map<Simulation, Subscription>;
    /**
     * A map of context IDs to a list of bot IDs that define the context.
     */
    private _contextMap: Map<string, Set<string>>;

    /**
     * A map of context IDs to a set of bots IDs that define the context.
     */
    private _botContextMap: Map<string, Set<string>>;

    /**
     * A map of bot IDs to menu item.
     */
    private _botItemMap: Map<string, MenuItem>;

    constructor() {
        super();
    }

    protected createGame(): Game {
        return new PlayerGame(this);
    }

    moveTouch(e: TouchEvent) {
        e.preventDefault();
    }

    mouseDownSlider() {
        this._game.mouseDownSlider();
    }

    mouseUpSlider() {
        this._game.mouseUpSlider();
    }

    setupCore() {
        this.menu = [];
        this._simulations = new Map();
        this._contextMap = new Map();
        this._botItemMap = new Map();
        this._botContextMap = new Map();
        this._subscriptions.push(
            this._game
                .watchCameraRigDistanceSquared(this._game.inventoryCameraRig)
                .pipe(
                    map(distSqr => distSqr >= 75),
                    tap(visible => (this.showInventoryCameraHome = visible))
                )
                .subscribe(),

            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._onSimulationAdded(sim)))
                .subscribe(),
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._onSimulationRemoved(sim)))
                .subscribe()
        );

        if (this._game.inventoryViewport) {
            this.hasInventoryViewport = true;

            let style = {
                bottom: this._game.inventoryViewport.y + 'px',
                left: this._game.inventoryViewport.x + 'px',
                width: this._game.inventoryViewport.width + 'px',
                height: this._game.inventoryViewport.height + 'px',
            };

            this.inventoryViewportStyle = style;

            this._subscriptions.push(
                this._game.inventoryViewport.onUpdated
                    .pipe(
                        map(viewport => ({
                            bottom: viewport.y + 'px',
                            left: viewport.x + 'px',
                            width: viewport.width + 'px',
                            height: viewport.height + 'px',
                        })),
                        tap(style => {
                            this.inventoryViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }

        if (this._game.mainViewport && this._game.inventoryViewport) {
            this.hasMainViewport = true;
            this._subscriptions.push(
                this._game.mainViewport.onUpdated
                    .pipe(
                        combineLatest(
                            this._game.inventoryViewport.onUpdated,
                            (first, second) => ({
                                main: first,
                                inventory: second,
                            })
                        ),
                        map(({ main, inventory }) => ({
                            bottom: inventory.height + 'px',
                            left: main.x + 'px',
                            width: main.width + 'px',
                            height: main.height - inventory.height + 'px',
                        })),
                        tap(style => {
                            this.mainViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }
    }

    private _onSimulationAdded(sim: BotManager): void {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.contexts
                .watchContexts('aux._userMenuContext')
                .pipe(tap(update => this._updateMenuContexts(sim, update)))
                .subscribe()
        );
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
            this.menu = sorted;
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
        item: MenuItem
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

    private _onSimulationRemoved(sim: BotManager): void {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
    }

    centerInventoryCamera() {
        this._game.onCenterCamera(this._game.inventoryCameraRig);
    }
}
