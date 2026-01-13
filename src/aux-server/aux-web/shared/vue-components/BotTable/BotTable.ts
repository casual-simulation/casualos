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
import { Prop, Watch } from 'vue-property-decorator';
import { union, sortBy } from 'es-toolkit/compat';
import type { Bot, BotTags, BotSpace } from '@casual-simulation/aux-common';
import {
    botTags,
    isHiddenTag,
    hasValue,
    isFormula,
    getShortId,
    merge,
    toast,
    isEditable,
    addToDimensionDiff,
    isScript,
    parseNewTag,
    BOT_SPACE_TAG,
    getBotTag,
    getTagValueForSpace,
    TAG_MASK_SPACE_PRIORITIES,
    getScriptPrefix,
    isBotLink,
    KNOWN_TAG_PREFIXES,
    DNA_TAG_PREFIX,
    SHEET_PORTAL,
    formatValue,
    hasTagOrMask,
} from '@casual-simulation/aux-common';
import { EventBus } from '@casual-simulation/aux-components';

import BotValue from '../BotValue/BotValue';
import TagEditor from '../TagEditor/TagEditor';
import AlertDialogOptions from '../../AlertDialogOptions';
import BotTag from '../BotTag/BotTag';
import BotID from '../BotID/BotID';
import { TreeView } from 'vue-json-tree-view';
import { SvgIcon } from '@casual-simulation/aux-components';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import { sumBy } from 'es-toolkit/compat';
import TagValueEditorWrapper from '../TagValueEditorWrapper/TagValueEditorWrapper';
import { getModelUriFromId } from '../../MonacoUtils';
// import {} from 'vue-material/dist/'
import type monaco from '@casual-simulation/monaco-editor';
import { getActiveTheme } from '../utils';
import type { Simulation } from '@casual-simulation/aux-vm';
import { calculateIndexFromLocation } from '@casual-simulation/aux-runtime/runtime/TranspilerUtils';

export interface TableBot {
    /**
     * The bot that is stored in the table.
     */
    bot: Bot;

    /**
     * The ID of the sim that the bot belongs to.
     */
    simId: string;
}

@Component({
    components: {
        'bot-value': BotValue,
        'bot-id': BotID,
        'bot-tag': BotTag,
        'tag-editor': TagEditor,
        'tree-view': TreeView,
        'svg-icon': SvgIcon,
        'tag-value-editor': TagValueEditor,
        'tag-value-editor-wrapper': TagValueEditorWrapper,
    },
})
export default class BotTable extends Vue {
    @Prop() bots: TableBot[];
    @Prop({ default: null }) searchResult: any;
    @Prop({ default: () => <any>[] })
    extraTags: string[];
    @Prop({ default: false })
    readOnly: boolean;
    @Prop({ default: false })
    diffSelected: boolean;
    @Prop({ default: false })
    isSearch: boolean;

    @Prop({ default: null })
    dimension: string;

    @Prop({ required: true })
    showNewBot: boolean;

    @Prop({ default: true })
    showExitSheet: boolean;

    @Prop({ default: 'web_asset' })
    exitSheetIcon: string;

    @Prop({ default: 'Grid Portal' })
    exitSheetHint: string;

    @Prop({})
    allowedTags: string[];

    tags: { tag: string; space: string }[] = [];
    addedTags: string[] = [];
    lastEditedTag: string = null;
    focusedBot: TableBot = null;
    focusedTag: string = null;
    focusedSpace: string = null;
    isFocusedTagFormula: boolean = false;
    multilineValue: string = '';
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';
    newTagValid: boolean = true;
    newTagPlacement: NewTagPlacement = 'top';
    numBotsSelected: number = 0;
    viewMode: 'rows' | 'columns' = 'columns';
    showHidden: boolean = false;

    editableMap: Map<string, boolean>;

    private _focusEditorOnPortalUpdate: boolean;
    private _tagSelectionEvents: Map<
        string,
        {
            selectionStart: number;
            selectionEnd: number;
        }
    > = new Map();

    lastTag: string = '';
    wasLastEmpty: boolean = false;
    newTagOpen: boolean = false;
    dropDownUsed: boolean = false;
    deletedBot: TableBot = null;
    deletedBotId: string = '';
    showBotDestroyed: boolean = false;
    lastSelectionCount: number = 0;

    activeTheme() {
        return getActiveTheme();
    }

    get finalExitSheetIcon() {
        if (hasValue(this.exitSheetIcon)) {
            return this.exitSheetIcon;
        }
        return 'web_asset';
    }

    get finalExitSheetHint() {
        if (hasValue(this.exitSheetHint)) {
            return this.exitSheetHint;
        }
        return 'Grid Portal';
    }

    uiHtmlElements(): HTMLElement[] {
        if (this.$refs.tags) {
            return [
                ...(<BotTag[]>this.$refs.tags)
                    .filter((t) => t.allowCloning)
                    .map((t) => t.$el as HTMLElement),
                ...(<BotID[]>this.$refs.tags).map((t) => t.$el as HTMLElement),
            ];
        } else {
            return [];
        }
    }

    isAllTag(tag: string): boolean {
        return tag === '#';
    }

    isSpecialTag(tag: string): boolean {
        if (tag === '@' || tag === 'hidden' || tag === '=') {
            return true;
        } else {
            return false;
        }
    }

    isBotReadOnly(bot: TableBot): boolean {
        return this.editableMap.get(bot.bot.id) === false;
    }

    isTagOnlyScripts(tag: string, space: string) {
        return this._isTagOnlyType(tag, space, isScript);
    }

    isTagOnlyFormulas(tag: string, space: string) {
        return this._isTagOnlyType(tag, space, isFormula);
    }

    isTagOnlyLinks(tag: string, space: string) {
        return this._isTagOnlyType(tag, space, isBotLink);
    }

    private _isTagOnlyType(
        tag: string,
        space: string,
        test: (value: unknown) => boolean
    ): boolean {
        const numType = sumBy(this.bots, (b) =>
            test(getTagValueForSpace(b.bot, tag, space)) ? 1 : 0
        );
        const emptyTags = sumBy(this.bots, (b) =>
            !hasValue(getTagValueForSpace(b.bot, tag, space)) ? 1 : 0
        );
        return numType > 0 && this.bots.length === numType + emptyTags;
    }

    private _getSimulation(simId: string): BrowserSimulation {
        return appManager.simulationManager.simulations.get(simId);
    }

    getTagPrefix(tag: string, space: string) {
        const prefixes = [...KNOWN_TAG_PREFIXES];
        let allSamePrefix = true;
        let currentPrefix = null;

        for (let sim of appManager.simulationManager.simulations.values()) {
            for (let prefix of sim.portals.scriptPrefixes.map(
                (p) => p.prefix
            )) {
                if (!prefixes.includes(prefix)) {
                    prefixes.push(prefix);
                }
            }
        }

        for (let bot of this.bots) {
            const value = getTagValueForSpace(bot.bot, tag, space);
            if (!hasValue(value)) {
                continue;
            }
            const prefix =
                typeof value === 'object' && hasValue(value)
                    ? DNA_TAG_PREFIX
                    : getScriptPrefix(prefixes, value);

            if (!currentPrefix) {
                if (!prefix) {
                    allSamePrefix = false;
                    break;
                } else {
                    currentPrefix = prefix;
                }
            } else if (currentPrefix !== prefix) {
                allSamePrefix = false;
                break;
            }
        }

        if (allSamePrefix) {
            return currentPrefix;
        } else {
            return null;
        }
    }

    get showID() {
        return !this.diffSelected;
    }

    get botTableGridStyle() {
        const sizeType = this.viewMode === 'rows' ? 'columns' : 'rows';

        const idTemplate = this.showID ? 'auto' : '';

        if (this.tags.length === 0) {
            return {
                [`grid-template-${sizeType}`]: `auto ${idTemplate} auto`,
            };
        }

        return {
            [`grid-template-${sizeType}`]: `auto ${idTemplate} repeat(${
                this.tags.length + this.readOnlyTags.length
            }, auto) auto`,
        };
    }

    // getBotManager() {
    //     return this._simulation;
    // }

    get hasBots() {
        return this.bots.length > 0;
    }

    get hasTags() {
        return this.tags.length > 0;
    }

    get newTagExists() {
        return this.tagExists(this.newTag);
    }

    isEmptyDiff(): boolean {
        if (this.diffSelected) {
            if (
                this.bots[0].bot.id === 'empty' &&
                this.addedTags.length === 0
            ) {
                return true;
            }
        }

        return false;
    }

    @Watch('bots')
    botsChanged() {
        if (
            this.bots[0] != null &&
            this.bots[0].bot.id.startsWith('mod') &&
            this.addedTags.length > 0
        ) {
            this.addedTags = [];
        }

        this.lastSelectionCount = this.bots.length;

        this._updateTags();
        this.numBotsSelected = this.bots.length;
        if (this.focusedBot) {
            this.focusedBot =
                this.bots.find((b) => b.bot.id === this.focusedBot.bot.id) ||
                null;
        }

        this._updateEditable();

        if (this.wasLastEmpty) {
            this.wasLastEmpty = false;
            this.$nextTick(() => {
                const tags = this.$refs.tagValues as BotValue[];
                for (let tag of tags) {
                    if (tag.tag === this.lastTag) {
                        (tag.$el as HTMLElement).focus();

                        break;
                    }
                }
            });
        }

        if (this._focusEditorOnPortalUpdate) {
            this._focusEditor();
        }
    }

    @Watch('multilineValue')
    multilineValueChanged() {
        if (this.focusedBot && this.focusedTag) {
            if (
                this.focusedBot.bot.id === 'empty' ||
                this.focusedBot.bot.id === 'mod'
            ) {
                const updated = merge(this.focusedBot.bot, {
                    tags: {
                        [this.focusedTag]: this.multilineValue,
                    },
                    values: {
                        [this.focusedTag]: this.multilineValue,
                    },
                });
            } else {
                this._getSimulation(this.focusedBot.simId).editBot(
                    this.focusedBot.bot,
                    this.focusedTag,
                    this.multilineValue,
                    this.focusedSpace
                );
            }
        }
    }

    flipTable() {
        if (this.viewMode === 'rows') {
            this.viewMode = 'columns';
        } else {
            this.viewMode = 'rows';
        }
    }

    async undoDelete() {
        if (this.deletedBot) {
            this.showBotDestroyed = false;
            await this._getSimulation(this.deletedBot.simId).helper.createBot(
                this.deletedBot.bot.id,
                this.deletedBot.bot.tags
            );
        }
    }

    async deleteBot(bot: TableBot) {
        const sim = this._getSimulation(bot.simId);
        const destroyed = await sim.helper.destroyBot(bot.bot);
        if (destroyed) {
            this.deletedBot = bot;
            this.deletedBotId = getShortId(bot.bot);
            this.showBotDestroyed = true;
        } else {
            this.deletedBot = null;
            this.deletedBotId = null;
            await sim.helper.transaction(
                toast(`Cannot destroy ${getShortId(bot.bot)}`)
            );
        }
    }

    async createBot() {
        // Find which simulation should be used for new bots
        let simToUse: Simulation;
        const primary = appManager.simulationManager.primary;
        if (hasTagOrMask(primary.helper.configBot, SHEET_PORTAL)) {
            simToUse = primary;
        } else {
            for (let sim of appManager.simulationManager.simulations.values()) {
                if (hasTagOrMask(sim.helper.configBot, SHEET_PORTAL)) {
                    simToUse = sim;
                    break;
                }
            }
        }

        if (simToUse) {
            const dimension = this.dimension;
            let tags: BotTags;
            if (this.dimension) {
                const calc = simToUse.helper.createContext();
                tags = addToDimensionDiff(calc, dimension);
            }
            const id = await simToUse.helper.createBot(undefined, tags);
        }
    }

    selectNewTag() {
        if (!this.isMakingNewTag && !this.newTagOpen && !this.dropDownUsed) {
            this.isMakingNewTag = true;
            this.newTag = '';
            this.newTagPlacement = 'bottom';
        } else {
            this.newTagOpen = false;
        }
    }

    addTag(placement: NewTagPlacement = 'top') {
        if (this.dropDownUsed) {
            return;
        }

        if (this.isMakingNewTag) {
            const { tag, isScript } = this._formatNewTag(this.newTag);
            this.newTag = tag;

            this.dropDownUsed = true;
            this.newTagOpen = true;

            this.$nextTick(() => {
                this.$nextTick(() => {
                    this.dropDownUsed = false;
                    this.isMakingNewTag = false;
                    this.newTag = '';
                    this.newTagOpen = false;
                });
            });

            // Check to make sure that the tag is unique.
            if (this.tagExists(this.newTag)) {
                let options = new AlertDialogOptions();
                options.title = 'Tag already exists';
                options.body =
                    "Tag '" + this.newTag + "' already exists on this bot.";
                options.confirmText = 'Close';

                // Emit dialog event.
                EventBus.$emit('showAlertDialog', options);
                return;
            }

            if (!this.tagNotEmpty(this.newTag)) {
                let options = new AlertDialogOptions();
                options.title = 'Tag cannot be empty';
                options.body = 'Tag is empty or contains only whitespace......';
                options.confirmText = 'Close';

                // Emit dialog event.
                EventBus.$emit('showAlertDialog', options);
                return;
            }

            this.wasLastEmpty = this.isEmptyDiff();
            if (this.isEmptyDiff()) {
                this.lastTag = this.newTag;
            }

            if (this.newTagPlacement === 'top') {
                this.addedTags.unshift(this.newTag);
                this.tags.unshift({ tag: this.newTag, space: null });
            } else {
                this.addedTags.push(this.newTag);
                this.tags.push({ tag: this.newTag, space: null });
            }

            const addedTag = this.newTag;

            this._updateTags();
            this.$nextTick(() => {
                const tags = this.$refs.tagValues as BotValue[];
                for (let tag of tags) {
                    if (tag.tag === addedTag) {
                        tag.focus();
                        // This is a super hacky way to pre-fill the first bot's tag with an @ symbol
                        if (isScript) {
                            tag.setInitialValue('@');
                        }
                        break;
                    }
                }
            });
        } else {
            this.newTag = '';
            this.newTagPlacement = placement;
        }
    }

    private _formatNewTag(newTag: string) {
        const parsed = parseNewTag(newTag);
        return {
            tag: parsed.name,
            isScript: parsed.isScript,
        };
    }

    openNewTag(placement: NewTagPlacement = 'top') {
        this.isMakingNewTag = true;
        this.newTag = '';
        this.newTagPlacement = placement;
    }

    finishAddTag(inputTag: string) {
        if (this.dropDownUsed) {
            return;
        }

        const { tag, isScript } = this._formatNewTag(inputTag);
        this.newTag = tag;
        this.newTagPlacement = 'bottom';

        this.dropDownUsed = true;
        this.newTagOpen = true;

        this.$nextTick(() => {
            this.$nextTick(() => {
                this.dropDownUsed = false;
                this.isMakingNewTag = false;
                this.newTag = '';
                this.newTagOpen = false;
            });
        });

        // Check to make sure that the tag is unique.
        if (this.tagExists(this.newTag)) {
            let options = new AlertDialogOptions();
            options.title = 'Tag already exists';
            options.body =
                "Tag '" + this.newTag + "' already exists on this bot.";
            options.confirmText = 'Close';

            // Emit dialog event.
            EventBus.$emit('showAlertDialog', options);
            return;
        }

        if (!this.tagNotEmpty(this.newTag)) {
            let options = new AlertDialogOptions();
            options.title = 'Tag cannot be empty';
            options.body = 'Tag is empty or contains only whitespace.';
            options.confirmText = 'Close';

            // Emit dialog event.
            EventBus.$emit('showAlertDialog', options);
            return;
        }

        this.wasLastEmpty = this.isEmptyDiff();
        if (this.isEmptyDiff()) {
            this.lastTag = this.newTag;
        }

        this.addedTags.push(this.newTag);
        this.tags.push({ tag: this.newTag, space: null });

        const addedTag = this.newTag;

        this._updateTags();
        this.$nextTick(() => {
            const tags = this.$refs.tagValues as BotValue[];
            for (let tag of tags) {
                if (tag.tag === addedTag) {
                    (tag.$el as HTMLElement).focus();
                    // This is a super hacky way to pre-fill the first bot's tag with an @ symbol
                    if (isScript) {
                        tag.setInitialValue('@');
                    }
                    break;
                }
            }
        });

        this.newTag = '';
        this.newTagPlacement = 'bottom';
        this.cancelNewTag();
    }

    exitSheet() {
        this.$emit('exitSheet');
    }

    closeWindow() {
        this.$emit('closeWindow');
    }

    cancelNewTag() {
        this.isMakingNewTag = false;
    }

    botClicked(bot: Bot) {
        this.$emit('botClick', bot);
    }

    shouldShowRealValue(tag: string, space: string, tagIndex: number) {
        // Find all the same tags
        const sameTags = this.tags.filter(
            (t) => t.tag === tag && t.space !== space
        );

        // Figure out if the current tag and space have the highest priority
        // by comparing them to the priority list.
        const currentSpacePriorityIndex = TAG_MASK_SPACE_PRIORITIES.indexOf(
            space as BotSpace
        );
        for (let t of sameTags) {
            const priorityIndex = TAG_MASK_SPACE_PRIORITIES.indexOf(
                t.space as BotSpace
            );
            if (currentSpacePriorityIndex < priorityIndex) {
                // There is another tag that has a higher priority space than us.
                // Therefore we should show the real tag value.
                return true;
            }
        }

        return false;
    }

    async botIDClick(id: string) {
        this.$emit('botIDClick', id);
    }

    onTagChanged(
        simId: string,
        bot: Bot,
        tag: string,
        value: string,
        space: string
    ) {
        this.lastEditedTag = this.focusedTag = tag;
        this.focusedBot = {
            bot,
            simId,
        };
        this.focusedSpace = space;
        this.multilineValue = value;
        this.isFocusedTagFormula = isFormula(value);
    }

    onTagFocusChanged(
        bot: TableBot,
        tag: string,
        space: string,
        focused: boolean
    ) {
        if (focused) {
            this.focusedBot = bot;
            this.focusedTag = tag;
            this.focusedSpace = space;
            this.multilineValue = getTagValueForSpace(
                this.focusedBot.bot,
                this.focusedTag,
                this.focusedSpace
            );
            this.isFocusedTagFormula = isFormula(this.multilineValue);

            this.$nextTick(() => {
                if (this.$refs.multiLineEditor) {
                    (<any>this.$refs.multiLineEditor).applyStyles();
                }
            });
        }
        this.$emit('tagFocusChanged', bot, tag, focused);
    }

    toggleHidden() {
        this.showHidden = !this.showHidden;
        this._updateTags();
    }

    removeTag(tag: string) {
        if (
            tag === this.lastEditedTag ||
            tag === this.newTag ||
            tag === this.focusedTag
        ) {
            this.lastEditedTag = null;
            this.focusedTag = null;
        }
        const index = this.addedTags.indexOf(tag);
        if (index >= 0) {
            this.addedTags.splice(index, 1);
        }

        this._updateTags();
    }

    tagHasValue(tag: string, space: string): boolean {
        return this.bots.some((b) =>
            hasValue(getTagValueForSpace(b.bot, tag, space))
        );
    }

    isHiddenTag(tag: string): boolean {
        return isHiddenTag(tag);
    }

    tagExists(tag: string): boolean {
        return this.tags.some((t) => t.tag === tag && t.space === null);
    }

    tagNotEmpty(tag: string): boolean {
        return tag.trim() != '';
    }

    newTagValidityUpdated(valid: boolean) {
        this.newTagValid = valid;
    }

    getShortId(bot: TableBot) {
        return getShortId(bot.bot);
    }

    getBotValue(bot: TableBot, tag: string) {
        return getBotTag(bot.bot, tag);
    }

    getTagCellClass(bot: TableBot, tag: string) {
        return {
            focused: bot === this.focusedBot && tag === this.focusedTag,
        };
    }

    async clearDiff() {
        this.lastEditedTag = null;
        this.focusedTag = null;
        this.addedTags.length = 0;
    }

    constructor() {
        super();
        this.editableMap = new Map();
    }

    async created() {
        this._tagSelectionEvents = new Map();

        this._updateTags();
        this.numBotsSelected = this.bots.length;
        this._updateEditable();

        EventBus.$on('addTag', this.openNewTag);
        EventBus.$on('closeNewTag', this.cancelNewTag);
    }

    get readOnlyTags() {
        return [BOT_SPACE_TAG];
    }

    private _updateTags() {
        const editingTags = this.lastEditedTag ? [this.lastEditedTag] : [];
        const allExtraTags = union(this.extraTags, this.addedTags, editingTags);

        this.tags = sortBy(
            botTags(
                this.bots.map((b) => b.bot),
                this.tags.map((t) => t.tag),
                allExtraTags,
                this.allowedTags
            ),
            (t) => t.tag
        );
    }

    private _updateEditable() {
        for (let bot of this.bots) {
            this.editableMap.set(bot.bot.id, isEditable(null, bot.bot));
        }
    }

    searchForTag(tag: string) {
        if (tag === null || this.tagHasValue(tag, null)) {
            this.$emit('goToTag', tag);
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
        columnNumber: number
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

        return this.selectBotAndTag(sim, botId, tag, space, index, index);
    }

    selectBotAndTag(
        sim: BrowserSimulation,
        botId: string,
        tag: string,
        space: string,
        startIndex?: number,
        endIndex?: number
    ) {
        let tags: BotTags = {
            [SHEET_PORTAL]: botId,
        };
        this._setTagSelection(botId, tag, space, startIndex, endIndex);

        if (tags[SHEET_PORTAL] != sim.helper.userBot.tags[SHEET_PORTAL]) {
            sim.helper.updateBot(sim.helper.userBot, {
                tags: tags,
            });
        } else {
            this._focusEditor();
        }

        this.onTagFocusChanged(
            {
                bot: sim.helper.botsState[botId],
                simId: sim.id,
            },
            tag,
            space,
            true
        );
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

    getMultilineEditor() {
        return <TagValueEditor>this.$refs.multilineEditor;
    }

    private _changeEditorSelection(
        modelUri: string,
        selectionStart: number,
        selectionEnd: number
    ): boolean {
        let editor = this.getMultilineEditor();
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

    private _focusEditor() {
        this._focusEditorOnPortalUpdate = false;
        this.$nextTick(() => {
            let editor = <TagValueEditor>this.$refs.multilineEditor;
            editor?.focusEditor();
        });
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
}

/**
 * Defines a set of valid positions that a new tag can be positioned at in the list.
 */
export type NewTagPlacement = 'top' | 'bottom';
