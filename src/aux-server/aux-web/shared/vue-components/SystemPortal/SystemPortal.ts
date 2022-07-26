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
    SYSTEM_TAG_NAME,
    formatValue,
    DNA_TAG_PREFIX,
    BOT_LINK_TAG_PREFIX,
    SYSTEM_PORTAL_BOT,
    calculateBotValue,
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_TAG_SPACE,
    SYSTEM_TAG,
    calculateStringListTagValue,
    calculateStringTagValue,
    getShortId,
    createBotLink,
    SYSTEM_PORTAL_SEARCH,
    tagsOnBot,
    isScript,
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
    SystemPortalDiffArea,
    SystemPortalDiffBot,
    SystemPortalRecentsUpdate,
    SystemPortalRecentTag,
    SystemPortalSearchBot,
    SystemPortalSearchItem,
    SystemPortalSearchMatch,
    SystemPortalSearchTag,
} from '@casual-simulation/aux-vm-browser/managers/SystemPortalManager';
import SystemPortalTag from '../SystemPortalTag/SystemPortalTag';
import TagEditor from '../TagEditor/TagEditor';
import { EventBus, SvgIcon } from '@casual-simulation/aux-components';
import ConfirmDialogOptions from '../../ConfirmDialogOptions';
import BotID from '../BotID/BotID';
import { getModelUriFromId } from '../../MonacoUtils';
import type monaco from 'monaco-editor';

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
    diffItems: SystemPortalDiffArea[] = [];

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
    isFocusingTagsSearch: boolean = false;
    searchTagsValue: string = '';
    selectedPane: 'bots' | 'search' | 'diff' = 'bots';
    searchResults: SystemPortalSearchItem[] = [];
    numBotsInSearchResults: number = 0;
    numMatchesInSearchResults: number = 0;

    private _focusEditorOnSelectionUpdate: boolean = false;
    private _tagSelectionEvents: Map<
        string,
        {
            selectionStart: number;
            selectionEnd: number;
        }
    > = new Map();

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

    get searchTagsInput() {
        return this.$refs.searchTagsInput as HTMLInputElement;
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
            this.diffItems = [];
            this.tags = [];
            this.pinnedTags = [];
            this.recents = [];
            this.searchResults = [];
            this.numBotsInSearchResults = 0;
            this.numMatchesInSearchResults = 0;
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
            this.selectedPane = 'bots';
            this._tagSelectionEvents = new Map();

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
                this._simulation.systemPortal.onSearchResultsUpdated.subscribe(
                    (u) => {
                        this.searchResults = u.items;
                        this.numBotsInSearchResults = u.numBots;
                        this.numMatchesInSearchResults = u.numMatches;
                    }
                ),
                this._simulation.systemPortal.onDiffUpdated.subscribe((u) => {
                    if (u.hasPortal) {
                        this.selectedPane = 'diff';
                        this.diffItems = u.items;
                    } else {
                        this.diffItems = [];
                    }
                }),
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
                        if (this.isFocusingTagsSearch) {
                            const value = calculateBotValue(
                                null,
                                bot,
                                SYSTEM_PORTAL_SEARCH
                            );
                            this.searchTagsValue =
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
                this.showSearch();
            })
        );
    }

    showSearch() {
        this.selectedPane = 'search';
        this.$nextTick(() => {
            if (this.searchTagsInput) {
                this.searchTagsInput.focus();
            }
        });
    }

    showBots() {
        this.selectedPane = 'bots';
    }

    updateSearch(event: InputEvent) {
        const value = (event.target as HTMLInputElement).value;
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: {
                [SYSTEM_PORTAL_SEARCH]: value,
            },
        });
    }

    onFocusSearchTags() {
        this.isFocusingTagsSearch = true;
    }

    onUnfocusSearchTags() {
        this.isFocusingTagsSearch = false;
    }

    selectSearchMatch(
        bot: SystemPortalSearchBot,
        tag: SystemPortalSearchTag,
        match: SystemPortalSearchMatch
    ) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: createBotLink([bot.bot.id]),
            [SYSTEM_PORTAL_TAG]: tag.tag,
            [SYSTEM_PORTAL_TAG_SPACE]: tag.space ?? null,
        };
        const offset = tag.isScript
            ? 1
            : tag.isFormula
            ? DNA_TAG_PREFIX.length
            : tag.isLink
            ? BOT_LINK_TAG_PREFIX.length
            : 0;
        this._setTagSelection(
            bot.bot.id,
            tag.tag,
            tag.space,
            match.index - offset,
            match.endIndex - offset
        );

        if (
            tags[SYSTEM_PORTAL_BOT] !=
                this._simulation.helper.userBot.tags[SYSTEM_PORTAL_BOT] ||
            tags[SYSTEM_PORTAL_TAG] !=
                this._simulation.helper.userBot.tags[SYSTEM_PORTAL_TAG] ||
            tags[SYSTEM_PORTAL_TAG_SPACE] !=
                this._simulation.helper.userBot.tags[SYSTEM_PORTAL_TAG_SPACE]
        ) {
            this._simulation.helper.updateBot(this._simulation.helper.userBot, {
                tags: tags,
            });
        } else {
            this._focusEditor();
        }
    }

    onEditorModelChanged(event: monaco.editor.IModelChangedEvent) {
        if (event.newModelUrl) {
            const action = this._tagSelectionEvents.get(
                event.newModelUrl.toString()
            );
            if (action) {
                this._tagSelectionEvents.delete(event.newModelUrl.toString());
                this._changeEditorSelection(
                    event.newModelUrl.toString(),
                    action.selectionStart,
                    action.selectionEnd
                );
            }
        }
    }

    private _changeEditorSelection(
        modelUri: string,
        selectionStart: number,
        selectionEnd: number
    ): boolean {
        let editor = <TagValueEditor>this.$refs.multilineEditor;
        const monacoEditor = editor?.monacoEditor()?.editor;
        if (monacoEditor) {
            const model = monacoEditor.getModel();
            if (model && model.uri.toString() === modelUri) {
                setTimeout(() => {
                    const position = model.getPositionAt(selectionStart);
                    const endPosition = model.getPositionAt(selectionEnd);
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
                }, 100);
                return true;
            }
        }

        return false;
    }

    private _tagEditors() {
        return this.$refs.tagEditors as SystemPortalTag[];
    }

    private _pinnedTagEditors() {
        return this.$refs.pinnedTagEditors as SystemPortalTag[];
    }

    private _setTagSelection(
        botId: string,
        tag: string,
        space: string,
        start: number,
        end: number
    ) {
        const uri = getModelUriFromId(botId, tag, space).toString();
        if (!this._changeEditorSelection(uri, start, end)) {
            this._tagSelectionEvents.set(uri, {
                selectionStart: start,
                selectionEnd: end,
            });
        }
    }

    private _focusEditor() {
        this._focusEditorOnSelectionUpdate = false;
        this.$nextTick(() => {
            let editor = <TagValueEditor>this.$refs.multilineEditor;
            editor?.focusEditor();
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

    changeBotFilterValue(value: string) {
        if (this.isFocusingBotFilter) {
            this.botFilterValue = value;
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
        const systemTag = calculateStringTagValue(
            null,
            this._simulation.helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
        );
        return uniq(
            this.items
                .flatMap((i) => i.bots)
                .map((b) =>
                    calculateStringTagValue(null, b.bot, systemTag, null)
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
                onClickArg(null, null, null)
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
