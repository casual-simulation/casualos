import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch } from 'vue-property-decorator';
import { Object, UserMode, DEFAULT_USER_MODE} from 'common/Files';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import FileTable from '../FileTable/FileTable';
import { ContextMenuEvent } from '../interaction/ContextMenu';
import { SubscriptionLike } from 'rxjs';
import { cloneDeep } from 'lodash';
import { getUserMode } from 'common/Files/FileCalculations';
import { tap } from 'rxjs/operators';

@Component({
    components: {
        'game-view': GameView,
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
    updateTime: number = -1;
    numFilesSelected: number = 0;
    mode: UserMode = DEFAULT_USER_MODE;

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

    get filesMode() { return this.mode === 'files'; }
    get workspacesMode() { return this.mode === 'worksurfaces'; }

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    clearSelection() {
        this.fileManager.clearSelection();
    }

    @Watch('files')
    onFilesChanged(newValue: Object[]) {
        this.numFilesSelected = newValue.length;
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

        this.open();

        this._subs = [];
        this.files = [];
        this.tags = [];
        this.updateTime = -1;
        this.numFilesSelected = 0;

        this._subs.push(this.fileManager.selectedFilesUpdated.subscribe(event => {
            this.files = event.files;
            const now = Date.now();
            this.updateTime = now;
        }));

        this._subs.push(this.fileManager.fileChanged(this.fileManager.userFile)
            .pipe(tap(file => {
                this.mode = getUserMode(<Object>file);
            }))
            .subscribe());

        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};