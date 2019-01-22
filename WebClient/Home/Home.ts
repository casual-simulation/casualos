import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Inject} from 'vue-property-decorator';
import { some } from 'lodash';
import {File, Object} from 'common/Files';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import {uniq} from 'lodash';
import CubeIcon from './Cube.svg';

import FileTable from '../FileTable/FileTable';
import { ContextMenuEvent } from '../Input';
import { SubscriptionLike } from 'rxjs';
import { fileTags } from 'common/Files/FileCalculations';

const numLoadingSteps: number = 4;

@Component({
    components: {
        'game-view': GameView,
        'cube-icon': CubeIcon,
        'file-table': FileTable
    }
})
export default class Home extends Vue {

    isOpen: boolean = false;
    contextMenuVisible: boolean = false;
    contextMenuPosX: string = '0';
    contextMenuPosY: string = '0';
    context: ContextMenuEvent = null;
    status: string = '';
    files: Object[] = [];
    tags: string[] = [];

    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";

    private _subs: SubscriptionLike[] = [];

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    get fileManager() {
        return appManager.fileManager;
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

    handleContextMenu(event: ContextMenuEvent) {
        if (event.shouldBeVisible) {
            this.context = event;
        }
        this.contextMenuVisible = event.shouldBeVisible;
        this.contextMenuPosX = event.event.pageX + 'px';
        this.contextMenuPosY = event.event.pageY + 'px';
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;

        EventBus.$on('openInfoCard', this.open);
        this.open();

        this._subs = [];
        this.files = [];
        this.tags = [];

        this._subs.push(this.fileManager.selectedFilesUpdated.subscribe(event => {
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
        }));

        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};