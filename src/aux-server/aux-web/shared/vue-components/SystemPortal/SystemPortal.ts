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
    SYSTEM_TAG,
    calculateStringListTagValue,
    calculateStringTagValue,
    getShortId,
    createBotLink,
} from '@casual-simulation/aux-common';
import {
    BrowserSimulation,
    SystemPortalBot,
    SystemPortalItem,
    SystemPortalSelectionTag,
    TagSortMode,
    userBotChanged,
    getSystemArea,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subject, SubscriptionLike } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { flatMap, tap } from 'rxjs/operators';
import { SystemPortalConfig } from './SystemPortalConfig';
import { IdeNode } from '@casual-simulation/aux-vm-browser';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import BotTag from '../BotTag/BotTag';
import { debounce, uniq } from 'lodash';
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
import { EventBus, SvgIcon } from '@casual-simulation/aux-components';
import ConfirmDialogOptions from '../../ConfirmDialogOptions';
import BotID from '../BotID/BotID';

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'bot-tag': BotTag,
        'bot-value': BotValue,
        'bot-id': BotID,
        hotkey: Hotkey,
        'mini-bot': MiniBot,
        'system-portal-tag': SystemPortalTag,
        'tag-editor': TagEditor,
        'svg-icon': SvgIcon,
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

    botFilterValue: string = '';
    isFocusingBotFilter: boolean = false;
    sortMode: TagSortMode = 'scripts-first';
    isMakingNewTag: boolean = false;
    newTag: string = '';
    isMakingNewBot: boolean = false;
    newBotSystem: string = '';
    tagsVisible: boolean = true;
    pinnedTagsVisible: boolean = true;
    searchTagsVisible: boolean = false;

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

    get tagsToShow() {
        if (this.pinnedTagsVisible) {
            return this.tags.filter((t) => {
                return (
                    !this.pinnedTags ||
                    !this.pinnedTags.some(
                        (p) => p.name === t.name && p.space === t.space
                    )
                );
            });
        } else {
            return this.tags;
        }
    }

    multilineEditor() {
        return this.$refs.multilineEditor as TagValueEditor;
    }

    toggleSearchTags() {
        this.searchTagsVisible = !this.searchTagsVisible;
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
            this.isMakingNewBot = false;
            this.newBotSystem = '';
            this.hasPortal = false;
            this.hasSelection = false;
            this.selectedBot = null;
            this.selectedTag = null;
            this.selectedTagSpace = null;
            this.isViewingTags = true;
            this.tagsVisible = true;
            this.pinnedTagsVisible = true;

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
                        if (!this.isFocusingBotFilter) {
                            const value = calculateBotValue(
                                null,
                                bot,
                                SYSTEM_PORTAL
                            );
                            this.botFilterValue =
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
            [SYSTEM_PORTAL_BOT]: createBotLink([bot.bot.id]),
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
            [SYSTEM_PORTAL_BOT]: createBotLink([recent.botId]),
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

    onFocusBotFilter() {
        this.isFocusingBotFilter = true;
    }

    onUnfocusBotFilter() {
        this.isFocusingBotFilter = false;
    }

    changeBotFilterValue(event: InputEvent) {
        if (this.isFocusingBotFilter) {
            this.botFilterValue = (event.target as HTMLInputElement).value;
            this._simulation.helper.updateBot(this._simulation.helper.userBot, {
                tags: {
                    [SYSTEM_PORTAL]: hasValue(this.botFilterValue)
                        ? this.botFilterValue
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

    openNewBot() {
        this.isMakingNewBot = true;
        this.newBotSystem = hasValue(this.botFilterValue)
            ? this.botFilterValue
            : '';
    }

    cancelNewBot() {
        this.isMakingNewBot = false;
    }

    getBotSystems() {
        return uniq(
            this.items
                .flatMap((i) => i.bots)
                .map((b) =>
                    calculateStringTagValue(null, b.bot, SYSTEM_TAG, null)
                )
                .filter((s) => hasValue(s))
                .map((s) => getSystemArea(s))
        );
    }

    getShortId(bot: Bot) {
        return getShortId(bot);
    }

    copyId() {
        const id = this.selectedBotId;
        if (id) {
            copyToClipboard(id);
            this._simulation.helper.transaction(toast('Copied!'));
        }
    }

    toggleTags() {
        this.tagsVisible = !this.tagsVisible;
    }

    togglePinnedTags() {
        this.pinnedTagsVisible = !this.pinnedTagsVisible;
    }

    pinTag(tag: SystemPortalSelectionTag) {
        this._simulation.systemPortal.addPinnedTag(tag.name);
    }

    addTag() {
        // if (this.dropDownUsed) {
        //     return;
        // }

        if (this.isMakingNewTag) {
            this._simulation.systemPortal.addPinnedTag(this.newTag);
            this.newTag = '';
            this.isMakingNewTag = false;
        } else {
            this.newTag = '';
        }
    }

    addBot() {
        if (!this.isMakingNewBot) {
            this.newBotSystem = '';
            return;
        }

        if (hasValue(this.newBotSystem)) {
            this._simulation.helper.createBot(undefined, {
                [SYSTEM_TAG]: this.newBotSystem,
            });
        }

        this.newBotSystem = '';
        this.isMakingNewBot = false;
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

    deleteSelectedBot() {
        if (this.selectedBot) {
            const options = new ConfirmDialogOptions();
            options.title = 'Destroy bot?';

            const systemTag = calculateStringTagValue(
                null,
                this.selectedBot,
                SYSTEM_TAG,
                null
            );
            options.body = `Are you sure you want to destroy ${systemTag} (${this.selectedBotId})?`;
            options.okText = 'Destroy';
            options.cancelText = 'Keep';

            EventBus.$once(options.okEvent, () => {
                this._simulation.helper.destroyBot(this.selectedBot);
            });
            EventBus.$once(options.cancelEvent, () => {
                EventBus.$off(options.okEvent);
            });
            EventBus.$emit('showConfirmDialog', options);
        }
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
