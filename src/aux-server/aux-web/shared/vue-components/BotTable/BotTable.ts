import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import { some, union, sortBy } from 'lodash';
import {
    botTags,
    isHiddenTag,
    Bot,
    hasValue,
    isFormula,
    getShortId,
    merge,
    botAdded,
    getAllBotTags,
    toast,
    isEditable,
    createDimensionId,
    addToDimensionDiff,
    DEFAULT_WORKSPACE_SCALE,
    PrecalculatedBot,
    isScript,
    parseScript,
    BOT_SPACE_TAG,
    getBotSpace,
    getBotTag,
    goToDimension,
    BotTags,
    tweenTo,
    getTagValueForSpace,
    TAG_MASK_SPACE_PRIORITIES,
    BotSpace,
    getScriptPrefix,
} from '@casual-simulation/aux-common';
import { EventBus } from '@casual-simulation/aux-components';

import BotValue from '../BotValue/BotValue';
import TagEditor from '../TagEditor/TagEditor';
import AlertDialogOptions from '../../AlertDialogOptions';
import BotTag from '../BotTag/BotTag';
import BotID from '../BotID/BotID';
import { TreeView } from 'vue-json-tree-view';
import { downloadAuxState } from '../../DownloadHelpers';
import { SvgIcon } from '@casual-simulation/aux-components';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import Bowser from 'bowser';
import BotTagMini from '../BotTagMini/BotTagMini';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import { first } from 'rxjs/operators';
import { sumBy } from 'lodash';
import TagValueEditorWrapper from '../TagValueEditorWrapper/TagValueEditorWrapper';

@Component({
    components: {
        'bot-value': BotValue,
        'bot-id': BotID,
        'bot-tag': BotTag,
        'tag-editor': TagEditor,
        'tree-view': TreeView,
        'svg-icon': SvgIcon,
        // 'new-bot-icon': NewBot,
        // 'hex-icon': Hexagon,
        // 'resize-icon': ResizeIcon,
        // 'multi-icon': MultiIcon,
        'mini-bot': BotTagMini,
        'tag-value-editor': TagValueEditor,
        'tag-value-editor-wrapper': TagValueEditorWrapper,
    },
})
export default class BotTable extends Vue {
    @Prop() bots: Bot[];
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
    focusedBot: Bot = null;
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

    private _simulation: BrowserSimulation;
    private _isMobile: boolean;

    lastTag: string = '';
    wasLastEmpty: boolean = false;
    newTagOpen: boolean = false;
    dropDownUsed: boolean = false;
    deletedBot: Bot = null;
    deletedBotId: string = '';
    showBotDestroyed: boolean = false;
    lastSelectionCount: number = 0;

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
                    .map((t) => t.$el),
                ...(<BotID[]>this.$refs.tags).map((t) => t.$el),
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

    isMobile(): boolean {
        return this._isMobile;
    }

    isBotReadOnly(bot: Bot): boolean {
        return this.editableMap.get(bot.id) === false;
    }

    isTagOnlyScripts(tag: string, space: string) {
        const numScripts = sumBy(this.bots, (b) =>
            isScript(getTagValueForSpace(b, tag, space)) ? 1 : 0
        );
        const emptyTags = sumBy(this.bots, (b) =>
            !hasValue(getTagValueForSpace(b, tag, space)) ? 1 : 0
        );
        return numScripts > 0 && this.bots.length === numScripts + emptyTags;
    }

    isTagOnlyFormulas(tag: string, space: string) {
        const numFormulas = sumBy(this.bots, (b) =>
            isFormula(getTagValueForSpace(b, tag, space)) ? 1 : 0
        );
        const emptyTags = sumBy(this.bots, (b) =>
            !hasValue(getTagValueForSpace(b, tag, space)) ? 1 : 0
        );
        return numFormulas > 0 && this.bots.length === numFormulas + emptyTags;
    }

    getTagPrefix(tag: string, space: string) {
        const prefixes = this._simulation.portals.scriptPrefixes.map(
            (p) => p.prefix
        );
        let allSamePrefix = true;
        let currentPrefix = null;
        for (let bot of this.bots) {
            const value = getTagValueForSpace(bot, tag, space);
            if (!hasValue(value)) {
                continue;
            }
            const prefix = getScriptPrefix(prefixes, value);

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

    getBotManager() {
        return this._simulation;
    }

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
            if (this.bots[0].id === 'empty' && this.addedTags.length === 0) {
                return true;
            }
        }

        return false;
    }

    @Watch('bots')
    botsChanged() {
        if (
            this.bots[0] != null &&
            this.bots[0].id.startsWith('mod') &&
            this.addedTags.length > 0
        ) {
            this.addedTags = [];
        }

        this.lastSelectionCount = this.bots.length;

        this._updateTags();
        this.numBotsSelected = this.bots.length;
        if (this.focusedBot) {
            this.focusedBot =
                this.bots.find((f) => f.id === this.focusedBot.id) || null;
        }

        this._updateEditable();

        if (this.wasLastEmpty) {
            this.wasLastEmpty = false;
            this.$nextTick(() => {
                const tags = this.$refs.tagValues as BotValue[];
                for (let tag of tags) {
                    if (tag.tag === this.lastTag) {
                        tag.$el.focus();

                        break;
                    }
                }
            });
        }
    }

    @Watch('multilineValue')
    multilineValueChanged() {
        if (this.focusedBot && this.focusedTag) {
            if (
                this.focusedBot.id === 'empty' ||
                this.focusedBot.id === 'mod'
            ) {
                const updated = merge(this.focusedBot, {
                    tags: {
                        [this.focusedTag]: this.multilineValue,
                    },
                    values: {
                        [this.focusedTag]: this.multilineValue,
                    },
                });
            } else {
                this.getBotManager().editBot(
                    this.focusedBot,
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
            await this.getBotManager().helper.createBot(
                this.deletedBot.id,
                this.deletedBot.tags
            );
        }
    }

    async deleteBot(bot: Bot) {
        const destroyed = await this.getBotManager().helper.destroyBot(bot);
        if (destroyed) {
            this.deletedBot = bot;
            this.deletedBotId = getShortId(bot);
            this.showBotDestroyed = true;
        } else {
            this.deletedBot = null;
            this.deletedBotId = null;
            await this.getBotManager().helper.transaction(
                toast(`Cannot destroy ${getShortId(bot)}`)
            );
        }
    }

    async createBot() {
        const manager = this.getBotManager();
        const dimension = this.dimension;
        let tags: BotTags;
        if (this.dimension) {
            const calc = manager.helper.createContext();
            tags = addToDimensionDiff(calc, dimension);
        }
        const id = await manager.helper.createBot(undefined, tags);
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
                var options = new AlertDialogOptions();
                options.title = 'Tag already exists';
                options.body =
                    "Tag '" + this.newTag + "' already exists on this bot.";
                options.confirmText = 'Close';

                // Emit dialog event.
                EventBus.$emit('showAlertDialog', options);
                return;
            }

            if (!this.tagNotEmpty(this.newTag)) {
                var options = new AlertDialogOptions();
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
        const parsed = parseScript(newTag);
        return {
            tag: parsed !== null ? parsed : newTag,
            isScript: isScript(newTag),
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
                EventBus.$off('AutoFill');
                EventBus.$once('AutoFill', this.finishAddTag);
            });
        });

        // Check to make sure that the tag is unique.
        if (this.tagExists(this.newTag)) {
            var options = new AlertDialogOptions();
            options.title = 'Tag already exists';
            options.body =
                "Tag '" + this.newTag + "' already exists on this bot.";
            options.confirmText = 'Close';

            // Emit dialog event.
            EventBus.$emit('showAlertDialog', options);
            return;
        }

        if (!this.tagNotEmpty(this.newTag)) {
            var options = new AlertDialogOptions();
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
                    tag.$el.focus();
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

    clearSearch() {}

    async clearSelection() {
        await this.selectBot(this.bots[0]);
    }

    async selectBot(bot: Bot) {
        this.exitSheet();
        this.getBotManager().helper.transaction(
            tweenTo(bot.id, { duration: 0 })
        );
    }

    botClicked(bot: Bot) {
        this.$emit('botClick', bot);
    }

    async downloadBots() {
        if (this.hasBots) {
            const stored = await this.getBotManager().exportBots(
                this.bots.map((f) => f.id)
            );
            downloadAuxState(stored, `selection-${Date.now()}`);
        }
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

    onTagChanged(bot: Bot, tag: string, value: string, space: string) {
        this.lastEditedTag = this.focusedTag = tag;
        this.focusedBot = bot;
        this.focusedSpace = space;
        this.multilineValue = value;
        this.isFocusedTagFormula = isFormula(value);
    }

    onTagFocusChanged(bot: Bot, tag: string, space: string, focused: boolean) {
        if (focused) {
            this.focusedBot = bot;
            this.focusedTag = tag;
            this.focusedSpace = space;
            this.multilineValue = getTagValueForSpace(
                this.focusedBot,
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
        return some(this.bots, (f) =>
            hasValue(getTagValueForSpace(f, tag, space))
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

    getShortId(bot: Bot) {
        return getShortId(bot);
    }

    getBotValue(bot: Bot, tag: string) {
        return getBotTag(bot, tag);
    }

    getTagCellClass(bot: Bot, tag: string) {
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
        const bowserResult = Bowser.parse(navigator.userAgent);
        this._isMobile = bowserResult.platform.type === 'mobile';

        appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [];
        });

        this._updateTags();
        this.numBotsSelected = this.bots.length;
        this._updateEditable();

        EventBus.$on('addTag', this.openNewTag);
        EventBus.$on('closeNewTag', this.cancelNewTag);

        EventBus.$off('AutoFill');

        EventBus.$once('AutoFill', this.finishAddTag);
    }

    mounted() {
        const tagValueEditorWrapper = this.$refs.tagValueEditorWrapper;
        if (tagValueEditorWrapper) {
        }
    }

    get readOnlyTags() {
        return [BOT_SPACE_TAG];
    }

    private _updateTags() {
        const editingTags = this.lastEditedTag ? [this.lastEditedTag] : [];
        const allExtraTags = union(this.extraTags, this.addedTags, editingTags);

        this.tags = sortBy(
            botTags(
                this.bots,
                this.tags.map((t) => t.tag),
                allExtraTags,
                this.allowedTags
            ),
            (t) => t.tag
        );
    }

    private _updateEditable() {
        const calc = this.getBotManager().helper.createContext();
        for (let bot of this.bots) {
            this.editableMap.set(bot.id, isEditable(calc, bot));
        }
    }

    searchForTag(tag: string) {
        if (tag === null || this.tagHasValue(tag, null)) {
            this.$emit('goToTag', tag);
        }
    }
}

/**
 * Defines a set of valid positions that a new tag can be positioned at in the list.
 */
export type NewTagPlacement = 'top' | 'bottom';
