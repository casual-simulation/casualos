import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Inject} from 'vue-property-decorator';
import { some } from 'lodash';
import {File, Object} from 'common';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import { FileManager } from '../FileManager';
import { SocketManager } from '../SocketManager';
import {uniq} from 'lodash';
import CubeIcon from './Cube.svg';

import FileTable from '../FileTable/FileTable';
import { editor } from 'monaco-editor';

const numLoadingSteps: number = 4;

@Component({
    components: {
        'game-view': GameView,
        'cube-icon': CubeIcon,
        'file-table': FileTable
    },
    inject: {
        fileManager: 'fileManager'
    }
})
export default class Home extends Vue {

    @Inject() private fileManager: FileManager;

    isOpen: boolean = false;
    status: string = '';
    files: Object[] = [];

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
        this.fileManager.createFile();
    }

    addNewWorkspace() {
        this.fileManager.createWorkspace();
    }

    clearSelection() {
        this.fileManager.clearSelection();
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;

        await this.fileManager.init();

        EventBus.$on('openInfoCard', this.open);
        this.open();

        this.files = [];

        this.fileManager.selectedFilesUpdated.subscribe(event => {
            this.files = event.files;
            const editorOpenTime = this.fileManager.userFile.tags._editorOpenTime;
            const now = Date.now();

            // TODO: Fix to support different time zones
            // (like if the user is using two PCs but with different time zones set)
            if (!editorOpenTime || editorOpenTime <= 0 || (now - editorOpenTime) > 5000) {
                if (this.files.length > 0) {
                    this.isOpen = true;
                }
            }
        });

        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};