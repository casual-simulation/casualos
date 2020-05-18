import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import some from 'lodash/some';
import union from 'lodash/union';
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
} from '@casual-simulation/aux-common';
import { EventBus } from '../../EventBus';

import BotValue from '../BotValue/BotValue';
import TagEditor from '../TagEditor/TagEditor';
import AlertDialogOptions from '../../AlertDialogOptions';
import BotTag from '../BotTag/BotTag';
import BotID from '../BotID/BotID';
import { TreeView } from 'vue-json-tree-view';
import { downloadAuxState } from '../../DownloadHelpers';
import Cube from '../../public/icons/Cube.svg';
import Hexagon from '../../public/icons/Hexagon.svg';
import ResizeIcon from '../../public/icons/Resize.svg';
import MultiIcon from '../../public/icons/Multi.svg';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import Bowser from 'bowser';
import BotTagMini from '../BotTagMini/BotTagMini';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import { first } from 'rxjs/operators';
import sumBy from 'lodash/sumBy';
import TagValueEditorWrapper from '../TagValueEditorWrapper/TagValueEditorWrapper';

@Component({
    components: {
        'bot-value': BotValue,
        'bot-id': BotID,
        'bot-tag': BotTag,
        'tag-editor': TagEditor,
        'tree-view': TreeView,
        'cube-icon': Cube,
        'hex-icon': Hexagon,
        'resize-icon': ResizeIcon,
        'multi-icon': MultiIcon,
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
    /**
     * A property that can be set to indicate to the table that its values should be updated.
     */
    @Prop({})
    updateTime: number;

    @Prop({ default: null })
    dimension: string;

    @Prop({ required: true })
    showNewBot: boolean;

    tags: string[] = [];
    readOnlyTags: string[] = [];
    addedTags: string[] = [];
    lastEditedTag: string = null;
    focusedBot: Bot = null;
    focusedTag: string = null;
    isFocusedTagFormula: boolean = false;
    multilineValue: string = '';
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';
    newTagValid: boolean = true;
    newTagPlacement: NewTagPlacement = 'top';
    numBotsSelected: number = 0;
    viewMode: 'rows' | 'columns' = 'columns';
    showHidden: boolean = false;

    tagWhitelist: (string | boolean)[][] = [];
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

    uiHtmlElements(): HTMLElement[] {
        if (this.$refs.tags) {
            return [
                ...(<BotTag[]>this.$refs.tags)
                    .filter(t => t.allowCloning)
                    .map(t => t.$el),
                ...(<BotID[]>this.$refs.tags).map(t => t.$el),
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

    isWhitelistTagActive(index: number | string): boolean {
        if (typeof index === 'number') {
            if (index < 0) {
                return false;
            }
            return <boolean>this.tagWhitelist[index][1];
        } else {
            const idx = this.tagWhitelist.findIndex(bl => bl[0] === index);
            return this.isWhitelistTagActive(idx);
        }
    }

    getWhitelistCount(index: number): number {
        return this.tagWhitelist[index].length - 2;
    }

    isBotReadOnly(bot: Bot): boolean {
        return this.editableMap.get(bot.id) === false;
    }

    isTagOnlyScripts(tag: string) {
        const numScripts = sumBy(this.bots, b =>
            isScript(b.tags[tag]) ? 1 : 0
        );
        const emptyTags = sumBy(this.bots, b =>
            !hasValue(b.tags[tag]) ? 1 : 0
        );
        return numScripts > 0 && this.bots.length === numScripts + emptyTags;
    }

    isTagOnlyFormulas(tag: string) {
        const numFormulas = sumBy(this.bots, b =>
            isFormula(b.tags[tag]) ? 1 : 0
        );
        const emptyTags = sumBy(this.bots, b =>
            !hasValue(b.tags[tag]) ? 1 : 0
        );
        return numFormulas > 0 && this.bots.length === numFormulas + emptyTags;
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
            [`grid-template-${sizeType}`]: `auto ${idTemplate} repeat(${this
                .tags.length + this.readOnlyTags.length}, auto) auto`,
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

        this.setTagWhitelist();
        this._updateTags();
        this.numBotsSelected = this.bots.length;
        if (this.focusedBot) {
            this.focusedBot =
                this.bots.find(f => f.id === this.focusedBot.id) || null;
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
                this.getBotManager().helper.updateBot(this.focusedBot, {
                    tags: {
                        [this.focusedTag]: this.multilineValue,
                    },
                });
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
                this.tags.unshift(this.newTag);
            } else {
                this.addedTags.push(this.newTag);
                this.tags.push(this.newTag);
            }

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
        this.tags.push(this.newTag);

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
            tweenTo(bot.id, undefined, undefined, undefined, 0)
        );
    }

    async downloadBots() {
        if (this.hasBots) {
            const stored = await this.getBotManager().exportBots(
                this.bots.map(f => f.id)
            );
            downloadAuxState(stored, `selection-${Date.now()}`);
        }
    }

    onTagChanged(bot: Bot, tag: string, value: string) {
        this.lastEditedTag = this.focusedTag = tag;
        this.focusedBot = bot;
        this.multilineValue = value;
        this.isFocusedTagFormula = isFormula(value);
    }

    onTagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        if (focused) {
            this.focusedBot = bot;
            this.focusedTag = tag;
            this.multilineValue = this.focusedBot.tags[this.focusedTag];
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
        this.setTagWhitelist();
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

        this.setTagWhitelist();
        this._updateTags();
    }

    tagHasValue(tag: string): boolean {
        return some(this.bots, f => hasValue(f.tags[tag]));
    }

    isHiddenTag(tag: string): boolean {
        return isHiddenTag(tag);
    }

    tagExists(tag: string): boolean {
        return this.tags.indexOf(tag, 0) !== -1;
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

        this.setTagWhitelist();
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

    private _updateTags() {
        const editingTags = this.lastEditedTag ? [this.lastEditedTag] : [];
        const allExtraTags = union(this.extraTags, this.addedTags, editingTags);

        this.tags = botTags(
            this.bots,
            this.tags,
            allExtraTags,
            this.tagWhitelist
        ).sort();

        const isHiddenActive = this.isWhitelistTagActive('hidden');
        if (isHiddenActive) {
            this.readOnlyTags = [BOT_SPACE_TAG];
        } else {
            this.readOnlyTags = [];
        }
    }

    toggleWhitelistIndex(index: number) {
        this.tagWhitelist[index][1] = !this.tagWhitelist[index][1];
        this._updateTags();
    }

    setTagWhitelist() {
        let sortedArray: string[] = getAllBotTags(this.bots, true).sort();

        // remove any duplicates from the array to fix multiple bots adding in duplicate tags
        sortedArray = sortedArray.filter(function(elem, index, self) {
            return index === self.indexOf(elem);
        });

        let whitelist: (string | boolean)[][] = [];

        let hiddenList: (string | boolean)[] = [];
        let generalList: (string | boolean)[] = [];
        let listenerList: (string | boolean)[] = [];
        let formulaList: (string | boolean)[] = [];

        for (let i = sortedArray.length - 1; i >= 0; i--) {
            const tag = sortedArray[i];
            let removed = false;
            if (isHiddenTag(tag)) {
                hiddenList.push(tag);
                if (!removed) {
                    sortedArray.splice(i, 1);
                    removed = true;
                }
            }
            if (this.isTagOnlyScripts(tag)) {
                listenerList.push(tag);
                if (!removed) {
                    sortedArray.splice(i, 1);
                    removed = true;
                }
            }
            if (this.isTagOnlyFormulas(tag)) {
                formulaList.push(tag);
                if (!removed) {
                    sortedArray.splice(i, 1);
                    removed = true;
                }
            }
        }

        let camelCaseRegex = /(?=[A-Z])/g;

        let current = '';
        let tempArray: (string | boolean)[] = [];
        for (let i = sortedArray.length - 1; i >= 0; i--) {
            if (
                current.split(camelCaseRegex)[0] !=
                sortedArray[i].split(camelCaseRegex)[0]
            ) {
                if (tempArray.length > 0) {
                    if (whitelist.length === 0) {
                        whitelist = [tempArray];
                    } else {
                        whitelist.push(tempArray);
                    }
                }

                tempArray = [];
            }
            current = sortedArray[i];

            // if new tag matces the current tag section
            if (tempArray.length === 0) {
                // if the temp array has been reset

                // add the section name in slot 0
                tempArray.push(current.split(camelCaseRegex)[0]);

                let activeCheck = false;
                // add the section visibility in slot 1
                if (this.tagWhitelist.length > 0) {
                    this.tagWhitelist.forEach(element => {
                        if (element[0] === tempArray[0]) {
                            activeCheck = <boolean>element[1];
                        }
                    });
                }
                tempArray.push(activeCheck);

                // add the tag that started the match in slot 2
                tempArray.push(current);

                sortedArray.splice(i, 2);
            } else {
                tempArray.push(sortedArray[i]);
                sortedArray.splice(i, 1);
            }
        }

        // makes sure if the loop ends on an array it will add in the temp array correctly to the whitelist
        if (tempArray.length > 0) {
            if (whitelist.length === 0) {
                whitelist = [tempArray];
            } else {
                whitelist.push(tempArray);
            }
        }

        if (hiddenList.length > 0) {
            let activeCheck = false;

            if (this.tagWhitelist.length > 0) {
                this.tagWhitelist.forEach(element => {
                    if (element[0] === 'hidden') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            hiddenList.unshift(activeCheck);
            hiddenList.unshift('hidden');
            whitelist.unshift(hiddenList);
        } else {
            hiddenList.forEach(hiddenTags => {
                sortedArray.push(<string>hiddenTags);
            });
        }

        if (listenerList.length > 0) {
            let activeCheck = false;

            if (this.tagWhitelist.length > 0) {
                this.tagWhitelist.forEach(element => {
                    if (element[0] === '@') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            listenerList.unshift(activeCheck);
            listenerList.unshift('@');
            whitelist.unshift(listenerList);
        }

        if (formulaList.length > 0) {
            let activeCheck = false;

            if (this.tagWhitelist.length > 0) {
                this.tagWhitelist.forEach(element => {
                    if (element[0] === '@') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            formulaList.unshift(activeCheck);
            formulaList.unshift('=');
            whitelist.unshift(formulaList);
        }

        if (sortedArray.length > 0) {
            let activeCheck = true;

            if (this.tagWhitelist.length > 0) {
                this.tagWhitelist.forEach(element => {
                    if (element[0] === '#') {
                        activeCheck = <boolean>element[1];
                    }
                });
            }

            generalList.unshift(activeCheck);
            generalList.unshift('#');

            sortedArray.forEach(generalTags => {
                generalList.push(<string>generalTags);
            });

            whitelist.unshift(generalList);
        }

        this.tagWhitelist = whitelist;
    }

    getTagWhitelist(): string[] {
        let tagList: string[] = [];

        this.tagWhitelist.forEach(element => {
            tagList.push(<string>element[0]);
        });

        return tagList;
    }

    getVisualTagWhitelist(index: number): string {
        let newWhitelist: string;

        if ((<string>this.tagWhitelist[index][0]).length > 15) {
            newWhitelist =
                (<string>this.tagWhitelist[index][0]).substring(0, 15) + '..';
        } else {
            newWhitelist =
                (<string>this.tagWhitelist[index][0]).substring(0, 15) + '*';
        }

        return '#' + newWhitelist;
    }

    private _updateEditable() {
        const calc = this.getBotManager().helper.createContext();
        for (let bot of this.bots) {
            this.editableMap.set(bot.id, isEditable(calc, bot));
        }
    }

    searchForTag(tag: string) {
        if (tag === null || this.tagHasValue(tag)) {
            this.$emit('goToTag', tag);
        }
    }
}

/**
 * Defines a set of valid positions that a new tag can be positioned at in the list.
 */
export type NewTagPlacement = 'top' | 'bottom';
