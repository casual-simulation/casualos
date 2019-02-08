import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch } from 'vue-property-decorator';
import { Object, File, UserMode, DEFAULT_USER_MODE, Workspace} from 'common/Files';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import FileTable from '../FileTable/FileTable';
import ColorPicker from '../ColorPicker/ColorPicker';
import { ContextMenuEvent } from '../interaction/ContextMenuEvent';
import TagEditor from '../TagEditor/TagEditor';
import { SubscriptionLike } from 'rxjs';
import { cloneDeep } from 'lodash';
import { getUserMode } from 'common/Files/FileCalculations';
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
    
    isOpen: boolean = false;
    contextMenuVisible: boolean = false;
    contextMenuEvent: ContextMenuEvent = null;
    status: string = '';
    files: Object[] = [];
    tags: string[] = [];
    updateTime: number = -1;
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


    toggleOpen() {
        this.isOpen = !this.isOpen;
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

    tagFocusChanged({ file, tag, focused }: { file: Object, tag: string, focused: boolean }) {
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
        this.updateTime = -1;

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