import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch } from 'vue-property-decorator';
import { 
    Object,
    File,
    getUserMode,
    UserMode,
    SelectionMode,
    DEFAULT_USER_MODE,
    Workspace,
    AuxObject,
    DEFAULT_SELECTION_MODE,
    getSelectionMode
} from '@yeti-cgi/aux-common';
import GameView from '../GameView/GameView';
import { appManager } from '../../shared/AppManager';
import FileTable from '../FileTable/FileTable';
import ColorPicker from '../ColorPicker/ColorPicker';
import { ContextMenuEvent } from '../../shared/interaction/ContextMenuEvent';
import TagEditor from '../TagEditor/TagEditor';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import FileTableToggle from '../FileTableToggle/FileTableToggle';

@Component({
    components: {
        'game-view': GameView,
        'file-table': FileTable,
        'color-picker': ColorPicker,
        'tag-editor': TagEditor,
        'file-table-toggle': FileTableToggle
    },
})
export default class Home extends Vue {

    debug: boolean = false;

    contextMenuStyle: any = {
        left: '0px',
        top: '0px'
    };
    
    contextMenuVisible: boolean = false;
    contextMenuEvent: ContextMenuEvent = null;
    status: string = '';
    files: AuxObject[] = [];
    tags: string[] = [];
    updateTime: number = -1;
    mode: UserMode = DEFAULT_USER_MODE;
    selectionMode: SelectionMode = DEFAULT_SELECTION_MODE;
    isOpen: boolean = false;
    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";
    selectedRecentFile: File = null;

    private _subs: SubscriptionLike[] = [];

    get user() {
        return appManager.user;
    }

    get hasFiles() {
        return this.selectedFiles.length > 0;
    }

    get fileManager() {
        return appManager.fileManager;
    }

    get selectedFiles() {
        if (this.selectedRecentFile) {
            return [this.selectedRecentFile];
        } else {
            return this.files;
        }
    }

    get filesMode() { return this.mode === 'files'; }
    get workspacesMode() { return this.mode === 'worksurfaces'; }
    get singleSelection() { 
        return this.selectionMode === 'single' && this.selectedFiles.length > 0;
    }

    @Watch('singleSelection')
    onSingleSelectionChanged(selected: boolean, old: boolean) {
        if (this.selectionMode === 'single') {
            // If we went from not having a file selected
            // to selecting a file
            if (!old && selected) {
                // open the sheet
                this.isOpen = true;

                // if we went from having a file selected to not
                // having a file selected
            } else if (!selected && old) {

                // close the sheet
                this.isOpen = false;
            }
        }
    }

    async toggleOpen() {
        this.isOpen = !this.isOpen;
    }

    startSearch() {
        this.isOpen = true;
        this.$nextTick(() => {
            (<any>this.$refs.table).startSearch();
        });
    }

    onSelectionCleared() {
        this.isOpen = false;
    }

    handleContextMenu(event: ContextMenuEvent) {
        // Force the component to disable current context menu.
        this.contextMenuEvent = null;
        this.contextMenuVisible = false;

        // Wait for the DOM to update with the above values and then show context menu again.
        this.$nextTick(() => {
            this.contextMenuEvent = event;
            this.contextMenuStyle.left = event.pagePos.x + 'px';
            this.contextMenuStyle.top = event.pagePos.y + 'px';
            this.contextMenuVisible = true;
        });
    }

    tagFocusChanged(file: AuxObject, tag: string, focused: boolean) {
        this.fileManager.setEditedFile(file);
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        this.isOpen = false;

        this._subs = [];
        this.files = [];
        this.tags = [];
        this.selectedRecentFile = null;
        this.updateTime = -1;

        this._subs.push(this.fileManager.selectedFilesUpdated.subscribe(event => {
            this.files = event.files;
            const now = Date.now();
            this.updateTime = now;
        }));

        this._subs.push(this.fileManager.fileChanged(this.fileManager.userFile)
            .pipe(tap(file => {
                this.mode = getUserMode(file);

                let previousSelectionMode = this.selectionMode;
                this.selectionMode = getSelectionMode(file);
                if (previousSelectionMode !== this.selectionMode && this.selectionMode === 'multi') {
                    this.isOpen = true;
                }
            }))
            .subscribe());

        this._subs.push(this.fileManager.recent.onUpdated.subscribe(_ => {
            this.selectedRecentFile = this.fileManager.recent.selectedRecentFile;
        }));

        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};