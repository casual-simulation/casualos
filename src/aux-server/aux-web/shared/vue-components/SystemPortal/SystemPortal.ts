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
    SYSTEM_PORTAL,
    formatValue,
    DNA_TAG_PREFIX,
    SYSTEM_PORTAL_BOT,
    calculateBotValue,
} from '@casual-simulation/aux-common';
import {
    BrowserSimulation,
    SystemPortalBot,
    SystemPortalItem,
    SystemPortalSelectionTag,
    TagSortMode,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subject, SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { flatMap, tap } from 'rxjs/operators';
import { SystemPortalConfig } from './SystemPortalConfig';
import { IdeNode } from '@casual-simulation/aux-vm-browser';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import BotTag from '../BotTag/BotTag';
import { debounce } from 'lodash';
import { onMonacoLoaded } from '../../MonacoAsync';
import Hotkey from '../Hotkey/Hotkey';
import { onFocusSearch } from './SystemPortalHelpers';
import MiniBot from '../MiniBot/MiniBot';
import BotValue from '../BotValue/BotValue';
import {
    SystemPortalRecentsUpdate,
    SystemPortalRecentTag,
} from '@casual-simulation/aux-vm-browser/managers/SystemPortalManager';

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'bot-tag': BotTag,
        'bot-value': BotValue,
        hotkey: Hotkey,
        'mini-bot': MiniBot,
    },
})
export default class IdePortal extends Vue {
    items: SystemPortalItem[] = [];

    hasPortal: boolean = false;
    hasSelection: boolean = false;

    tags: SystemPortalSelectionTag[] = [];
    selectedBot: Bot = null;
    selectedTag: string = null;
    selectedTagSpace: string = null;

    recents: SystemPortalRecentTag[] = [];

    showButton: boolean = true;
    buttonIcon: string = null;
    buttonHint: string = null;

    isViewingTags: boolean = true;

    searchValue: string = '';
    isFocusingSearch: boolean = false;
    sortMode: TagSortMode = 'scripts-first';

    private _subs: SubscriptionLike[] = [];
    private _simulation: BrowserSimulation;
    private _currentConfig: SystemPortalConfig;

    get selectedBotId() {
        return this.selectedBot?.id;
    }

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
        // this.search = debounce(this.search.bind(this), 300);
        appManager.whileLoggedIn((user, botManager) => {
            let subs: SubscriptionLike[] = [];
            this._simulation = appManager.simulationManager.primary;
            this.items = [];
            this.tags = [];
            this.recents = [];
            this.hasPortal = false;
            this.hasSelection = false;
            this.selectedBot = null;
            this.selectedTag = null;
            this.selectedTagSpace = null;
            this.isViewingTags = true;

            subs.push(
                this._simulation.systemPortal.onItemsUpdated.subscribe((e) => {
                    this.hasPortal = e.hasPortal;
                    if (e.hasPortal) {
                        this.items = e.items;
                    } else {
                        this.items = [];
                    }
                }),
                this._simulation.systemPortal.onSelectionUpdated.subscribe(
                    (e) => {
                        this.hasSelection = e.hasSelection;
                        if (e.hasSelection) {
                            this.sortMode = e.sortMode;
                            this.tags = e.tags;
                            this.selectedBot = e.bot;
                        } else {
                            this.tags = [];
                            this.selectedBot = null;
                            this.selectedTag = null;
                        }
                    }
                ),
                this._simulation.systemPortal.onRecentsUpdated.subscribe(
                    (e) => {
                        if (e.hasRecents) {
                            this.recents = e.recentTags;
                        }
                    }
                ),
                this._simulation.watcher
                    .botChanged(this._simulation.helper.userId)
                    .subscribe((bot) => {
                        if (!this.isFocusingSearch) {
                            const value = calculateBotValue(
                                null,
                                bot,
                                SYSTEM_PORTAL
                            );
                            this.searchValue =
                                typeof value === 'string' ? value : '';
                        }
                    })
            );
            this._currentConfig = new SystemPortalConfig(
                SYSTEM_PORTAL,
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

        this._subs.push(
            onFocusSearch.subscribe(() => {
                // this.showSearch();
            })
        );
    }

    beforeDestroy() {
        for (let s of this._subs) {
            s.unsubscribe();
        }
    }

    selectBot(bot: SystemPortalBot) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: bot.bot.id,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
    }

    selectTag(tag: SystemPortalSelectionTag) {
        this.selectedTag = tag.name;
        this.selectedTagSpace = tag.space;
    }

    selectRecentTag(recent: SystemPortalRecentTag) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: recent.botId,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
        this.selectedTag = recent.tag;
        this.selectedTagSpace = recent.space ?? undefined;
    }

    onTagFocusChanged(tag: SystemPortalSelectionTag, focused: boolean) {
        if (focused) {
            this.selectTag(tag);

            if (this.selectedBot && this.selectedTag) {
                this._simulation.helper.setEditingBot(
                    this.selectedBot,
                    this.selectedTag,
                    this.selectedTagSpace
                );
            }
        }
    }

    onEditorFocused(focused: boolean) {
        if (focused) {
            if (this.selectedBot && this.selectedTag) {
                this._simulation.helper.setEditingBot(
                    this.selectedBot,
                    this.selectedTag,
                    this.selectedTagSpace
                );
            }
        }
    }

    onFocusSearch() {
        this.isFocusingSearch = true;
    }

    onUnfocusSearch() {
        this.isFocusingSearch = false;
    }

    changeSearchValue(value: string) {
        if (this.isFocusingSearch) {
            this.searchValue = value;
            this._simulation.helper.updateBot(this._simulation.helper.userBot, {
                tags: {
                    [SYSTEM_PORTAL]: hasValue(this.searchValue)
                        ? this.searchValue
                        : true,
                },
            });
        }
    }

    setSortMode(mode: TagSortMode) {
        this._simulation.systemPortal.tagSortMode = mode;
    }

    // showTags() {
    //     this.isViewingTags = true;
    // }

    // async showSearch() {
    //     this.isViewingTags = false;
    //     await this.$nextTick();
    //     if (this.searchInput) {
    //         this.searchInput.focus();
    //         this.searchInput.select();
    //     }
    // }

    // updateSearch(event: InputEvent) {
    //     this.search();
    // }

    // search() {
    //     const searchText = this.searchInput?.value;

    //     if (searchText) {
    //         let nextItems = [] as SearchItem[];

    //         for (let node of this.items) {
    //             const bot = this._simulation.helper.botsState[node.botId];
    //             const value = formatValue(bot.tags[node.tag]);

    //             let i = 0;
    //             while (i < value.length) {
    //                 const match = value.indexOf(searchText, i);

    //                 if (match >= 0) {
    //                     i = match + searchText.length;

    //                     let lineStart = match;
    //                     let distance = 0;
    //                     const maxSearchDistance = 40;
    //                     for (
    //                         ;
    //                         lineStart > 0 && distance <= maxSearchDistance;
    //                         lineStart -= 1
    //                     ) {
    //                         const char = value[lineStart];
    //                         if (char === '\n') {
    //                             lineStart += 1;
    //                             break;
    //                         } else if (char !== ' ' && char !== '\t') {
    //                             distance += 1;
    //                         }
    //                     }

    //                     let lineEnd = match + searchText.length;
    //                     for (
    //                         ;
    //                         lineEnd < value.length &&
    //                         distance <= maxSearchDistance;
    //                         lineEnd += 1
    //                     ) {
    //                         const char = value[lineEnd];
    //                         if (char === '\n') {
    //                             lineEnd -= 1;
    //                             break;
    //                         } else if (char !== ' ' && char !== '\t') {
    //                             distance += 1;
    //                         }
    //                     }

    //                     const line = value.substring(lineStart, lineEnd);

    //                     nextItems.push({
    //                         key: `${node.key}@${match}`,
    //                         botId: node.botId,
    //                         tag: node.tag,
    //                         index: match,
    //                         endIndex: match + searchText.length,
    //                         text: line,
    //                         isScript: node.isScript,
    //                         isFormula: node.isFormula,
    //                         prefix: node.prefix,
    //                     });
    //                 } else {
    //                     break;
    //                 }
    //             }
    //         }

    //         this.searchItems = nextItems;
    //     } else {
    //         this.searchItems = [];
    //     }
    // }

    // async selectSearchItem(item: SearchItem) {
    //     this.currentBot = this._simulation.helper.botsState[item.botId];
    //     this.currentTag = item.tag;
    //     this.currentSpace = null;

    //     const _this = this;
    //     await onMonacoLoaded;
    //     await this.$nextTick();

    //     const monacoEditor = _this.multilineEditor()?.monacoEditor()?.editor;
    //     let loaded = false;
    //     if (monacoEditor) {
    //         const model = monacoEditor.getModel();
    //         if (model) {
    //             const uri = model.uri.toString();
    //             // TODO: implement better check for ensuring the loaded model
    //             // is for the given item
    //             if (
    //                 uri.indexOf(item.botId) >= 0 &&
    //                 uri.indexOf(item.tag) >= 0
    //             ) {
    //                 const offset = item.isScript
    //                     ? 1
    //                     : item.isFormula
    //                     ? DNA_TAG_PREFIX.length
    //                     : item.prefix
    //                     ? item.prefix.length
    //                     : 0;
    //                 const position = model.getPositionAt(item.index - offset);
    //                 const endPosition = model.getPositionAt(
    //                     item.endIndex - offset
    //                 );
    //                 monacoEditor.setSelection({
    //                     startLineNumber: position.lineNumber,
    //                     startColumn: position.column,
    //                     endLineNumber: endPosition.lineNumber,
    //                     endColumn: endPosition.column,
    //                 });
    //                 monacoEditor.revealLinesInCenter(
    //                     position.lineNumber,
    //                     endPosition.lineNumber,
    //                     1 /* Immediate scrolling */
    //                 );
    //                 monacoEditor.focus();
    //             }
    //         }
    //         loaded = true;
    //     }

    //     // TODO: implement better way to wait for the editor the be fully loaded.
    //     if (!loaded) {
    //         setTimeout(() => {
    //             this.selectSearchItem(item);
    //         }, 100);
    //     }
    // }

    // selectItem(item: IdeTagNode) {
    //     if (item.type === 'tag') {
    //         this.selectedItem = item;
    //         this.currentBot = this._simulation.helper.botsState[item.botId];
    //         this.currentTag = item.tag;
    //         this.currentSpace = null;
    //     }
    // }

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
            [SYSTEM_PORTAL]: null,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
    }

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
