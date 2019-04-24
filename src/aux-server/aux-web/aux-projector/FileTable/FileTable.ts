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
    searchFileState,
    SandboxResult,
    isFile,
    isDiff,
    merge,
    SelectionMode,
    tweenTo,
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

@Component({
    components: {
        'file-value': FileValue,
        'file-tag': FileTag,
        'tag-editor': TagEditor,
        'file-table-toggle': FileTableToggle,
        'tree-view': TreeView,
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
    isMakingNewAction: boolean = false;
    newTag: string = 'myNewTag';
    newTagValid: boolean = true;
    numFilesSelected: number = 0;
    viewMode: 'rows' | 'columns' = 'columns';
    showHidden: boolean = false;
    isSearching: boolean = false;

    uiHtmlElements(): HTMLElement[] {
        if (this.$refs.tags) {
            return (<FileTag[]>this.$refs.tags)
                .filter(t => t.allowCloning)
                .map(t => t.$el);
        } else {
            return [];
        }
    }

    get fileTableGridStyle() {
        const sizeType = this.viewMode === 'rows' ? 'columns' : 'rows';
        if (this.tags.length === 0) {
            return {
                [`grid-template-${sizeType}`]: `auto auto`,
            };
        }
        return {
            [`grid-template-${sizeType}`]: `auto auto repeat(${
                this.tags.length
            }, auto)`,
        };
    }

    get fileManager() {
        return appManager.fileManager;
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
                this.fileManager.updateFile(this.focusedFile, {
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

    async addSearch() {
        // let files = this.getFileSearchResults();
        // if (files && files.length > 0) {
        //     await this.fileManager.selection.setSelectedFiles(files);
        // }
        // this.cancelSearch();
    }

    addTag(isAction: boolean = false) {
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

            this.addedTags.unshift(this.newTag);
            this.tags.unshift(this.newTag);

            const table = this.$refs.table as HTMLElement;
            if (table) {
                table.scrollIntoView({
                    block: 'start',
                    inline: 'start',
                });
            }
        } else {
            this.newTag = '';
        }
        this.isMakingNewTag = !this.isMakingNewTag;
        this.isMakingNewAction = isAction && this.isMakingNewTag;
    }

    closeWindow() {
        this.$emit('closeWindow');
    }

    cancelNewTag() {
        this.isMakingNewTag = false;
        this.isMakingNewAction = false;
    }

    async clearSelection() {
        await this.fileManager.selection.clearSelection();
        this.$emit('selectionCleared');
    }

    async multiSelect() {
        await this.fileManager.selection.setSelectedFiles(this.files);
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
        this.fileManager.transaction(tweenTo(file.id));
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
            this.showHidden
        );
    }
}
