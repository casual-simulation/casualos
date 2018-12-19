import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Prop, Inject} from 'vue-property-decorator';
import { some } from 'lodash';
import {File, Object} from 'common';
import { appManager } from '../AppManager';
import { FileManager } from '../FileManager';
import { SocketManager } from '../SocketManager';

import FileRow from '../FileRow/FileRow';

const numLoadingSteps: number = 4;

@Component({
    components: {
        'file-row': FileRow
    },
    inject: {
      fileManager: 'fileManager'
    }
})
export default class FileTable extends Vue {

    private _socketManager: SocketManager;
    @Inject() private fileManager: FileManager;

    files: Object[] = [];
    tags: string[] = [];
    hiddenTags: string[] = [
        '_selected'
    ];
    lastEditedTag: string = null;
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    addTag() {
        if (this.isMakingNewTag) {
            this.tags.push(this.newTag);
        } else {
            this.newTag = 'newTag';
        }
        this.isMakingNewTag = !this.isMakingNewTag;
    }

    cancelNewTag() {
        this.isMakingNewTag = false;
    }

    clearSelection() {
        this.fileManager.clearSelection();
    }

    onTagChanged(tag: string) {
        this.lastEditedTag = tag;
    }

    removeTag(tag: string) {
        if (tag === this.lastEditedTag || tag === this.newTag) {
            this.lastEditedTag = null;
            this.tags = this.fileManager.fileTags(this.files, this.tags, [], this.hiddenTags);
        }
    }

    tagHasValue(tag: string): boolean {
        return some(this.files, f => f.tags[tag]);
    }

    constructor() {
        super();
    }

    async created() {
        await this.fileManager.init();

        this.files = [];
        this.tags = [];

        this.fileManager.selectedFilesUpdated.subscribe(event => {
            this.files = event.files;
            this.tags = this.fileManager.fileTags(this.files, this.tags, this.lastEditedTag ? [this.lastEditedTag] : [], this.hiddenTags);
        });
    }
};