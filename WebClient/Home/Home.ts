import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide} from 'vue-property-decorator';
import { some } from 'lodash';
import {File, Object} from 'common';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import { FileManager } from '../FileManager';
import { SocketManager } from '../SocketManager';
import {uniq} from 'lodash';
import CubeIcon from './Cube.svg';

import FileRow from '../FileRow/FileRow';

const numLoadingSteps: number = 4;

@Component({
    components: {
        'game-view': GameView,
        'cube-icon': CubeIcon,
        'file-row': FileRow
    }
})
export default class Home extends Vue {

    private _socketManager: SocketManager;
    @Provide('fileManager') private _fileManager: FileManager = new FileManager(appManager, this._socketManager);

    isOpen: boolean = false;
    status: string = '';
    files: Object[] = [];
    selected: boolean[] = [];
    tags: string[] = [];
    hiddenTags: string[] = [
        '_selected'
    ];
    lastEditedTag: string = null;
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';

    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    addNewFile() {
        this._fileManager.createFile();
    }

    addNewWorkspace() {
        this._fileManager.createWorkspace();
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
        this._fileManager.clearSelection();
    }

    onTagChanged(tag: string) {
        this.lastEditedTag = tag;
    }

    removeTag(tag: string) {
        if (tag === this.lastEditedTag || tag === this.newTag) {
            this.lastEditedTag = null;
            this.tags = this._fileManager.fileTags(this.files, this.tags, [], this.hiddenTags);
        }
    }

    tagHasValue(tag: string): boolean {
        return some(this.files, f => f.tags[tag]);
    }

    constructor() {
        super();
    }

    beforeCreate() {
        this._socketManager = new SocketManager();
        this._fileManager = new FileManager(appManager, this._socketManager);
    }

    async created() {
        this.isLoading = true;

        await this._fileManager.init();

        EventBus.$on('openInfoCard', this.open);
        this.open();

        this.files = [];
        this.tags = [];

        this._fileManager.selectedFilesUpdated.subscribe(event => {
            this.files = event.files;
            this.selected = this.files.map(f => true);
            if (this.files.length > 0) {
                this.isOpen = true;
            }
            this.tags = this._fileManager.fileTags(this.files, this.tags, this.lastEditedTag ? [this.lastEditedTag] : [], this.hiddenTags);
        });

        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    provide() {
        return {
            fileManager: this._fileManager
        };
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};