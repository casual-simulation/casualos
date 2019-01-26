import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject } from 'vue-property-decorator';
import { Object} from 'common/Files';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import { FileManager } from '../FileManager';
import {uniq} from 'lodash';
import CubeIcon from './Cube.svg';
import FileTable from '../FileTable/FileTable';
import { ContextMenuEvent } from '../interaction/ContextMenu';
import { SubscriptionLike } from 'rxjs';
import { fileTags } from 'common/Files/FileCalculations';

@Component({
    components: {
        'game-view': GameView,
        'cube-icon': CubeIcon,
        'file-table': FileTable
    }
})
export default class Home extends Vue {

    debug: boolean = false;

    contextMenuStyle: any = {
        left: '0px',
        top: '0px'
    };
    
    isOpen: boolean = false;
    contextMenuVisible: boolean = false;
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

    get dev() {
        return !PRODUCTION;
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
        // TODO: Make the user have to drag a workspace onto the world
        // instead of just clicking a button and a workspace being placed somewhere.
        this.fileManager.createWorkspace();
    }

    toggleDebug() {
        this.debug = !this.debug;
    }

    clearSelection() {
        this.fileManager.clearSelection();
    }

    handleContextMenu(event: ContextMenuEvent) {
        // Force the component to disable current context menu.
        this.context = null;
        this.contextMenuVisible = false;

        // Wait for the DOM to update with the above values and then show context menu again.
        this.$nextTick(() => {
            this.context = event;
            this.contextMenuStyle.left = event.pagePos.x + 'px';
            this.contextMenuStyle.top = event.pagePos.y + 'px';
            this.contextMenuVisible = true;
        });
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