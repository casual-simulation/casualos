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
    calculateFormattedBotValue,
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
    MAP_PORTAL,
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
import { copyToClipboard, navigateToUrl } from '../../SharedUtils';
import { tap } from 'rxjs/operators';
import { SystemPortalConfig } from './SystemPortalConfig';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import BotTag from '../BotTag/BotTag';
import { mapValues, uniq } from 'es-toolkit/compat';
// import Hotkey from '../Hotkey/Hotkey';
import { onFocusSearch } from './SystemPortalHelpers';
import type {
    SystemPortalDiffArea,
    SystemPortalDiffBot,
    SystemPortalDiffSelectionTag,
    SystemPortalRecentTag,
    SystemPortalSearchBot,
    SystemPortalSearchItem,
    SystemPortalSearchMatch,
    SystemPortalSearchTag,
    SystemPortalSelectionUpdate,
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

@Component({
    components: {
        'tag-value-editor': TagValueEditor,
        'tag-diff-editor': TagDiffEditor,
        'bot-tag': BotTag,
        'bot-id': BotID,
        // hotkey: Hotkey,
        'system-portal-tag': SystemPortalTag,
        'system-portal-diff-tag': SystemPortalDiffTag,
        'tag-editor': TagEditor,
        'svg-icon': SvgIcon,
        'diff-status': DiffStatus,
        'highlighted-text': HighlightedText,
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
    defaultEditor: SystemPortalDockEditor = null;
    defaultEditorKey: string = null;
    additionalEditors: SystemPortalDockEditor[] = [];
    editorGroups: SystemPortalEditorGroup[] = [];
    draggingEditorKey: string = null;
    draggingRecentTag: SystemPortalRecentTag = null;
    private _recentEditorCounter: number = 0;

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
    selectedPane: 'bots' | 'search' | 'diff' | 'sheet' = 'bots';
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
    private _pendingUrlSelection: {
        simulationId: string;
        botId: string;
        tag: string;
        space: string;
    } | null = null;

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
        this.defaultEditor = null;
        this.defaultEditorKey = null;
        this.additionalEditors = [];
        this.editorGroups = [
            {
                id: this._createEditorGroupId(),
                editorKeys: [],
                activeEditorKey: null,
            },
        ];
        this.draggingEditorKey = null;
        this.draggingRecentTag = null;
        this.isViewingTags = true;
        this.tagsVisible = true;
        this.pinnedTagsVisible = true;
        this.selectedPane = 'bots';
        this.searchTagsValue = '';
        this._tagSelectionEvents = new Map();
        this._simulationSubs = new Map();
        this._hasSheetPortalMap = new Map();
        this._loadPendingUrlSelection();

        this._subs.push(
            appManager.systemPortal.onItemsUpdated.subscribe((e) => {
                this.hasPortal = e.hasPortal;
                if (e.hasPortal) {
                    this.items = e.items;
                    this._applyPendingUrlSelection();
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
                    this._syncDefaultEditor(e);

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
                    this.selectedTagSpace = null;
                    this.defaultEditor = null;
                    this._removeDefaultEditorFromGroups();
                    this.defaultEditorKey = null;
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
        const editor = this._getDefaultEditorInstance();
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

        // Check mapPortal first, then gridPortal
        const mapPortal = calculateBotValue(
            null,
            sim.helper.userBot,
            MAP_PORTAL
        );
        const gridPortal = calculateBotValue(
            null,
            sim.helper.userBot,
            'gridPortal'
        );

        // Use mapPortal if available, otherwise fall back to gridPortal
        const portalValue = hasValue(mapPortal) ? mapPortal : gridPortal;

        if (!hasValue(portalValue) || this.hasSheetPortal) {
            this.isSettingSheetPortal = true;
            this.sheetPortalValue = '';
        } else {
            sim.helper.updateBot(sim.helper.userBot, {
                tags: {
                    [SHEET_PORTAL]: portalValue,
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
        for (let editor of this._allEditorInstances()) {
            const monacoEditor = editor?.monacoEditor()?.editor;
            if (!monacoEditor) {
                continue;
            }

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
            const editor = this._getDefaultEditorInstance();
            editor?.focusEditor();
        });
    }

    private _focusTag(tag: SystemPortalSelectionTag) {
        this.$nextTick(() => {
            this._focusEditorOnSelectionUpdate = true;
            this.selectTag(tag);
        });
    }

    private _syncDefaultEditor(
        update: Extract<SystemPortalSelectionUpdate, { hasSelection: true }>
    ) {
        const defaultEditor = this._createEditorFromSelection(update);
        this.defaultEditor = defaultEditor;

        if (!defaultEditor) {
            this._removeDefaultEditorFromGroups();
            this.defaultEditorKey = null;
            return;
        }

        const nextDefaultKey = defaultEditor.key;
        this._upsertEditor(defaultEditor, true);

        const previousDefaultKey = this.defaultEditorKey;
        if (previousDefaultKey && previousDefaultKey !== nextDefaultKey) {
            this._removeEditorKeyFromGroups(previousDefaultKey);
            this.additionalEditors = this.additionalEditors.filter(
                (e) => e.key !== nextDefaultKey
            );
        }

        this.defaultEditorKey = nextDefaultKey;
        this._removeEditorKeyFromGroups(nextDefaultKey);
        const firstGroup = this._ensureFirstGroup();
        firstGroup.editorKeys.unshift(nextDefaultKey);
        firstGroup.activeEditorKey = nextDefaultKey;
        this._cleanupEmptyGroups();
    }

    private _createEditorFromSelection(
        update: Extract<SystemPortalSelectionUpdate, { hasSelection: true }>
    ): SystemPortalDockEditor | null {
        const simulationId = update.simulationId;
        const botId = update.bot?.id;
        const tag = update.tag ?? this.getFirstTag();
        const space = update.space ?? null;

        if (!simulationId || !botId || !tag) {
            return null;
        }

        return this._buildEditor(simulationId, botId, tag, space);
    }

    private _buildEditor(
        simulationId: string,
        botId: string,
        tag: string,
        space: string
    ): SystemPortalDockEditor {
        const key = this._editorKey(simulationId, botId, tag, space);
        return {
            key,
            simulationId,
            botId,
            tag,
            space: space ?? null,
        };
    }

    private _editorKey(
        simulationId: string,
        botId: string,
        tag: string,
        space: string
    ): string {
        return `${simulationId}:${botId}:${tag}:${space ?? ''}`;
    }

    private _createEditorGroupId() {
        return `group-${Math.random().toString(36).slice(2, 10)}`;
    }

    private _ensureFirstGroup(): SystemPortalEditorGroup {
        if (!this.editorGroups || this.editorGroups.length <= 0) {
            this.editorGroups = [
                {
                    id: this._createEditorGroupId(),
                    editorKeys: [],
                    activeEditorKey: null,
                },
            ];
        }
        return this.editorGroups[0];
    }

    private _upsertEditor(editor: SystemPortalDockEditor, isDefault: boolean) {
        if (isDefault) {
            this.defaultEditor = editor;
            return;
        }

        const index = this.additionalEditors.findIndex(
            (e) => e.key === editor.key
        );
        if (index >= 0) {
            this.additionalEditors.splice(index, 1, editor);
        } else {
            this.additionalEditors.push(editor);
        }
    }

    private _removeEditorKeyFromGroups(editorKey: string) {
        for (let group of this.editorGroups) {
            const index = group.editorKeys.indexOf(editorKey);
            if (index >= 0) {
                group.editorKeys.splice(index, 1);
                if (group.activeEditorKey === editorKey) {
                    group.activeEditorKey = group.editorKeys[0] ?? null;
                }
            }
        }
    }

    private _removeDefaultEditorFromGroups() {
        if (!this.defaultEditorKey) {
            return;
        }

        for (let group of this.editorGroups) {
            const index = group.editorKeys.indexOf(this.defaultEditorKey);
            if (index >= 0) {
                group.editorKeys.splice(index, 1);
                if (group.activeEditorKey === this.defaultEditorKey) {
                    group.activeEditorKey = group.editorKeys[0] ?? null;
                }
            }
        }

        this._cleanupEmptyGroups();
    }

    private _cleanupEmptyGroups() {
        this.editorGroups = this.editorGroups.filter(
            (g, index) => g.editorKeys.length > 0 || index === 0
        );
    }

    private _groupForEditorKey(key: string): SystemPortalEditorGroup | null {
        return (
            this.editorGroups.find((g) => g.editorKeys.includes(key)) ?? null
        );
    }

    editorForKey(key: string): SystemPortalDockEditor | null {
        if (this.defaultEditor && this.defaultEditor.key === key) {
            return this.defaultEditor;
        }
        return this.additionalEditors.find((e) => e.key === key) ?? null;
    }

    activeEditorForGroup(
        group: SystemPortalEditorGroup
    ): SystemPortalDockEditor | null {
        const key = group.activeEditorKey ?? group.editorKeys[0];
        if (!key) {
            return null;
        }
        return this.editorForKey(key);
    }

    editorBot(editor: SystemPortalDockEditor): Bot | null {
        if (editor.bot) {
            return editor.bot;
        }

        const sim = appManager.simulationManager.simulations.get(
            editor.simulationId
        );
        const directBot = sim?.helper.botsState[editor.botId] ?? null;
        if (directBot) {
            return directBot;
        }

        return null;
    }

    editorDisplayName(editor: SystemPortalDockEditor): string {
        if (!editor) {
            return '';
        }

        const bot = this.editorBot(editor);
        if (bot) {
            const systemTag = calculateStringTagValue(
                null,
                bot,
                SYSTEM_TAG_NAME,
                SYSTEM_TAG
            );
            const system = calculateFormattedBotValue(null, bot, systemTag);
            const area = getSystemArea(system);
            const title = getShortId(bot);
            if (area) {
                return `${editor.tag} - ${area}.${title}`;
            }
            return `${editor.tag} - ${title}`;
        }

        return editor.tag;
    }

    getEditorRef(groupId: string) {
        return `editor-${groupId}`;
    }

    selectEditorTab(groupId: string, editorKey: string) {
        const group = this.editorGroups.find((g) => g.id === groupId);
        if (group) {
            group.activeEditorKey = editorKey;
        }
    }

    openRecentInAdditionalEditor(
        recent: SystemPortalRecentTag
    ): SystemPortalDockEditor | null {
        if (!recent?.simulationId || !recent.botId || !recent.tag) {
            return null;
        }

        const editor = this._buildAdditionalEditorFromRecent(recent);

        this._upsertEditor(editor, false);
        const targetGroup =
            this.editorGroups.find((g) => g.activeEditorKey) ??
            this._ensureFirstGroup();

        if (!targetGroup.editorKeys.includes(editor.key)) {
            targetGroup.editorKeys.push(editor.key);
        }
        targetGroup.activeEditorKey = editor.key;

        return editor;
    }

    private _buildEditorFromRecent(
        recent: SystemPortalRecentTag
    ): SystemPortalDockEditor {
        const resolved = this._resolveRecentContext(recent);
        const editor = this._buildEditor(
            resolved.simulationId,
            recent.botId,
            recent.tag,
            recent.space || null
        );
        editor.bot = resolved.bot;
        return editor;
    }

    private _buildAdditionalEditorFromRecent(
        recent: SystemPortalRecentTag
    ): SystemPortalDockEditor {
        const editor = this._buildEditorFromRecent(recent);
        // Keep recent-based docked editors distinct from the default editor key
        // so panes always bind to an additional editor instance.
        editor.key = `recent:${editor.key}`;
        return editor;
    }

    private _resolveRecentContext(recent: SystemPortalRecentTag): {
        simulationId: string;
        bot: Bot | null;
    } {
        const directSim = appManager.simulationManager.simulations.get(
            recent.simulationId
        );
        const directBot = directSim?.helper.botsState[recent.botId] ?? null;
        if (directBot) {
            return {
                simulationId: recent.simulationId,
                bot: directBot,
            };
        }

        // If the recent bot is currently selected, use that selection context.
        if (
            this.selectedBot &&
            this.selectedBot.id === recent.botId &&
            this.selectedBotSimId
        ) {
            return {
                simulationId: this.selectedBotSimId,
                bot: this.selectedBot,
            };
        }

        // Fallback: find the bot in any simulation and keep the pair consistent.
        for (let [id, sim] of appManager.simulationManager.simulations) {
            const bot = sim.helper.botsState[recent.botId] ?? null;
            if (bot) {
                return {
                    simulationId: id,
                    bot,
                };
            }
        }

        return {
            simulationId: recent.simulationId,
            bot: null,
        };
    }

    closeEditor(editorKey: string) {
        if (editorKey === this.defaultEditorKey) {
            return;
        }

        this.additionalEditors = this.additionalEditors.filter(
            (e) => e.key !== editorKey
        );

        for (let group of this.editorGroups) {
            const index = group.editorKeys.indexOf(editorKey);
            if (index >= 0) {
                group.editorKeys.splice(index, 1);
                if (group.activeEditorKey === editorKey) {
                    group.activeEditorKey = group.editorKeys[0] ?? null;
                }
            }
        }

        this._cleanupEmptyGroups();
    }

    makeEditorDefault(editorKey: string) {
        if (editorKey === this.defaultEditorKey) {
            return;
        }

        const editor = this.editorForKey(editorKey);
        if (!editor) {
            return;
        }

        const tags: BotTags = {
            [SYSTEM_PORTAL_BOT]: createBotLink([editor.botId]),
            [SYSTEM_PORTAL_TAG]: editor.tag,
            [SYSTEM_PORTAL_TAG_SPACE]: editor.space ?? null,
            [SYSTEM_PORTAL_PANE]: 'bots',
        };

        this._setSimUserBotTags(editor.simulationId, tags);
    }

    onEditorTabDragStart(editorKey: string, event: DragEvent) {
        if (editorKey === this.defaultEditorKey) {
            event.preventDefault();
            return;
        }
        this.draggingEditorKey = editorKey;
        this.draggingRecentTag = null;
        event.dataTransfer?.setData('text/plain', editorKey);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    onEditorTabDragEnd() {
        this.draggingEditorKey = null;
        this.draggingRecentTag = null;
    }

    onRecentTagDragStart(recent: SystemPortalRecentTag, event: DragEvent) {
        this.draggingEditorKey = '__dragging-recent__';
        this.draggingRecentTag = recent;
        event.dataTransfer?.setData(
            'application/x-system-portal-recent',
            JSON.stringify(recent)
        );
        event.dataTransfer?.setData('text/plain', '__dragging-recent__');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copyMove';
        }
    }

    onRecentTagDragEnd() {
        // Delay cleanup to ensure drop handlers can read drag state first.
        setTimeout(() => {
            this.draggingEditorKey = null;
            this.draggingRecentTag = null;
        }, 0);
    }

    private _getDroppedEditorOrRecent(
        event: DragEvent
    ):
        | { type: 'editor'; editorKey: string }
        | { type: 'recent'; recent: SystemPortalRecentTag }
        | null {
        // Check for a recent tag stored on this instance first (set via
        // inline template handler when dragging a recent tag pill).
        if (
            this.draggingRecentTag?.simulationId &&
            this.draggingRecentTag.botId &&
            this.draggingRecentTag.tag
        ) {
            return {
                type: 'recent',
                recent: this.draggingRecentTag,
            };
        }

        const recentData = event.dataTransfer?.getData(
            'application/x-system-portal-recent'
        );
        if (recentData) {
            try {
                const recent = JSON.parse(recentData) as SystemPortalRecentTag;
                if (recent?.simulationId && recent?.botId && recent?.tag) {
                    return {
                        type: 'recent',
                        recent,
                    };
                }
            } catch {
                // Ignore malformed drag payloads.
            }
        }

        const editorKey =
            event.dataTransfer?.getData('text/plain') ?? this.draggingEditorKey;
        if (editorKey && editorKey !== '__dragging-recent__') {
            return {
                type: 'editor',
                editorKey,
            };
        }

        return null;
    }

    onEditorTabDropInGroup(groupId: string, event: DragEvent) {
        event.preventDefault();
        const droppedItem = this._getDroppedEditorOrRecent(event);
        if (!droppedItem) {
            return;
        }

        if (droppedItem.type === 'editor') {
            this._moveEditorToGroup(droppedItem.editorKey, groupId);
        } else {
            this._queueRecentDropToGroup(droppedItem.recent, groupId);
        }

        this.draggingEditorKey = null;
        this.draggingRecentTag = null;
    }

    onEditorTabDropNewGroup(event: DragEvent) {
        event.preventDefault();
        const droppedItem = this._getDroppedEditorOrRecent(event);
        if (!droppedItem) {
            return;
        }

        const newGroup: SystemPortalEditorGroup = {
            id: this._createEditorGroupId(),
            editorKeys: [],
            activeEditorKey: null,
        };
        this.editorGroups.push(newGroup);

        if (droppedItem.type === 'editor') {
            this._moveEditorToGroup(droppedItem.editorKey, newGroup.id);
            this._cleanupEmptyGroups();
        } else {
            this._queueRecentDropToGroup(droppedItem.recent, newGroup.id);
        }
        this.draggingEditorKey = null;
        this.draggingRecentTag = null;
    }

    private _queueRecentDropToGroup(
        recent: SystemPortalRecentTag,
        groupId: string
    ) {
        this._recentEditorCounter += 1;
        const editor = this._buildEditorFromRecent(recent);
        editor.key = `recent:${editor.key}:${this._recentEditorCounter}`;
        this._upsertEditor(editor, false);
        this._moveEditorToGroup(editor.key, groupId);
        this._cleanupEmptyGroups();
    }

    private _moveEditorToGroup(editorKey: string, groupId: string) {
        if (editorKey === this.defaultEditorKey) {
            return;
        }

        const targetGroup = this.editorGroups.find((g) => g.id === groupId);
        if (!targetGroup) {
            return;
        }

        for (let group of this.editorGroups) {
            const index = group.editorKeys.indexOf(editorKey);
            if (index >= 0) {
                group.editorKeys.splice(index, 1);
                if (group.activeEditorKey === editorKey) {
                    group.activeEditorKey = group.editorKeys[0] ?? null;
                }
            }
        }

        if (!targetGroup.editorKeys.includes(editorKey)) {
            targetGroup.editorKeys.push(editorKey);
        }
        targetGroup.activeEditorKey = editorKey;

        this._cleanupEmptyGroups();
    }

    private _allEditorInstances(): TagValueEditor[] {
        const editors: TagValueEditor[] = [];
        if (!this.editorGroups) {
            return editors;
        }

        for (let group of this.editorGroups) {
            const refName = this.getEditorRef(group.id);
            const ref = this.$refs[refName] as
                | TagValueEditor
                | TagValueEditor[];
            if (Array.isArray(ref)) {
                editors.push(...ref.filter((r) => !!r));
            } else if (ref) {
                editors.push(ref);
            }
        }

        return editors;
    }

    private _getDefaultEditorInstance(): TagValueEditor | null {
        const defaultGroup = this.defaultEditorKey
            ? this._groupForEditorKey(this.defaultEditorKey)
            : null;
        if (!defaultGroup) {
            return this._allEditorInstances()[0] ?? null;
        }
        const refName = this.getEditorRef(defaultGroup.id);
        const ref = this.$refs[refName] as TagValueEditor | TagValueEditor[];
        if (Array.isArray(ref)) {
            return ref[0] ?? null;
        }
        return ref ?? null;
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

    private _loadPendingUrlSelection() {
        const url = new URL(window.location.href);
        const simulationId = url.searchParams.get('systemPortalSimulationId');
        const botId = url.searchParams.get('systemPortalBotId');
        const tag = url.searchParams.get('systemPortalTagName');
        const hasSpace = url.searchParams.has('systemPortalTagSpace');
        const space = hasSpace
            ? url.searchParams.get('systemPortalTagSpace')
            : null;

        if (simulationId && botId && tag) {
            this._pendingUrlSelection = {
                simulationId,
                botId,
                tag,
                space,
            };
        }
    }

    private _applyPendingUrlSelection() {
        if (!this._pendingUrlSelection) {
            return;
        }

        const selection = this._pendingUrlSelection;
        const sim = appManager.simulationManager.simulations.get(
            selection.simulationId
        );
        if (!sim?.helper?.userBot) {
            return;
        }

        this._setSimUserBotTags(selection.simulationId, {
            [SYSTEM_PORTAL]: true,
            [SYSTEM_PORTAL_BOT]: createBotLink([selection.botId]),
            [SYSTEM_PORTAL_TAG]: selection.tag,
            [SYSTEM_PORTAL_TAG_SPACE]: selection.space ?? null,
            [SYSTEM_PORTAL_PANE]: 'bots',
        });

        const url = new URL(window.location.href);
        url.searchParams.delete('systemPortalSimulationId');
        url.searchParams.delete('systemPortalBotId');
        url.searchParams.delete('systemPortalTagName');
        url.searchParams.delete('systemPortalTagSpace');
        window.history.replaceState({}, '', url.toString());

        this._pendingUrlSelection = null;
    }

    private _openTagInNewBrowserTab(
        simulationId: string,
        botId: string,
        tag: string,
        space: string
    ) {
        if (!simulationId || !botId || !tag) {
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.set('systemPortal', 'true');
        url.searchParams.set('systemPortalSimulationId', simulationId);
        url.searchParams.set('systemPortalBotId', botId);
        url.searchParams.set('systemPortalTagName', tag);
        if (space != null && space !== '') {
            url.searchParams.set('systemPortalTagSpace', space);
        } else {
            url.searchParams.delete('systemPortalTagSpace');
        }

        navigateToUrl(url.toString(), '_blank', 'noreferrer');
    }

    selectTag(tag: SystemPortalSelectionTag, event?: MouseEvent) {
        if (event?.ctrlKey || event?.metaKey) {
            this._openTagInNewBrowserTab(
                this.selectedBotSimId,
                this.selectedBotId,
                tag.name,
                tag.space ?? null
            );
            return;
        }

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

    selectRecentTag(recent: SystemPortalRecentTag, event?: MouseEvent) {
        if (event?.ctrlKey || event?.metaKey) {
            this._openTagInNewBrowserTab(
                recent.simulationId,
                recent.botId,
                recent.tag,
                recent.space ?? null
            );
            return;
        }

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

    onEditorFocused(focused: boolean, editor?: SystemPortalDockEditor) {
        if (focused) {
            const target = editor ?? this.defaultEditor;
            const bot = target ? this.editorBot(target) : null;
            if (bot && target?.tag) {
                const sim = appManager.simulationManager.simulations.get(
                    target.simulationId
                );
                sim?.helper.setEditingBot(
                    bot,
                    target.tag,
                    target.space ?? null
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

interface SystemPortalDockEditor {
    key: string;
    simulationId: string;
    botId: string;
    tag: string;
    space?: string;
    bot?: Bot;
}

interface SystemPortalEditorGroup {
    id: string;
    editorKeys: string[];
    activeEditorKey: string | null;
}
