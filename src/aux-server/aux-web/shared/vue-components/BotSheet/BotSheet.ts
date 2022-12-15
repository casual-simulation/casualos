import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    ON_SHEET_TAG_CLICK,
    ON_SHEET_BOT_ID_CLICK,
    ON_SHEET_BOT_CLICK,
    toast,
    tweenTo,
    SHEET_PORTAL,
    CLICK_ACTION_NAME,
    onClickArg,
    getPortalTag,
    createBotLink,
    FocusOnBotAction,
} from '@casual-simulation/aux-common';
import {
    BotManager,
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import BotTable, { TableBot } from '../BotTable/BotTable';
import { Subscription, SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { SheetPortalConfig } from './SheetPortalConfig';
import { Simulation } from '@casual-simulation/aux-vm';
import { flatMap } from 'lodash';

interface SheetState {
    bots: Bot[];
    isDiff: boolean;
    hasPortal: boolean;
    dimension: string;
    showNewBot: boolean;
}

interface SystemPortalState {
    hasSystemPortal: boolean;
}

@Component({
    components: {
        'bot-table': BotTable,
    },
})
export default class BotSheet extends Vue {
    bots: TableBot[] = [];
    dimension: string = '';
    isDiff: boolean = false;
    hasPortal: boolean = false;
    hasSystemPortal: boolean = false;
    showNewBot: boolean = true;

    showButton: boolean = true;
    buttonIcon: string = null;
    buttonHint: string = null;
    allowedTags: string[] = null;
    addedTags: string[] = null;

    private _simulations: BrowserSimulation[];
    private _simulationSubs: Map<Simulation, Subscription>;
    private _simulationSheetStates: Map<Simulation, SheetState>;
    private _simulationSystemPortalStates: Map<Simulation, SystemPortalState>;
    private _sub: Subscription;
    private _focusEvent: FocusOnBotAction;
    private _focusEventSim: BrowserSimulation;
    private _currentConfig: SheetPortalConfig;

    constructor() {
        super();
    }

    getBotTable() {
        return this.$refs.table as BotTable;
    }

    created() {
        this._simulations = [];
        this._simulationSubs = new Map();
        this._sub = new Subscription();
        this._simulationSheetStates = new Map();
        this._simulationSystemPortalStates = new Map();

        this._currentConfig = new SheetPortalConfig(SHEET_PORTAL);
        this._sub.add(this._currentConfig);
        this._sub.add(
            this._currentConfig.onUpdated
                .pipe(
                    tap(() => {
                        this._updateConfig();
                    })
                )
                .subscribe()
        );

        this._sub.add(
            appManager.simulationManager.simulationAdded.subscribe((sim) => {
                const sub = new Subscription();
                this._simulations.push(sim);

                this._onSimulationAdded(sim, sub);

                this._simulationSubs.set(sim, sub);
            })
        );

        this._sub.add(
            appManager.simulationManager.simulationRemoved.subscribe((sim) => {
                const index = this._simulations.indexOf(sim);
                if (index >= 0) {
                    this._simulations.splice(index, 1);
                }
                const sub = this._simulationSubs.get(sim);

                if (sub) {
                    sub.unsubscribe();
                    this._simulationSubs.delete(sim);
                }
            })
        );
        // appManager.whileLoggedIn((user, botManager) => {
        //     let subs: SubscriptionLike[] = [];
        //     this._simulation = appManager.simulationManager.primary;
        //     this.bots = [];

        //     subs.push(
        //         this._simulation.botPanel.botsUpdated.subscribe((e) => {
        //             this.bots = e.bots;
        //             this.isDiff = e.isDiff;
        //             this.hasPortal = e.hasPortal;
        //             this.dimension = e.dimension;
        //             this.showNewBot = !e.isSingleBot;
        //             this._updateConfig();
        //         }),
        //         this._simulation.systemPortal.onItemsUpdated.subscribe((e) => {
        //             this.hasSystemPortal = e.hasPortal;
        //             this._updateConfig();
        //         }),
        //         this._simulation.localEvents.subscribe((e) => {
        //             if (e.type === 'focus_on') {
        //                 if (
        //                     hasValue(e.tag) &&
        //                     hasValue(e.portal) &&
        //                     getPortalTag(e.portal) === SHEET_PORTAL
        //                 ) {
        //                     const table = this.getBotTable();
        //                     if (table) {
        //                         if (hasValue(e.startIndex)) {
        //                             table.selectBotAndTag(
        //                                 e.botId,
        //                                 e.tag,
        //                                 e.space,
        //                                 e.startIndex ?? 0,
        //                                 e.endIndex ?? e.startIndex ?? 0
        //                             );
        //                         } else {
        //                             table.selectBotAndTagByLineNumber(
        //                                 e.botId,
        //                                 e.tag,
        //                                 e.space,
        //                                 e.lineNumber ?? 1,
        //                                 e.columnNumber ?? 1
        //                             );
        //                         }
        //                     } else {
        //                         this._focusEvent = e;
        //                         const tags: BotTags = {
        //                             [SHEET_PORTAL]: e.botId,
        //                         };
        //                         this._simulation.helper.updateBot(
        //                             this._simulation.helper.userBot,
        //                             {
        //                                 tags: tags,
        //                             }
        //                         );
        //                     }
        //                 }
        //             }
        //         })
        //     );
        //     this._currentConfig = new SheetPortalConfig(
        //         SHEET_PORTAL,
        //         botManager
        //     );
        //     subs.push(
        //         this._currentConfig,
        //         this._currentConfig.onUpdated
        //             .pipe(
        //                 tap(() => {
        //                     this._updateConfig();
        //                 })
        //             )
        //             .subscribe()
        //     );
        //     return subs;
        // });
    }

    private _onSimulationAdded(sim: BotManager, sub: Subscription) {
        sub.add(
            sim.botPanel.botsUpdated.subscribe((e) => {
                this._simulationSheetStates.set(sim, {
                    bots: e.bots,
                    isDiff: e.isDiff,
                    hasPortal: e.hasPortal,
                    dimension: e.dimension,
                    showNewBot: !e.isSingleBot,
                });
                this._updateConfig();
            })
        );

        sub.add(
            sim.systemPortal.onItemsUpdated.subscribe((e) => {
                this._simulationSystemPortalStates.set(sim, {
                    hasSystemPortal: e.hasPortal,
                });
                this._updateConfig();
            })
        );

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'focus_on') {
                    if (
                        hasValue(e.tag) &&
                        hasValue(e.portal) &&
                        getPortalTag(e.portal) === SHEET_PORTAL
                    ) {
                        const table = this.getBotTable();
                        if (table) {
                            if (hasValue(e.startIndex)) {
                                table.selectBotAndTag(
                                    sim,
                                    e.botId,
                                    e.tag,
                                    e.space,
                                    e.startIndex ?? 0,
                                    e.endIndex ?? e.startIndex ?? 0
                                );
                            } else {
                                table.selectBotAndTagByLineNumber(
                                    sim,
                                    e.botId,
                                    e.tag,
                                    e.space,
                                    e.lineNumber ?? 1,
                                    e.columnNumber ?? 1
                                );
                            }
                        } else {
                            this._focusEvent = e;
                            this._focusEventSim = sim;
                            const tags: BotTags = {
                                [SHEET_PORTAL]: e.botId,
                            };
                            sim.helper.updateBot(sim.helper.userBot, {
                                tags: tags,
                            });
                        }
                    }
                }
            })
        );

        sub.add(this._currentConfig.addSimulation(sim));
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }

        if (this._simulationSubs) {
            for (let [sim, sub] of this._simulationSubs) {
                sub.unsubscribe();
            }
            this._simulationSubs = null;
        }

        this._currentConfig = null;
    }

    tagFocusChanged(bot: TableBot, tag: string, focused: boolean) {
        for (let sim of this._simulations) {
            if (bot.bot.id in sim.helper.botsState) {
                sim.helper.setEditingBot(bot.bot, tag);
            }
        }
    }

    async exitSheet() {
        if (this._currentConfig) {
            let hasResult = false;
            for (let sim of this._currentConfig.simulations) {
                const state = this._simulationSheetStates.get(sim);
                if (state) {
                    const result = await sim.helper.shout(
                        CLICK_ACTION_NAME,
                        [sim.helper.userBot],
                        onClickArg(
                            null,
                            state.dimension,
                            null,
                            'mouse',
                            null,
                            null
                        )
                    );

                    if (result.results.length > 0) {
                        hasResult = true;
                    }
                }
            }

            if (!hasResult) {
                this._exitSheet();
            }
        } else {
            this._exitSheet();
        }
    }

    private _exitSheet() {
        for (let sim of this._simulations) {
            const state = this._simulationSheetStates.get(sim);
            if (state) {
                const gridPortal = sim.helper.userBot.values.gridPortal;
                let tags: BotTags = {
                    sheetPortal: null,
                };
                if (!hasValue(gridPortal)) {
                    tags.gridPortal = state.dimension;
                }
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: tags,
                });
            }
        }
    }

    async botClick(bot: Bot) {
        let hasResult = false;
        for (let sim of this._simulations) {
            const result = await sim.helper.shout(ON_SHEET_BOT_CLICK, null, {
                bot: bot,
            });
            if (result.results.length > 0) {
                hasResult = true;
            }
        }

        if (!hasResult) {
            this.exitSheet();
            for (let sim of this._simulations) {
                sim.helper.transaction(tweenTo(bot.id, { duration: 0 }));
            }
        }
    }

    async botIDClick(id: string) {
        let hasResult = false;
        for (let sim of this._simulations) {
            const result = await sim.helper.shout(ON_SHEET_BOT_ID_CLICK, null, {
                bot: sim.helper.botsState[id],
            });
            if (result.results.length > 0) {
                hasResult = true;
            }
        }

        if (!hasResult) {
            copyToClipboard(id);
            for (let sim of this._simulations) {
                sim.helper.transaction(toast('Copied!'));
            }
        }
    }

    async goToTag(tag: string) {
        for (let sim of this._simulations) {
            const result = await sim.helper.shout(ON_SHEET_TAG_CLICK, null, {
                tag: tag,
            });
            if (result.results.length <= 0) {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: {
                        sheetPortal: tag,
                    },
                });
            }
        }
    }

    private _updateConfig() {
        this.bots = [];
        this.dimension = null;
        this.hasPortal = false;
        this.showNewBot = null;
        for (let [sim, state] of this._simulationSheetStates) {
            this.bots.push(
                ...state.bots.map((b) => ({
                    bot: b,
                    simId: sim.id,
                }))
            );

            if (!hasValue(this.dimension) && hasValue(state.dimension)) {
                this.dimension = state.dimension;
            }

            if (!this.hasPortal) {
                this.hasPortal = state.hasPortal;
            }

            if (!hasValue(this.showNewBot)) {
                this.showNewBot = state.showNewBot;
            }

            if (!this.isDiff) {
                this.isDiff = state.isDiff;
            }
        }

        this.hasSystemPortal = false;
        for (let [sim, state] of this._simulationSystemPortalStates) {
            if (state.hasSystemPortal) {
                this.hasSystemPortal = true;
                break;
            }
        }

        if (!hasValue(this.showNewBot)) {
            this.showNewBot = false;
        }

        if (this._currentConfig) {
            this.showButton =
                this._currentConfig.showButton ??
                (this.hasSystemPortal ? false : true);
            this.buttonIcon = this._currentConfig.buttonIcon;
            this.buttonHint = this._currentConfig.buttonHint;
            this.allowedTags = this._currentConfig.allowedTags;
            this.addedTags = this._currentConfig.addedTags;
        } else {
            this.showButton = this.hasSystemPortal ? false : true;
            this.buttonIcon = null;
            this.buttonHint = null;
            this.allowedTags = null;
            this.addedTags = null;
        }
    }

    onTableMounted() {
        const e = this._focusEvent;
        const sim = this._focusEventSim;
        if (e) {
            const table = this.getBotTable();
            if (table) {
                this._focusEvent = null;
                this._focusEventSim = null;
                if (hasValue(e.startIndex)) {
                    table.selectBotAndTag(
                        sim,
                        e.botId,
                        e.tag,
                        e.space,
                        e.startIndex ?? 0,
                        e.endIndex ?? e.startIndex ?? 0
                    );
                } else {
                    table.selectBotAndTagByLineNumber(
                        sim,
                        e.botId,
                        e.tag,
                        e.space,
                        e.lineNumber ?? 1,
                        e.columnNumber ?? 1
                    );
                }
            }
        }
    }
}
