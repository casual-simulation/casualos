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
import Vue from 'vue';
import Component from 'vue-class-component';
import type {
    Bot,
    BotTags,
    SystemPortalPane,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    toast,
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
    calculateStringTagValue,
    getShortId,
    createBotLink,
    SYSTEM_PORTAL_SEARCH,
    SYSTEM_PORTAL_DIFF_BOT,
    getBotTag,
    SYSTEM_PORTAL_DIFF_TAG,
    SYSTEM_PORTAL_DIFF_TAG_SPACE,
    SYSTEM_PORTAL_DIFF,
    getPortalTag,
    getTagValueForSpace,
    SYSTEM_PORTAL_PANE,
} from '@casual-simulation/aux-common';
import type {
    BrowserSimulation,
    SystemPortalBot,
    SystemPortalItem,
    SystemPortalSelectionTag,
    TagSortMode,
    BotManager,
} from '@casual-simulation/aux-vm-browser';
import { getSystemArea } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';
import { copyToClipboard } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { SystemPortalConfig } from './SystemPortalConfig';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import BotTag from '../BotTag/BotTag';
import { mapValues, uniq } from 'es-toolkit/compat';
// import Hotkey from '../Hotkey/Hotkey';
import { onFocusSearch } from './SystemPortalHelpers';
import MiniBot from '../MiniBot/MiniBot';
import type {
    SystemPortalDiffArea,
    SystemPortalDiffBot,
    SystemPortalDiffSelectionTag,
    SystemPortalRecentTag,
    SystemPortalSearchBot,
    SystemPortalSearchItem,
    SystemPortalSearchMatch,
    SystemPortalSearchTag,
} from '@casual-simulation/aux-vm-browser/managers/SystemPortalCoordinator';
import SystemPortalTag from '../SystemPortalTag/SystemPortalTag';
import SystemPortalDiffTag from '../SystemPortalDiffTag/SystemPortalDiffTag';
import TagEditor from '../TagEditor/TagEditor';
import { EventBus, SvgIcon } from '@casual-simulation/aux-components';
import ConfirmDialogOptions from '../../ConfirmDialogOptions';
import BotID from '../BotID/BotID';
import DiffStatus from '../DiffStatus/DiffStatus';
import HighlightedText from '../HighlightedText/HighlightedText';
import { getModelUriFromId } from '../../MonacoUtils';
import type monaco from '@casual-simulation/monaco-editor';
import { getActiveTheme } from '../utils';
import type { Simulation } from '@casual-simulation/aux-vm';
import { calculateIndexFromLocation } from '@casual-simulation/aux-runtime/runtime/TranspilerUtils';
import TagDiffEditor from '../TagDiffEditor/TagDiffEditor';
import SourceControl from '../SourceControl/SourceControl';
import SourceControlEditorPanel from '../SourceControl/components/EditorPanel/EditorPanel.vue';

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'tag-diff-editor': TagDiffEditor,
        'source-control-editor': SourceControlEditorPanel,
        'bot-tag': BotTag,
        'bot-id': BotID,
        // hotkey: Hotkey,
        'mini-bot': MiniBot,
        'system-portal-tag': SystemPortalTag,
        'system-portal-diff-tag': SystemPortalDiffTag,
        'tag-editor': TagEditor,
        'svg-icon': SvgIcon,
        'diff-status': DiffStatus,
        'highlighted-text': HighlightedText,
        'source-control': SourceControl,
    },
})
export default class SystemPortal extends Vue {
    items: SystemPortalItem[] = [];

    hasPortal: boolean = false;
    hasSheetPortal: boolean = false;
    hasSelection: boolean = false;

    tags: SystemPortalSelectionTag[] = [];
    pinnedTags: SystemPortalSelectionTag[] = [];
    selectedBotSimId: string = null;
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
    selectedPane: 'bots' | 'search' | 'diff' | 'sheet' | 'source' = 'bots';
    searchResults: SystemPortalSearchItem[] = [];
    numBotsInSearchResults: number = 0;
    numMatchesInSearchResults: number = 0;

    diffFilterValue: string = '';
    isFocusingDiffFilter: boolean = false;
    diffItems: SystemPortalDiffArea[] = [];
    hasDiffSelection: boolean = false;
    diffTags: SystemPortalDiffSelectionTag[] = [];
    diffOriginalBotSimId: string = null;
    diffOriginalBot: Bot = null;

    diffNewBotSimId: string = null;
    diffNewBot: Bot = null;
    diffSelectedTag: string = null;
    diffSelectedTagSpace: string = null;

    isSettingSheetPortal: boolean = false;
    sheetPortalValue: string = '';
    sliderDown: boolean;

    private _showQuickAccessAfterModelLoad: boolean = false;
    private _focusEditorOnSelectionUpdate: boolean = false;
    private _focusSearchInputAfterPanelUpdate: boolean = false;
    private _tagSelectionEvents: Map<
        string,
        {
            selectionStart: number;
            selectionEnd: number;
        }
    > = new Map();
    private _hasSheetPortalMap: Map<string, boolean> = new Map();

    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, Subscription>;
    private _currentConfig: SystemPortalConfig;

    get selectedBotId() {
        return this.selectedBot?.id;
    }

    get finalButtonIcon() {
        if (hasValue(this.buttonIcon)) {
            return this.buttonIcon;
        }
        return 'exit_to_app';
    }

    get finalButtonHint() {
        if (hasValue(this.buttonHint)) {
            return this.buttonHint;
        }
        return 'Exit to Grid Portal';
    }

    getActiveTheme() {
        return getActiveTheme();
    }

    getSearchTagsInput() {
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

    get sourceControlController() {
        return appManager.sourceControlController;
    }

    multilineEditor() {
        return this.$refs.multilineEditor as TagValueEditor;
    }

    constructor() {
        super();
    }

    created() {
        this._subs = [];
        this.items = [];
        this.diffItems = [];
        this.hasDiffSelection = false;
        this.diffTags = [];
        this.diffOriginalBotSimId = null;
        this.diffOriginalBot = null;
        this.diffNewBotSimId = null;
        this.diffNewBot = null;
        this.diffSelectedTag = null;
        this.diffSelectedTagSpace = null;
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
        this.hasSheetPortal = false;
        this.isSettingSheetPortal = false;
        this.sheetPortalValue = '';
        this.hasSelection = false;
        this.selectedBotSimId = null;
        this.selectedBot = null;
        this.selectedTag = null;
        this.selectedTagSpace = null;
        this.isViewingTags = true;
        this.tagsVisible = true;
        this.pinnedTagsVisible = true;
        this.selectedPane = 'bots';
        this.searchTagsValue = '';
        this._tagSelectionEvents = new Map();
        this._simulationSubs = new Map();
        this._hasSheetPortalMap = new Map();

        this._subs.push(
            appManager.systemPortal.onItemsUpdated.subscribe((e) => {
                this.hasPortal = e.hasPortal;
                if (e.hasPortal) {
                    this.items = e.items;
                } else {
                    this.items = [];
                }
            }),
            appManager.systemPortal.onSelectionUpdated.subscribe((e) => {
                this.hasSelection = e.hasSelection;
                if (e.hasSelection) {
                    this.sortMode = e.sortMode;
                    this.tags = e.tags;
                    this.pinnedTags = e.pinnedTags;
                    this.selectedBotSimId = e.simulationId;
                    this.selectedBot = e.bot;
                    this.selectedTag = e.tag;
                    this.selectedTagSpace = e.space ?? undefined;

                    for (let tag of [...e.tags, ...(e.pinnedTags ?? [])]) {
                        if (tag.focusValue) {
                            this._focusTag(tag);
                            break;
                        }
                    }
                } else {
                    this.tags = [];
                    this.pinnedTags = [];
                    this.selectedBotSimId = null;
                    this.selectedBot = null;
                    this.selectedTag = null;
                }

                if (this._focusEditorOnSelectionUpdate) {
                    this._focusEditor();
                }
            }),
            appManager.systemPortal.onRecentsUpdated.subscribe((e) => {
                if (e.hasRecents) {
                    this.recents = e.recentTags;
                }
            }),
            appManager.systemPortal.onSearchResultsUpdated.subscribe((u) => {
                this.searchResults = u.items;
                this.numBotsInSearchResults = u.numBots;
                this.numMatchesInSearchResults = u.numMatches;
            }),
            appManager.systemPortal.onDiffUpdated.subscribe((u) => {
                if (u.hasPortal) {
                    this.diffItems = u.items;
                } else {
                    this.diffItems = [];
                }
            }),
            appManager.systemPortal.onDiffSelectionUpdated.subscribe((u) => {
                this.hasDiffSelection = u.hasSelection;
                if (u.hasSelection) {
                    this.diffTags = u.tags;
                    this.diffOriginalBotSimId = u.originalBotSimulationId;
                    this.diffOriginalBot = u.originalBot;
                    this.diffNewBotSimId = u.newBotSimulationId;
                    this.diffNewBot = u.newBot;
                    this.diffSelectedTag = u.tag;
                    this.diffSelectedTagSpace = u.space ?? null;
                } else {
                    this.diffTags = [];
                    this.diffOriginalBotSimId = null;
                    this.diffOriginalBot = null;
                    this.diffNewBotSimId = null;
                    this.diffNewBot = null;
                    this.diffSelectedTag = null;
                    this.diffSelectedTagSpace = null;
                }
            }),
            appManager.systemPortal.onSystemPortalPaneUpdated.subscribe(
                (pane) => {
                    this.selectedPane = pane ?? 'bots';
                    if (this._focusSearchInputAfterPanelUpdate) {
                        this._focusSearchInputAfterPanelUpdate = false;
                        if (this.selectedPane === 'search') {
                            this._focusSearchInput();
                        }
                    }
                }
            )
        );

        this._subs.push(
            appManager.simulationManager.simulationAdded.subscribe((sim) => {
                this._onSimulationAdded(sim);
            })
        );

        this._subs.push(
            appManager.simulationManager.simulationRemoved.subscribe((sim) => {
                this._onSimulationRemoved(sim);
            })
        );

        this._subs.push(
            onFocusSearch.subscribe(() => {
                this.showSearch();
            })
        );
    }

    private _onSimulationAdded(sim: BotManager) {
        let sub = new Subscription();

        this._simulationSubs.set(sim, sub);

        if (sim.id === appManager.simulationManager.primaryId) {
            sub.add(
                sim.watcher.botChanged(sim.helper.userId).subscribe((bot) => {
                    if (!this.isFocusingBotFilter) {
                        const value = calculateBotValue(
                            null,
                            bot,
                            SYSTEM_PORTAL
                        );
                        this.botFilterValue =
                            typeof value === 'string' ? value : '';
                    }
                    if (!this.isFocusingTagsSearch) {
                        const value = getBotTag(bot, SYSTEM_PORTAL_SEARCH);
                        this.searchTagsValue =
                            typeof value === 'string' ? value : '';
                    }
                    if (!this.isFocusingDiffFilter) {
                        const value = calculateBotValue(
                            null,
                            bot,
                            SYSTEM_PORTAL_DIFF
                        );
                        this.diffFilterValue =
                            typeof value === 'string' ? value : '';
                    }
                })
            );
        }

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'focus_on') {
                    if (!hasValue(e.tag)) {
                        return;
                    }

                    if (hasValue(e.portal)) {
                        const targetPortal = getPortalTag(e.portal);
                        if (targetPortal !== 'systemPortal') {
                            return;
                        }
                    }

                    if (hasValue(e.startIndex)) {
                        this.selectBotAndTag(
                            sim,
                            e.botId,
                            e.tag,
                            e.space,
                            e.startIndex ?? 0,
                            e.endIndex ?? e.startIndex ?? 0
                        );
                    } else if (hasValue(e.lineNumber)) {
                        this.selectBotAndTagByLineNumber(
                            sim,
                            e.botId,
                            e.tag,
                            e.space,
                            e.lineNumber ?? 1,
                            e.columnNumber ?? 1,
                            true
                        );
                    } else {
                        this.selectBotAndTag(sim, e.botId, e.tag, e.space);
                    }
                }
            })
        );

        sub.add(
            sim.botPanel.botsUpdated.subscribe((e) => {
                this._hasSheetPortalMap.set(sim.id, e.hasPortal);
                this._updateHasSheetPortal();
            })
        );

        this._currentConfig = new SystemPortalConfig(SYSTEM_PORTAL, sim);
        sub.add(this._currentConfig);
        sub.add(
            this._currentConfig.onUpdated
                .pipe(
                    tap(() => {
                        this._updateConfig();
                    })
                )
                .subscribe()
        );
    }

    private _onSimulationRemoved(sim: BotManager) {
        const sub = this._simulationSubs.get(sim);

        if (sub) {
            sub.unsubscribe();
        }

        this._simulationSubs.delete(sim);
    }

    private _updateHasSheetPortal() {
        for (let [key, val] of this._hasSheetPortalMap) {
            if (val) {
                this.hasSheetPortal = true;
                return;
            }
        }

        this.hasSheetPortal = false;
    }

    showSearch() {
        this._selectPane('search');
        this._closeSheetPortal();
        this._saveSelectedTextForSearch();
        this._focusSearchInputAfterPanelUpdate = true;
        this._focusSearchInput();
    }

    showQuickAccess() {
        if (!this._runQuickAccessAction()) {
            if (!this.selectedBot) {
                const items = appManager.systemPortal.items;
                if (items.hasPortal && items.items.length > 0) {
                    const firstArea = items.items.find(
                        (a) => a.areas.length > 0 && a.areas[0].bots.length > 0
                    );
                    if (firstArea) {
                        const sim =
                            appManager.simulationManager.simulations.get(
                                firstArea.simulationId
                            );
                        const bot = firstArea.areas[0].bots[0];
                        if (sim && bot) {
                            this._showQuickAccessAfterModelLoad = true;
                            this.selectBotAndTag(
                                sim,
                                bot.bot.id,
                                'system',
                                null
                            );
                        }
                    }
                }
            }
        }
    }

    private _runQuickAccessAction() {
        const editor = <TagValueEditor>this.$refs.multilineEditor;
        const monacoEditor = editor?.monacoEditor()?.editor;
        if (monacoEditor) {
            monacoEditor.focus();
            setTimeout(() => {
                const action = monacoEditor.getAction(
                    'editor.action.quickOutline2'
                );
                action.run();
            }, 100);
            return true;
        }
        return false;
    }

    private _saveSelectedTextForSearch() {
        const el = document.activeElement;
        if (
            el &&
            (el instanceof HTMLInputElement ||
                el instanceof HTMLTextAreaElement)
        ) {
            const text = el.value
                .substring(el.selectionStart ?? 0, el.selectionEnd ?? 0)
                .trim();
            if (hasValue(text)) {
                this._updateSearchValue(text);
            }
        }
    }

    private _focusSearchInput() {
        this.$nextTick(() => {
            const input = this.getSearchTagsInput();
            if (input) {
                input.focus();
                input.setSelectionRange(0, input.value.length);
                this._focusSearchInputAfterPanelUpdate = false;
            }
        });
    }

    showBots() {
        this._selectPane('bots');
        this._closeSheetPortal();
    }

    showSheet() {
        this._selectPane('sheet');
        const sim = appManager.simulationManager.primary;
        const gridPortal = calculateBotValue(
            null,
            sim.helper.userBot,
            'gridPortal'
        );
        if (!hasValue(gridPortal) || this.hasSheetPortal) {
            this.isSettingSheetPortal = true;
            this.sheetPortalValue = '';
        } else {
            sim.helper.updateBot(sim.helper.userBot, {
                tags: {
                    [SHEET_PORTAL]: gridPortal,
                },
            });
        }
    }

    setSheetPortal() {
        this.isSettingSheetPortal = false;

        for (let [id, sim] of appManager.simulationManager.simulations) {
            sim.helper.updateBot(sim.helper.userBot, {
                tags: {
                    [SHEET_PORTAL]: this.sheetPortalValue,
                },
            });
        }
    }

    cancelSetSheetPortal() {
        this.isSettingSheetPortal = false;
    }

    showDiff() {
        this._selectPane('diff');
        this._closeSheetPortal();
    }

    showSource() {
        this._selectPane('source');
        this._closeSheetPortal();
    }

    private _selectPane(pane: SystemPortalPane) {
        for (let [id, sim] of appManager.simulationManager.simulations) {
            sim.helper.updateBot(sim.helper.userBot, {
                tags: {
                    [SYSTEM_PORTAL_PANE]: pane,
                },
            });
        }
    }

    private _closeSheetPortal() {
        if (this.hasSheetPortal) {
            for (let [id, sim] of appManager.simulationManager.simulations) {
                const sheetPortal = calculateBotValue(
                    null,
                    sim.helper.userBot,
                    SHEET_PORTAL
                );
                if (hasValue(sheetPortal)) {
                    sim.helper.updateBot(sim.helper.userBot, {
                        tags: {
                            [SHEET_PORTAL]: null,
                        },
                    });
                }
            }
        }
    }

    updateSearch(event: InputEvent) {
        const value = (event.target as HTMLInputElement).value;
        this._updateSearchValue(value);
    }

    private _updateSearchValue(value: string) {
        this.searchTagsValue = value;

        const sim = appManager.simulationManager.primary;
        sim.helper.updateBot(sim.helper.userBot, {
            tags: {
                [SYSTEM_PORTAL_SEARCH]: value,
            },
        });
    }

    onSliderPointerDown(event: PointerEvent) {
        event.preventDefault();
        event.stopPropagation();
        let target = event.target as HTMLElement;
        target.setPointerCapture(event.pointerId);
        this.sliderDown = true;
    }
    onSliderPointerMove(event: PointerEvent) {
        if (this.sliderDown) {
            event.preventDefault();
            event.stopPropagation();
            let areas = this.$refs.areas as HTMLElement;
            let rect = areas.getBoundingClientRect();
            areas.style.width = `${event.clientX - rect.left}px`;
        }
    }
    onSliderPointerUp(event: PointerEvent) {
        let target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);
        this.sliderDown = false;
    }
    onFocusSearchTags() {
        this.isFocusingTagsSearch = true;
    }

    onUnfocusSearchTags() {
        this.isFocusingTagsSearch = false;
    }

    getSearchTagMatches(tag: SystemPortalSearchTag) {
        return tag.matches.filter((m) => !m.isTagName);
    }

    getSearchTagHighlight(tag: SystemPortalSearchTag) {
        const firstMatch = tag.matches.find((m) => m.isTagName);

        if (firstMatch) {
            return {
                startIndex: firstMatch.highlightStartIndex,
                endIndex: firstMatch.highlightEndIndex,
            };
        }
        return null;
    }

    selectSearchTag(
        simulationId: string,
        bot: SystemPortalSearchBot,
        tag: SystemPortalSearchTag
    ) {
        const sim = appManager.simulationManager.simulations.get(simulationId);

        if (!sim) {
            return;
        }

        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: createBotLink([bot.bot.id]),
            [SYSTEM_PORTAL_TAG]: tag.tag,
            [SYSTEM_PORTAL_TAG_SPACE]: tag.space ?? null,
        };

        this._setTagSelection(bot.bot.id, tag.tag, tag.space, 0, 0);

        if (
            tags[SYSTEM_PORTAL_BOT] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_BOT] ||
            tags[SYSTEM_PORTAL_TAG] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_TAG] ||
            tags[SYSTEM_PORTAL_TAG_SPACE] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_TAG_SPACE]
        ) {
            this._setSimUserBotTags(simulationId, tags);
        } else {
            this._focusEditor();
        }
    }

    selectSearchMatch(
        simulationId: string,
        bot: SystemPortalSearchBot,
        tag: SystemPortalSearchTag,
        match: SystemPortalSearchMatch
    ) {
        const sim = appManager.simulationManager.simulations.get(simulationId);

        if (!sim) {
            return;
        }

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
                sim.helper.userBot.tags[SYSTEM_PORTAL_BOT] ||
            tags[SYSTEM_PORTAL_TAG] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_TAG] ||
            tags[SYSTEM_PORTAL_TAG_SPACE] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_TAG_SPACE]
        ) {
            this._setSimUserBotTags(simulationId, tags);
        } else {
            this._focusEditor();
        }
    }

    /**
     * Selects the given bot, tag, and space in the editor.
     * The selection will be set to the given line and column numbers.
     * @param sim The simulation.
     * @param botId The Id of the bot.
     * @param tag The tag that should be selected.
     * @param space The space of the tag.
     * @param lineNumber The line number. Should be one-based.
     * @param columnNumber The column number. Should be one-based.
     */
    selectBotAndTagByLineNumber(
        sim: BrowserSimulation,
        botId: string,
        tag: string,
        space: string,
        lineNumber: number,
        columnNumber: number,
        forceOpen?: boolean
    ) {
        const bot = sim.helper.botsState[botId];
        let tagValue = formatValue(getTagValueForSpace(bot, tag, space) ?? '');
        const prefix = sim.portals.getScriptPrefix(tagValue);
        if (prefix) {
            tagValue = tagValue.slice(prefix.length);
        }

        const index = calculateIndexFromLocation(tagValue, {
            lineNumber: lineNumber - 1,
            column: columnNumber - 1,
        });

        return this.selectBotAndTag(
            sim,
            botId,
            tag,
            space,
            index,
            index,
            forceOpen
        );
    }

    selectBotAndTag(
        sim: BrowserSimulation,
        botId: string,
        tag: string,
        space: string,
        startIndex: number = null,
        endIndex: number = null,
        forceOpen: boolean = false
    ) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: createBotLink([botId]),
            [SYSTEM_PORTAL_TAG]: tag,
            [SYSTEM_PORTAL_TAG_SPACE]: space ?? null,
            [SYSTEM_PORTAL_PANE]: 'bots',
            [SYSTEM_PORTAL_DIFF]: null,
            [SYSTEM_PORTAL_DIFF_BOT]: null,
            [SYSTEM_PORTAL_DIFF_TAG]: null,
            [SYSTEM_PORTAL_DIFF_TAG_SPACE]: null,
        };
        this._setTagSelection(botId, tag, space, startIndex, endIndex);

        if (
            tags[SYSTEM_PORTAL_BOT] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_BOT] ||
            tags[SYSTEM_PORTAL_TAG] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_TAG] ||
            tags[SYSTEM_PORTAL_TAG_SPACE] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_TAG_SPACE] ||
            tags[SYSTEM_PORTAL_PANE] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_PANE] ||
            tags[SYSTEM_PORTAL_DIFF] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_DIFF] ||
            tags[SYSTEM_PORTAL_DIFF_BOT] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_DIFF_BOT] ||
            tags[SYSTEM_PORTAL_DIFF_TAG] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_DIFF_TAG] ||
            tags[SYSTEM_PORTAL_DIFF_TAG_SPACE] !=
                sim.helper.userBot.tags[SYSTEM_PORTAL_DIFF_TAG_SPACE] ||
            (forceOpen && !this.hasPortal)
        ) {
            if (!this.hasPortal) {
                tags[SYSTEM_PORTAL] = true;
            }
            sim.helper.updateBot(sim.helper.userBot, {
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

            if (this._showQuickAccessAfterModelLoad) {
                this._showQuickAccessAfterModelLoad = false;
                this._runQuickAccessAction();
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
                    if (
                        typeof selectionStart === 'number' &&
                        typeof selectionEnd === 'number'
                    ) {
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
                    }
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

    isDiffBotSelected(bot: SystemPortalDiffBot) {
        return (
            bot.key === this.diffOriginalBot?.id ||
            bot.key === this.diffNewBot?.id
        );
    }

    isDiffTagSelected(tag: SystemPortalDiffSelectionTag) {
        return (
            this.diffSelectedTag === tag.name &&
            this.diffSelectedTagSpace === (tag.space ?? null)
        );
    }

    beforeDestroy() {
        for (let s of this._subs) {
            s.unsubscribe();
        }

        for (let [sim, sub] of this._simulationSubs) {
            sub.unsubscribe();
        }

        this._simulationSubs.clear();
    }

    selectDiff(bot: SystemPortalDiffBot) {
        const sim = appManager.simulationManager.primary;
        let tags: BotTags = {
            [SYSTEM_PORTAL_DIFF_BOT]: createBotLink([bot.key]),
        };
        sim.helper.updateBot(sim.helper.userBot, {
            tags: tags,
        });
    }

    selectBot(simulationId: string, bot: SystemPortalBot) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: createBotLink([bot.bot.id]),
        };
        this._setSimUserBotTags(simulationId, tags);
    }

    private _setSimUserBotTags(simulationId: string, tags: BotTags) {
        let nullTags = mapValues(tags, (o): null => null);
        for (let [id, sim] of appManager.simulationManager.simulations) {
            if (id === simulationId) {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: tags,
                });
            } else {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: nullTags,
                });
            }
        }
    }

    selectTag(tag: SystemPortalSelectionTag) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_TAG]: tag.name,
            [SYSTEM_PORTAL_TAG_SPACE]: tag.space ?? null,
        };
        this._setSimUserBotTags(this.selectedBotSimId, tags);
        // sim.helper.updateBot(sim.helper.userBot, {
        //     tags,
        // });
    }

    selectDiffTag(tag: SystemPortalDiffSelectionTag) {
        let tags: BotTags = {
            [SYSTEM_PORTAL_DIFF_TAG]: tag.name,
            [SYSTEM_PORTAL_DIFF_TAG_SPACE]: tag.space ?? null,
        };

        let nullTags = mapValues(tags, (o): null => null);
        for (let [id, sim] of appManager.simulationManager.simulations) {
            if (
                id === this.diffOriginalBotSimId ||
                id === this.diffNewBotSimId
            ) {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: tags,
                });
            } else {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: nullTags,
                });
            }
        }
    }

    closeTag(tag: SystemPortalSelectionTag) {
        appManager.systemPortal.removePinnedTag(tag);
    }

    selectRecentTag(recent: SystemPortalRecentTag) {
        this._focusEditorOnSelectionUpdate = true;

        // const sim = appManager.simulationManager.simulations.get(recent.simulationId);

        let tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: createBotLink([recent.botId]),
            [SYSTEM_PORTAL_TAG]: recent.tag,
            [SYSTEM_PORTAL_TAG_SPACE]: recent.space ?? null,
        };

        this._setSimUserBotTags(recent.simulationId, tags);
    }

    onTagFocusChanged(
        selectedBotSimId: string,
        tag: SystemPortalSelectionTag,
        focused: boolean
    ) {
        if (focused) {
            this.selectTag(tag);

            if (this.selectedBot && this.selectedTag) {
                const sim =
                    appManager.simulationManager.simulations.get(
                        selectedBotSimId
                    );
                sim.helper.setEditingBot(
                    this.selectedBot,
                    this.selectedTag,
                    this.selectedTagSpace
                );
            }
        }
    }

    onDiffTagFocusChanged(tag: SystemPortalDiffSelectionTag, focused: boolean) {
        if (focused) {
            this.selectDiffTag(tag);
        }
    }

    onEditorFocused(focused: boolean) {
        if (focused) {
            if (this.selectedBot && this.selectedTag) {
                const sim = appManager.simulationManager.simulations.get(
                    this.selectedBotSimId
                );
                sim.helper.setEditingBot(
                    this.selectedBot,
                    this.selectedTag,
                    this.selectedTagSpace
                );
            }
        }
    }

    onOriginalEditorFocused(focused: boolean) {
        if (focused) {
            if (this.diffOriginalBot && this.diffSelectedTag) {
                for (let [id, sim] of appManager.simulationManager
                    .simulations) {
                    if (id === this.diffOriginalBotSimId) {
                        sim.helper.setEditingBot(
                            this.diffOriginalBot,
                            this.diffSelectedTag,
                            this.diffSelectedTagSpace
                        );
                    } else {
                        sim.helper.setEditingBot(null, null, null);
                    }
                }
            }
        }
    }

    onModifiedEditorFocused(focused: boolean) {
        if (focused) {
            if (this.diffNewBot && this.diffSelectedTag) {
                for (let [id, sim] of appManager.simulationManager
                    .simulations) {
                    if (id === this.diffOriginalBotSimId) {
                        sim.helper.setEditingBot(
                            this.diffNewBot,
                            this.diffSelectedTag,
                            this.diffSelectedTagSpace
                        );
                    } else {
                        sim.helper.setEditingBot(null, null, null);
                    }
                }
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
            for (let [id, sim] of appManager.simulationManager.simulations) {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: {
                        [SYSTEM_PORTAL]: hasValue(this.botFilterValue)
                            ? this.botFilterValue
                            : true,
                    },
                });
            }
        }
    }

    onFocusDiffFilter() {
        this.isFocusingDiffFilter = true;
    }

    onUnfocusDiffFilter() {
        this.isFocusingDiffFilter = false;
    }

    changeDiffFilterValue(value: string) {
        if (this.isFocusingDiffFilter) {
            this.diffFilterValue = value;
            for (let [id, sim] of appManager.simulationManager.simulations) {
                sim.helper.updateBot(sim.helper.userBot, {
                    tags: {
                        [SYSTEM_PORTAL_DIFF]: hasValue(this.diffFilterValue)
                            ? this.diffFilterValue
                            : null,
                    },
                });
            }
        }
    }

    setSortMode(mode: TagSortMode) {
        appManager.systemPortal.tagSortMode = mode;
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

    getUserSystemTag() {
        const primarySim = appManager.simulationManager.primary;

        return calculateStringTagValue(
            null,
            primarySim.helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
        );
    }

    getBotSystems() {
        const primarySim = appManager.simulationManager.primary;

        const systemTag = calculateStringTagValue(
            null,
            primarySim.helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
        );
        return uniq(
            this.items
                .flatMap((i) => i.areas)
                .flatMap((a) => a.bots)
                .map((b) =>
                    calculateStringTagValue(null, b.bot, systemTag, null)
                )
                .filter((s) => hasValue(s))
                .map((s) => getSystemArea(s))
        );
    }

    getBotById(botId: string) {
        for (let item of this.items) {
            for (let area of item.areas) {
                for (let bot of area.bots) {
                    if (bot.bot.id === botId) {
                        return bot.bot;
                    }
                }
            }
        }
        return null;
    }

    getBotsBySystem(system: string, startsWith: boolean = true) {
        let bots: Bot[] = [];
        const systemTag = this.getUserSystemTag();
        const filter = startsWith
            ? (s: string) => s.startsWith(system)
            : (s: string) => s === system;
        for (let item of this.items) {
            for (let area of item.areas) {
                for (let bot of area.bots) {
                    if (
                        filter(
                            calculateStringTagValue(
                                null,
                                bot.bot,
                                systemTag,
                                null
                            )
                        )
                    ) {
                        bots.push(bot.bot);
                    }
                }
            }
        }
        return bots;
    }

    findBotsBySystemOrId(
        systemOrId: string,
        systemStartsWith: boolean = true
    ): Bot[] {
        let bots: Bot[] = [];
        const idLookup = this.getBotById(systemOrId);
        if (idLookup) {
            bots.push(idLookup);
        } else {
            bots.push(...this.getBotsBySystem(systemOrId, systemStartsWith));
        }
        return bots;
    }

    getShortId(bot: Bot) {
        return getShortId(bot);
    }

    copyId() {
        const id = this.selectedBotId;
        if (id) {
            copyToClipboard(id);
            const primarySim = appManager.simulationManager.primary;
            primarySim.helper.transaction(toast('Copied!'));
        }
    }

    toggleTags() {
        this.tagsVisible = !this.tagsVisible;
    }

    togglePinnedTags() {
        this.pinnedTagsVisible = !this.pinnedTagsVisible;
    }

    pinTag(tag: SystemPortalSelectionTag) {
        appManager.systemPortal.addPinnedTag(tag.name);
    }

    addTag() {
        // if (this.dropDownUsed) {
        //     return;
        // }

        if (this.isMakingNewTag) {
            appManager.systemPortal.addTag(this.newTag);
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

        const primarySim = appManager.simulationManager.primary;
        if (hasValue(this.newBotSystem)) {
            primarySim.helper.createBot(undefined, {
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

            const sim = appManager.simulationManager.simulations.get(
                this.selectedBotSimId
            );

            EventBus.$once(options.okEvent, () => {
                sim.helper.destroyBot(this.selectedBot);
            });
            EventBus.$once(options.cancelEvent, () => {
                EventBus.$off(options.okEvent);
            });
            EventBus.$emit('showConfirmDialog', options);
        }
    }

    async exitPortal() {
        if (this._currentConfig) {
            for (let [id, sim] of appManager.simulationManager.simulations) {
                const result = await sim.helper.shout(
                    CLICK_ACTION_NAME,
                    [this._currentConfig.configBot],
                    onClickArg(null, null, null, 'mouse', null, null, null)
                );
                if (result.results.length <= 0) {
                    this._exitPortal(sim);
                }
            }
        } else {
            for (let [id, sim] of appManager.simulationManager.simulations) {
                this._exitPortal(sim);
            }
        }
    }

    private _exitPortal(sim: BrowserSimulation) {
        let tags: BotTags = {
            [SYSTEM_PORTAL]: null,
            [SYSTEM_PORTAL_SEARCH]: null,
            [SYSTEM_PORTAL_PANE]: null,
            [SYSTEM_PORTAL_DIFF]: null,
        };
        if (this.hasSheetPortal) {
            tags[SHEET_PORTAL] = null;
        }
        sim.helper.updateBot(sim.helper.userBot, {
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
