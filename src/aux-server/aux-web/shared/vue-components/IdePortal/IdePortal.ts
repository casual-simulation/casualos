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
    IDE_PORTAL,
    formatValue,
    DNA_TAG_PREFIX,
} from '@casual-simulation/aux-common';
import {
    BrowserSimulation,
    IdeTagNode,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subject, SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { flatMap, tap } from 'rxjs/operators';
import { IdePortalConfig } from './IdePortalConfig';
import { IdeNode } from '@casual-simulation/aux-vm-browser';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import BotTag from '../BotTag/BotTag';
import { debounce } from 'lodash';
import { onMonacoLoaded } from '../../MonacoAsync';
import Hotkey from '../Hotkey/Hotkey';
import { onFocusSearch } from './IdePortalHelpers';

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'bot-tag': BotTag,
        hotkey: Hotkey,
    },
})
export default class IdePortal extends Vue {
    items: IdeTagNode[] = [];
    hasPortal: boolean = false;

    showButton: boolean = true;
    buttonIcon: string = null;
    buttonHint: string = null;

    currentBot: Bot = null;
    currentTag: string = null;
    currentSpace: string = null;
    selectedItem: IdeNode = null;
    searchItems: SearchItem[] = [];

    isViewingTags: boolean = true;

    private _subs: SubscriptionLike[] = [];

    private _simulation: BrowserSimulation;
    private _currentConfig: IdePortalConfig;

    get finalButtonIcon() {
        if (hasValue(this.buttonIcon)) {
            return this.buttonIcon;
        }
        return 'web_asset';
    }

    get finalButtonHint() {
        if (hasValue(this.buttonHint)) {
            return this.buttonHint;
        }
        return 'Grid Portal';
    }

    get searchInput() {
        return this.$refs.searchInput as HTMLInputElement;
    }

    multilineEditor() {
        return this.$refs.multilineEditor as TagValueEditor;
    }

    constructor() {
        super();
    }

    created() {
        this._subs = [];
        this.search = debounce(this.search.bind(this), 300);
        appManager.whileLoggedIn((user, botManager) => {
            let subs: SubscriptionLike[] = [];
            this._simulation = appManager.simulationManager.primary;
            this.items = [];
            this.searchItems = [];
            this.hasPortal = false;
            this.currentBot = null;
            this.currentTag = null;
            this.currentSpace = null;
            this.selectedItem = null;
            this.isViewingTags = true;

            subs.push(
                this._simulation.idePortal.itemsUpdated.subscribe((e) => {
                    this.items = e.items;
                    this.hasPortal = e.hasPortal;
                }),
                this._simulation.localEvents.subscribe((e) => {
                    if (e.type === 'go_to_tag') {
                        const targetBot =
                            this._simulation.helper.botsState[e.botId];
                        if (targetBot) {
                            this.currentBot = targetBot;
                            this.currentTag = e.tag;
                            this.currentSpace = e.space;
                            this.selectedItem =
                                this.items.find(
                                    (i) =>
                                        i.botId === e.botId && i.tag === e.tag
                                ) ?? this.selectedItem;
                        }
                    }
                })
            );
            this._currentConfig = new IdePortalConfig(IDE_PORTAL, botManager);
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

        this._subs.push(
            onFocusSearch.subscribe(() => {
                this.showSearch();
            })
        );
    }

    beforeDestroy() {
        for (let s of this._subs) {
            s.unsubscribe();
        }
    }

    showTags() {
        this.isViewingTags = true;
    }

    async showSearch() {
        this.isViewingTags = false;
        await this.$nextTick();
        if (this.searchInput) {
            this.searchInput.focus();
            this.searchInput.select();
        }
    }

    updateSearch(event: InputEvent) {
        this.search();
    }

    search() {
        const searchText = this.searchInput?.value;

        if (searchText) {
            let nextItems = [] as SearchItem[];

            for (let node of this.items) {
                const bot = this._simulation.helper.botsState[node.botId];
                const value = formatValue(bot.tags[node.tag]);

                let i = 0;
                while (i < value.length) {
                    const match = value.indexOf(searchText, i);

                    if (match >= 0) {
                        i = match + searchText.length;

                        let lineStart = match;
                        let distance = 0;
                        const maxSearchDistance = 40;
                        for (
                            ;
                            lineStart > 0 && distance <= maxSearchDistance;
                            lineStart -= 1
                        ) {
                            const char = value[lineStart];
                            if (char === '\n') {
                                lineStart += 1;
                                break;
                            } else if (char !== ' ' && char !== '\t') {
                                distance += 1;
                            }
                        }

                        let lineEnd = match + searchText.length;
                        for (
                            ;
                            lineEnd < value.length &&
                            distance <= maxSearchDistance;
                            lineEnd += 1
                        ) {
                            const char = value[lineEnd];
                            if (char === '\n') {
                                lineEnd -= 1;
                                break;
                            } else if (char !== ' ' && char !== '\t') {
                                distance += 1;
                            }
                        }

                        const line = value.substring(lineStart, lineEnd);

                        nextItems.push({
                            key: `${node.key}@${match}`,
                            botId: node.botId,
                            tag: node.tag,
                            index: match,
                            endIndex: match + searchText.length,
                            text: line,
                            isScript: node.isScript,
                            isFormula: node.isFormula,
                            prefix: node.prefix,
                        });
                    } else {
                        break;
                    }
                }
            }

            this.searchItems = nextItems;
        } else {
            this.searchItems = [];
        }
    }

    async selectSearchItem(item: SearchItem) {
        this.currentBot = this._simulation.helper.botsState[item.botId];
        this.currentTag = item.tag;
        this.currentSpace = null;

        const _this = this;
        await onMonacoLoaded;
        await this.$nextTick();

        const monacoEditor = _this.multilineEditor()?.monacoEditor()?.editor;
        let loaded = false;
        if (monacoEditor) {
            const model = monacoEditor.getModel();
            if (model) {
                const uri = model.uri.toString();
                // TODO: implement better check for ensuring the loaded model
                // is for the given item
                if (
                    uri.indexOf(item.botId) >= 0 &&
                    uri.indexOf(item.tag) >= 0
                ) {
                    const offset = item.isScript
                        ? 1
                        : item.isFormula
                        ? DNA_TAG_PREFIX.length
                        : item.prefix
                        ? item.prefix.length
                        : 0;
                    const position = model.getPositionAt(item.index - offset);
                    const endPosition = model.getPositionAt(
                        item.endIndex - offset
                    );
                    monacoEditor.setSelection({
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: endPosition.lineNumber,
                        endColumn: endPosition.column,
                    });
                    monacoEditor.revealLinesInCenter(
                        position.lineNumber,
                        endPosition.lineNumber,
                        1 /* Immediate scrolling */
                    );
                    monacoEditor.focus();
                }
            }
            loaded = true;
        }

        // TODO: implement better way to wait for the editor the be fully loaded.
        if (!loaded) {
            setTimeout(() => {
                this.selectSearchItem(item);
            }, 100);
        }
    }

    selectItem(item: IdeTagNode) {
        if (item.type === 'tag') {
            this.selectedItem = item;
            this.currentBot = this._simulation.helper.botsState[item.botId];
            this.currentTag = item.tag;
            this.currentSpace = null;
        }
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot, tag);
    }

    async exitPortal() {
        if (this._currentConfig) {
            const result = await this._simulation.helper.shout(
                CLICK_ACTION_NAME,
                [this._currentConfig.configBot],
                onClickArg(null, null)
            );

            if (result.results.length <= 0) {
                this._exitPortal();
            }
        } else {
            this._exitPortal();
        }
    }

    private _exitPortal() {
        let tags: BotTags = {
            idePortal: null,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
    }

    // async botClick(bot: Bot) {
    //     const result = await this._simulation.helper.shout(
    //         ON_SHEET_BOT_CLICK,
    //         null,
    //         {
    //             bot: bot,
    //         }
    //     );
    //     if (result.results.length <= 0) {
    //         this.exitSheet();
    //         this._simulation.helper.transaction(
    //             tweenTo(bot.id, undefined, undefined, undefined, 0)
    //         );
    //     }
    // }

    // async botIDClick(id: string) {
    //     const result = await this._simulation.helper.shout(
    //         ON_SHEET_BOT_ID_CLICK,
    //         null,
    //         {
    //             bot: this._simulation.helper.botsState[id],
    //         }
    //     );
    //     if (result.results.length <= 0) {
    //         copyToClipboard(id);
    //         this._simulation.helper.transaction(toast('Copied!'));
    //     }
    // }

    // async goToTag(tag: string) {
    //     const result = await this._simulation.helper.shout(
    //         ON_SHEET_TAG_CLICK,
    //         null,
    //         {
    //             tag: tag,
    //         }
    //     );
    //     if (result.results.length <= 0) {
    //         this._simulation.helper.updateBot(this._simulation.helper.userBot, {
    //             tags: {
    //                 sheetPortal: tag,
    //             },
    //         });
    //     }
    // }

    private _updateConfig() {
        if (this._currentConfig) {
            this.showButton = this._currentConfig.showButton;
            this.buttonIcon = this._currentConfig.buttonIcon;
            this.buttonHint = this._currentConfig.buttonHint;
        } else {
            this.showButton = true;
            this.buttonIcon = null;
            this.buttonHint = null;
        }
    }
}

interface SearchItem {
    key: string;
    tag: string;
    botId: string;
    index: number;
    endIndex: number;
    text: string;

    isScript?: boolean;
    isFormula?: boolean;
    prefix?: string;
}
