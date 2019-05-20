import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import { some, union } from 'lodash';
import {
    File,
    Object,
    fileTags,
    isHiddenTag,
    AuxObject,
    hasValue,
    isFormula,
    getShortId,
    isDiff,
    merge,
    SelectionMode,
    tweenTo,
    AuxCausalTree,
    fileAdded,
    getAllFileTags,
} from '@casual-simulation/aux-common';
import { EventBus } from '../../shared/EventBus';
import { appManager } from '../../shared/AppManager';

import FileValue from '../FileValue/FileValue';
import TagEditor from '../TagEditor/TagEditor';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import FileTag from '../FileTag/FileTag';
import FileTableToggle from '../FileTableToggle/FileTableToggle';
import { TreeView } from 'vue-json-tree-view';
import { tickStep } from 'd3';
import { downloadAuxState } from '../download';
import { storedTree, site } from '@casual-simulation/causal-trees';
import Cube from '../public/icons/Cube.svg';

@Component({
    components: {
        'file-value': FileValue,
        'file-tag': FileTag,
        'tag-editor': TagEditor,
        'file-table-toggle': FileTableToggle,
        'tree-view': TreeView,
        'cube-icon': Cube,
    },
})
export default class FileTable extends Vue {
    @Prop() files: AuxObject[];
    @Prop({ default: null }) searchResult: any;
    @Prop({ default: () => <any>[] })
    extraTags: string[];
    @Prop({ default: false })
    readOnly: boolean;
    @Prop({ default: 'single' })
    selectionMode: SelectionMode;
    @Prop({ default: false })
    diffSelected: boolean;
    @Prop({ default: false })
    isSearch: boolean;

    /**
     * A property that can be set to indicate to the table that its values should be updated.
     */
    @Prop({})
    updateTime: number;
    tags: string[] = [];
    addedTags: string[] = [];
    lastEditedTag: string = null;
    focusedFile: AuxObject = null;
    focusedTag: string = null;
    isFocusedTagFormula: boolean = false;
    multilineValue: string = '';
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';
    newTagValid: boolean = true;
    newTagPlacement: NewTagPlacement = 'top';
    numFilesSelected: number = 0;
    viewMode: 'rows' | 'columns' = 'columns';
    showHidden: boolean = false;

    tagBlacklist: string[] = [];
    blacklistIndex: boolean[] = [];
    blacklistCount: number[] = [];

    uiHtmlElements(): HTMLElement[] {
        if (this.$refs.tags) {
            return (<FileTag[]>this.$refs.tags)
                .filter(t => t.allowCloning)
                .map(t => t.$el);
        } else {
            return [];
        }
    }

    isAllTag(tag: string): boolean {
        return tag === '*';
    }

    isBlacklistTagActive(index: number): boolean {
        return this.blacklistIndex[index];
    }

    getBlacklistCount(index: number): number {
        return this.blacklistCount[index];
    }

    get fileTableGridStyle() {
        const sizeType = this.viewMode === 'rows' ? 'columns' : 'rows';
        if (this.tags.length === 0) {
            return {
                [`grid-template-${sizeType}`]: `auto auto auto`,
            };
        }
        return {
            [`grid-template-${sizeType}`]: `auto auto repeat(${
                this.tags.length
            }, auto) auto`,
        };
    }

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    get hasTags() {
        return this.tags.length > 0;
    }

    get newTagExists() {
        return this.tagExists(this.newTag);
    }

    @Watch('files')
    filesChanged() {
        this.setTagBlacklist();
        this._updateTags();
        this.numFilesSelected = this.files.length;
        if (this.focusedFile) {
            this.focusedFile =
                this.files.find(f => f.id === this.focusedFile.id) || null;
        }
    }

    @Watch('multilineValue')
    multilineValueChanged() {
        if (this.focusedFile && this.focusedTag) {
            if (isDiff(this.focusedFile)) {
                const updated = merge(this.focusedFile, {
                    tags: {
                        [this.focusedTag]: this.multilineValue,
                    },
                });
                this.fileManager.recent.addFileDiff(updated, true);
            } else {
                this.fileManager.recent.addTagDiff(
                    `${this.focusedFile.id}_${this.focusedTag}`,
                    this.focusedTag,
                    this.multilineValue
                );
                this.fileManager.helper.updateFile(this.focusedFile, {
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

    async toggleFile(file: AuxObject) {
        await this.fileManager.selection.selectFile(file);
    }

    async deleteFile(file: AuxObject) {
        await this.fileManager.helper.destroyFile(file);
    }

    async createFile() {
        const id = await this.fileManager.helper.createFile();
        const file = this.fileManager.helper.filesState[id];
        this.fileManager.selection.selectFile(file, true);
    }

    addTag(placement: NewTagPlacement = 'top') {
        if (this.isMakingNewTag) {
            // Check to make sure that the tag is unique.
            if (this.tagExists(this.newTag)) {
                var options = new AlertDialogOptions();
                options.title = 'Tag already exists';
                options.body =
                    "Tag '" + this.newTag + "' already exists on this file.";
                options.confirmText = 'Close';

                // Emit dialog event.
                EventBus.$emit('showAlertDialog', options);
                return;
            }

            if (this.newTagPlacement === 'top') {
                this.addedTags.unshift(this.newTag);
                this.tags.unshift(this.newTag);
            } else {
                this.addedTags.push(this.newTag);
                this.tags.push(this.newTag);
            }

            const table = this.$refs.table as HTMLElement;
            if (table) {
                table.scrollIntoView({
                    block: this.newTagPlacement === 'top' ? 'start' : 'end',
                    inline: 'start',
                });
            }
        } else {
            this.newTag = '';
            this.newTagPlacement = placement;
        }
        this.isMakingNewTag = !this.isMakingNewTag;
    }

    closeWindow() {
        this.$emit('closeWindow');
    }

    cancelNewTag() {
        this.isMakingNewTag = false;
    }

    clearSearch() {
        this.fileManager.filePanel.search = '';
    }

    async clearSelection() {
        await this.fileManager.selection.clearSelection();
    }

    async multiSelect() {
        await this.fileManager.selection.setSelectedFiles(this.files);
    }

    async downloadFiles() {
        if (this.hasFiles) {
            const atoms = this.files.map(f => f.metadata.ref);
            const weave = this.fileManager.aux.tree.weave.subweave(...atoms);
            const stored = storedTree(
                this.fileManager.aux.tree.site,
                this.fileManager.aux.tree.knownSites,
                weave.atoms
            );
            let tree = new AuxCausalTree(stored);
            await tree.import(stored);

            downloadAuxState(tree, `selection-${Date.now()}`);
        }
    }

    onTagChanged(file: AuxObject, tag: string, value: string) {
        this.lastEditedTag = this.focusedTag = tag;
        this.focusedFile = file;
        this.multilineValue = value;
        this.isFocusedTagFormula = isFormula(value);
    }

    onTagFocusChanged(file: AuxObject, tag: string, focused: boolean) {
        if (focused) {
            this.focusedFile = file;
            this.focusedTag = tag;
            this.multilineValue = this.focusedFile.tags[this.focusedTag];
            this.isFocusedTagFormula = isFormula(this.multilineValue);

            this.$nextTick(() => {
                (<any>this.$refs.multiLineEditor).applyStyles();
            });
        }
        this.$emit('tagFocusChanged', file, tag, focused);
    }

    onFileClicked(file: AuxObject) {
        this.fileManager.helper.transaction(tweenTo(file.id));
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

        this.setTagBlacklist();
        this._updateTags();
    }

    tagHasValue(tag: string): boolean {
        return some(this.files, f => hasValue(f.tags[tag]));
    }

    isHiddenTag(tag: string): boolean {
        return isHiddenTag(tag);
    }

    tagExists(tag: string): boolean {
        return this.tags.indexOf(tag, 0) !== -1;
    }

    newTagValidityUpdated(valid: boolean) {
        this.newTagValid = valid;
    }

    getShortId(file: Object) {
        return getShortId(file);
    }

    getTagCellClass(file: AuxObject, tag: string) {
        return {
            focused: file === this.focusedFile && tag === this.focusedTag,
        };
    }

    async clearDiff() {
        await this.fileManager.recent.clear();
        this.fileManager.recent.selectedRecentFile = this.fileManager.recent.files[0];
    }

    constructor() {
        super();
    }

    async created() {
        this.setTagBlacklist();
        this._updateTags();
        this.numFilesSelected = this.files.length;
    }

    private _updateTags() {
        const editingTags = this.lastEditedTag ? [this.lastEditedTag] : [];
        const allExtraTags = union(this.extraTags, this.addedTags, editingTags);

        this.tags = fileTags(
            this.files,
            this.tags,
            allExtraTags,
            this.showHidden,
            this.tagBlacklist,
            this.blacklistIndex
        );
    }

    toggleBlacklistIndex(index: number) {
        this.blacklistIndex[index] = !this.blacklistIndex[index];
        this._updateTags();
    }

    setTagBlacklist() {
        let sortedArray: string[] = getAllFileTags(this.files).sort();

        let newBlacklist: string[] = [];
        let newTagCount: number[] = [];

        let current = '';
        let tagCount = 0;
        for (let i = 0; i < sortedArray.length; i++) {
            if (!sortedArray[i].includes('.')) {
                // due to alphabetical order, if there is no dot, then it is portentially the start of a new section

                current = sortedArray[i];
                tagCount = 1;
            } else {
                let currentSection = sortedArray[i].split('.');

                if (current === '') {
                    current = sortedArray[i];
                    tagCount = 1;
                } else if (
                    !current.includes('.') &&
                    currentSection[0] != current
                ) {
                    current = sortedArray[i];
                    tagCount = 1;
                } else if (currentSection[0] != current.split('.')[0]) {
                    current = sortedArray[i];
                    tagCount = 1;
                } else {
                    current += '.~' + sortedArray[i];
                    tagCount++;

                    if (tagCount == 3) {
                        newBlacklist.push(current.split('.')[0]);
                        newTagCount.push(3);
                    } else if (tagCount > 3) {
                        newTagCount[newTagCount.length - 1]++;
                    }
                }
            }
        }

        if (newBlacklist.length > 0) {
            newBlacklist.unshift('*');
            newTagCount.unshift(0);
        }

        if (
            (this.blacklistIndex === undefined && newBlacklist.length > 0) ||
            newBlacklist.length > this.blacklistIndex.length
        ) {
            for (let i = 0; i < newBlacklist.length; i++) {
                if (i === 0) {
                    this.blacklistIndex.push(true);
                } else {
                    this.blacklistIndex.push(false);
                }
            }
        }

        this.tagBlacklist = newBlacklist;
        this.blacklistCount = newTagCount;
    }

    getTagBlacklist(): string[] {
        return this.tagBlacklist;
    }
}

/**
 * Defines a set of valid positions that a new tag can be positioned at in the list.
 */
export type NewTagPlacement = 'top' | 'bottom';
