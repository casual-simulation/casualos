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
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_TAG_SPACE,
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
import SystemPortalTag from '../SystemPortalTag/SystemPortalTag';
import TagEditor from '../TagEditor/TagEditor';

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'bot-tag': BotTag,
        'bot-value': BotValue,
        hotkey: Hotkey,
        'mini-bot': MiniBot,
        'system-portal-tag': SystemPortalTag,
        'tag-editor': TagEditor,
    },
})
export default class SystemPortal extends Vue {
    items: SystemPortalItem[] = [];

    hasPortal: boolean = false;
    hasSelection: boolean = false;

    tags: SystemPortalSelectionTag[] = [];
    pinnedTags: SystemPortalSelectionTag[] = [];
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
    isMakingNewTag: boolean = false;
    newTag: string = '';

    private _focusEditorOnSelectionUpdate: boolean = false;
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
            this.pinnedTags = [];
            this.recents = [];
            this.isMakingNewTag = false;
            this.newTag = '';
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
                            this.pinnedTags = e.pinnedTags;
                            this.selectedBot = e.bot;
                            this.selectedTag = e.tag;
                            this.selectedTagSpace = e.space ?? undefined;

                            for (let tag of [
                                ...e.tags,
                                ...(e.pinnedTags ?? []),
                            ]) {
                                if (tag.focusValue) {
                                    this._focusTag(tag);
                                    break;
                                }
                            }
                        } else {
                            this.tags = [];
                            this.pinnedTags = [];
                            this.selectedBot = null;
                            this.selectedTag = null;
                        }

                        if (this._focusEditorOnSelectionUpdate) {
                            this._focusEditor();
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

    private _tagEditors() {
        return this.$refs.tagEditors as SystemPortalTag[];
    }

    private _pinnedTagEditors() {
        return this.$refs.pinnedTagEditors as SystemPortalTag[];
    }

    private _focusEditor() {
        this._focusEditorOnSelectionUpdate = false;
        this.$nextTick(() => {
            (<TagValueEditor>this.$refs.multilineEditor)?.focusEditor();
        });
    }

    private _focusTag(tag: SystemPortalSelectionTag) {
        this.$nextTick(() => {
            this._focusEditorOnSelectionUpdate = true;
            this.selectTag(tag);
        });
    }

    isTagSelected(tag: SystemPortalSelectionTag | SystemPortalRecentTag) {
        if ('name' in tag) {
            return (
                this.selectedTag === tag.name &&
                this.selectedTagSpace === tag.space
            );
        } else {
            return (
                tag.botId === this.selectedBotId &&
                tag.tag === this.selectedTag &&
                tag.space == this.selectedTagSpace
            );
        }
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
        let tags: BotTags = {
            [SYSTEM_PORTAL_TAG]: tag.name,
            [SYSTEM_PORTAL_TAG_SPACE]: tag.space ?? null,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags,
        });
        // this.selectedTag = tag.name;
        // this.selectedTagSpace = tag.space;
    }

    closeTag(tag: SystemPortalSelectionTag) {
        this._simulation.systemPortal.removePinnedTag(tag);
    }

    selectRecentTag(recent: SystemPortalRecentTag) {
        this._focusEditorOnSelectionUpdate = true;
        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: recent.botId,
            [SYSTEM_PORTAL_TAG]: recent.tag,
            [SYSTEM_PORTAL_TAG_SPACE]: recent.space ?? null,
        };
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
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

    openNewTag() {
        this.isMakingNewTag = true;
        this.newTag = '';
    }

    cancelNewTag() {
        this.isMakingNewTag = false;
    }

    addTag() {
        // if (this.dropDownUsed) {
        //     return;
        // }

        if (this.isMakingNewTag) {
            this._simulation.systemPortal.addPinnedTag(this.newTag);
            this.newTag = '';
            this.isMakingNewTag = false;
            // const { tag, isScript } = this._formatNewTag(this.newTag);
            // this.newTag = tag;

            // this.dropDownUsed = true;
            // this.newTagOpen = true;

            // this.$nextTick(() => {
            //     this.$nextTick(() => {
            //         this.dropDownUsed = false;
            //         this.isMakingNewTag = false;
            //         this.newTag = '';
            //         this.newTagOpen = false;
            //     });
            // });

            // // Check to make sure that the tag is unique.
            // if (this.tagExists(this.newTag)) {
            //     var options = new AlertDialogOptions();
            //     options.title = 'Tag already exists';
            //     options.body =
            //         "Tag '" + this.newTag + "' already exists on this bot.";
            //     options.confirmText = 'Close';

            //     // Emit dialog event.
            //     EventBus.$emit('showAlertDialog', options);
            //     return;
            // }

            // if (!this.tagNotEmpty(this.newTag)) {
            //     var options = new AlertDialogOptions();
            //     options.title = 'Tag cannot be empty';
            //     options.body = 'Tag is empty or contains only whitespace......';
            //     options.confirmText = 'Close';

            //     // Emit dialog event.
            //     EventBus.$emit('showAlertDialog', options);
            //     return;
            // }

            // this.wasLastEmpty = this.isEmptyDiff();
            // if (this.isEmptyDiff()) {
            //     this.lastTag = this.newTag;
            // }

            // if (this.newTagPlacement === 'top') {
            //     this.addedTags.unshift(this.newTag);
            //     this.tags.unshift({ tag: this.newTag, space: null });
            // } else {
            //     this.addedTags.push(this.newTag);
            //     this.tags.push({ tag: this.newTag, space: null });
            // }

            // const addedTag = this.newTag;

            // this._updateTags();
            // this.$nextTick(() => {
            //     const tags = this.$refs.tagValues as BotValue[];
            //     for (let tag of tags) {
            //         if (tag.tag === addedTag) {
            //             tag.focus();
            //             // This is a super hacky way to pre-fill the first bot's tag with an @ symbol
            //             if (isScript) {
            //                 tag.setInitialValue('@');
            //             }
            //             break;
            //         }
            //     }
            // });
        } else {
            this.newTag = '';
        }
    }

    hasTag() {
        return this.tags.length > 0 || this.pinnedTags.length > 0;
    }

    getFirstTag(): string {
        if (this.tags.length > 0) {
            return this.tags[0].name;
        } else if (this.pinnedTags.length > 0) {
            return this.pinnedTags[0].name;
        }
        return null;
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
