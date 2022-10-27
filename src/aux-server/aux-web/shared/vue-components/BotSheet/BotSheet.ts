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
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import BotTable from '../BotTable/BotTable';
import { SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { SheetPortalConfig } from './SheetPortalConfig';

@Component({
    components: {
        'bot-table': BotTable,
    },
})
export default class BotSheet extends Vue {
    bots: Bot[] = [];
    dimension: string = '';
    isDiff: boolean = false;
    hasPortal: boolean = false;
    showNewBot: boolean = true;

    showButton: boolean = true;
    buttonIcon: string = null;
    buttonHint: string = null;
    allowedTags: string[] = null;
    addedTags: string[] = null;

    private _focusEvent: FocusOnBotAction;
    private _simulation: BrowserSimulation;
    private _currentConfig: SheetPortalConfig;

    constructor() {
        super();
    }

    getBotTable() {
        return this.$refs.table as BotTable;
    }

    created() {
        appManager.whileLoggedIn((user, botManager) => {
            let subs: SubscriptionLike[] = [];
            this._simulation = appManager.simulationManager.primary;
            this.bots = [];

            subs.push(
                this._simulation.botPanel.botsUpdated.subscribe((e) => {
                    this.bots = e.bots;
                    this.isDiff = e.isDiff;
                    this.hasPortal = e.hasPortal;
                    this.dimension = e.dimension;
                    this.showNewBot = !e.isSingleBot;
                }),
                this._simulation.localEvents.subscribe((e) => {
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
                                        e.botId,
                                        e.tag,
                                        e.space,
                                        e.startIndex ?? 0,
                                        e.endIndex ?? e.startIndex ?? 0
                                    );
                                } else {
                                    table.selectBotAndTagByLineNumber(
                                        e.botId,
                                        e.tag,
                                        e.space,
                                        e.lineNumber ?? 1,
                                        e.columnNumber ?? 1
                                    );
                                }
                            } else {
                                this._focusEvent = e;
                                const tags: BotTags = {
                                    [SHEET_PORTAL]: e.botId,
                                };
                                this._simulation.helper.updateBot(
                                    this._simulation.helper.userBot,
                                    {
                                        tags: tags,
                                    }
                                );
                            }
                        }
                    }
                })
            );
            this._currentConfig = new SheetPortalConfig(
                SHEET_PORTAL,
                botManager
            );
            subs.push(
                this._currentConfig,
                this._currentConfig.onUpdated
                    .pipe(
                        tap(() => {
                            this._updateConfig();
                        })
                    )
                    .subscribe()
            );
            return subs;
        });
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot, tag);
    }

    async exitSheet() {
        if (this._currentConfig) {
            const result = await this._simulation.helper.shout(
                CLICK_ACTION_NAME,
                [this._currentConfig.configBot],
                onClickArg(null, this.dimension, null, 'mouse', null, null)
            );

            if (result.results.length <= 0) {
                this._exitSheet();
            }
        } else {
            this._exitSheet();
        }
    }

    private _exitSheet() {
        const gridPortal = this._simulation.helper.userBot.values.gridPortal;
        let tags: BotTags = {
            sheetPortal: null,
        };
        if (!hasValue(gridPortal)) {
            tags.gridPortal = this.dimension;
        }
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
    }

    async botClick(bot: Bot) {
        const result = await this._simulation.helper.shout(
            ON_SHEET_BOT_CLICK,
            null,
            {
                bot: bot,
            }
        );
        if (result.results.length <= 0) {
            this.exitSheet();
            this._simulation.helper.transaction(
                tweenTo(bot.id, { duration: 0 })
            );
        }
    }

    async botIDClick(id: string) {
        const result = await this._simulation.helper.shout(
            ON_SHEET_BOT_ID_CLICK,
            null,
            {
                bot: this._simulation.helper.botsState[id],
            }
        );
        if (result.results.length <= 0) {
            copyToClipboard(id);
            this._simulation.helper.transaction(toast('Copied!'));
        }
    }

    async goToTag(tag: string) {
        const result = await this._simulation.helper.shout(
            ON_SHEET_TAG_CLICK,
            null,
            {
                tag: tag,
            }
        );
        if (result.results.length <= 0) {
            this._simulation.helper.updateBot(this._simulation.helper.userBot, {
                tags: {
                    sheetPortal: tag,
                },
            });
        }
    }

    private _updateConfig() {
        if (this._currentConfig) {
            this.showButton = this._currentConfig.showButton;
            this.buttonIcon = this._currentConfig.buttonIcon;
            this.buttonHint = this._currentConfig.buttonHint;
            this.allowedTags = this._currentConfig.allowedTags;
            this.addedTags = this._currentConfig.addedTags;
        } else {
            this.showButton = true;
            this.buttonIcon = null;
            this.buttonHint = null;
            this.allowedTags = null;
            this.addedTags = null;
        }
    }

    onTableMounted() {
        const e = this._focusEvent;
        if (e) {
            const table = this.getBotTable();
            if (table) {
                this._focusEvent = null;
                if (hasValue(e.startIndex)) {
                    table.selectBotAndTag(
                        e.botId,
                        e.tag,
                        e.space,
                        e.startIndex ?? 0,
                        e.endIndex ?? e.startIndex ?? 0
                    );
                } else {
                    table.selectBotAndTagByLineNumber(
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
