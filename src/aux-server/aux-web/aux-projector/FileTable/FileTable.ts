import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Prop, Inject, Watch} from 'vue-property-decorator';
import { some, union } from 'lodash';
import {File, Object, fileTags, isHiddenTag} from '@yeti-cgi/aux-common';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../../shared/AppManager';

import FileRow from '../FileRow/FileRow';
import TagEditor from '../TagEditor/TagEditor';
import AlertDialogOptions from '../App/DialogOptions/AlertDialogOptions';
import FileTag from '../FileTag/FileTag';
import FileTableToggle from '../FileTableToggle/FileTableToggle';

@Component({
    components: {
        'file-row': FileRow,
        'file-tag': FileTag,
        'tag-editor': TagEditor,
        'file-table-toggle': FileTableToggle
    },
    
})
export default class FileTable extends Vue {
    
    @Prop() files: Object[];
    @Prop({ default: (() => <any>[]) }) extraTags: string[];
    @Prop({ default: false }) readOnly: boolean;

    /**
     * A property that can be set to indicate to the table that its values should be updated.
     */
    @Prop({}) updateTime: number;
    tags: string[] = [];
    addedTags: string[] = [];
    lastEditedTag: string = null;
    isMakingNewTag: boolean = false;
    isMakingNewAction: boolean = false;
    newTag: string = 'myNewTag';
    newTagValid: boolean = true;
    numFilesSelected: number = 0;
    
    get fileManager() {
        return appManager.fileManager;
    }

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    get newTagExists() {
        return this.tagExists(this.newTag);
    }

    @Watch('files')
    filesChanged() {
        const editingTags = this.lastEditedTag ? [this.lastEditedTag] : [];
        const allExtraTags = union(this.extraTags, this.addedTags, editingTags);
        this.tags = fileTags(
            this.files, 
            this.tags, 
            allExtraTags);
        this.numFilesSelected = this.files.length;
    }

    addTag(isAction: boolean = false) {
        if (this.isMakingNewTag) {

            // Check to make sure that the tag is unique.
            if (this.tagExists(this.newTag)) {
                var options = new AlertDialogOptions();
                options.title = 'Tag already exists';
                options.body = 'Tag \'' + this.newTag + '\' already exists on this file.';
                options.confirmText = "Close";

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
                    inline: 'start'
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

    clearSelection() {
        this.fileManager.clearSelection();
    }

    onTagChanged(tag: string) {
        this.lastEditedTag = tag;
    }

    onTagFocusChanged(event: { file: Object, tag: string, focused: boolean }) {
        this.$emit('tagFocusChanged', event);
    }

    removeTag(tag: string) {
        if (tag === this.lastEditedTag || tag === this.newTag) {
            this.lastEditedTag = null;
            this.tags = fileTags(this.files, this.tags, this.extraTags);
        }
        const index = this.addedTags.indexOf(tag);
        if (index >= 0) {
            this.addedTags.splice(index, 1);
        }
    }

    tagHasValue(tag: string): boolean {
        return some(this.files, f => f.tags[tag]);
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

    constructor() {
        super();
    }

    async created() {
        this.tags = fileTags(this.files, this.tags, this.lastEditedTag ? [this.lastEditedTag, ...this.extraTags] : this.extraTags);
        this.numFilesSelected = this.files.length;
    }
};