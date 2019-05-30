import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch, Provide } from 'vue-property-decorator';
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
    getSelectionMode,
    isFile,
} from '@casual-simulation/aux-common';
import BuilderGameView from '../BuilderGameView/BuilderGameView';
import { appManager } from '../../shared/AppManager';
import FileTable from '../FileTable/FileTable';
import ColorPicker from '../ColorPicker/ColorPicker';
import { ContextMenuEvent } from '../../shared/interaction/ContextMenuEvent';
import TagEditor from '../TagEditor/TagEditor';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import FileTableToggle from '../FileTableToggle/FileTableToggle';
import { EventBus } from '../../shared/EventBus';

@Component({
    components: {
        'game-view': BuilderGameView,
        'file-table': FileTable,
        'color-picker': ColorPicker,
        'tag-editor': TagEditor,
        'file-table-toggle': FileTableToggle,
    },
})
export default class Home extends Vue {
    @Provide() home = this;

    debug: boolean = false;

    contextMenuStyle: any = {
        left: '0px',
        top: '0px',
    };

    contextMenuVisible: boolean = false;
    contextMenuEvent: ContextMenuEvent = null;
    status: string = '';
    files: AuxObject[] = [];
    searchResult: any = null;
    isSearch: boolean = false;
    isDiff: boolean = false;
    tags: string[] = [];
    updateTime: number = -1;
    mode: UserMode = DEFAULT_USER_MODE;
    selectionMode: SelectionMode = DEFAULT_SELECTION_MODE;
    isOpen: boolean = false;
    isLoading: boolean = false;
    progress: number = 0;
    progressMode: 'indeterminate' | 'determinate' = 'determinate';

    private _subs: SubscriptionLike[] = [];

    get user() {
        return appManager.user;
    }

    getUIHtmlElements(): HTMLElement[] {
        const table = <FileTable>this.$refs.table;
        if (table) {
            return table.uiHtmlElements();
        }
        return [];
    }

    get hasFiles() {
        return this.files && this.files.length > 0;
    }

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    get filesMode() {
        return this.mode === 'files';
    }

    get workspacesMode() {
        return this.mode === 'worksurfaces';
    }

    get singleSelection() {
        return this.selectionMode === 'single' && this.files.length > 0;
    }

    // @Watch('singleSelection')
    // onSingleSelectionChanged(selected: boolean, old: boolean) {
    //     if (this.selectionMode === 'single') {
    //         // If we went from not having a file selected
    //         // to selecting a file
    //         if (!old && selected) {
    //             // open the sheet
    //             this.isOpen = true;

    //             // if we went from having a file selected to not
    //             // having a file selected
    //         } else if (!selected && old) {
    //             // close the sheet
    //             this.isOpen = false;
    //         }
    //     }
    // }

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

    hideContextMenu() {
        this.contextMenuVisible = false;
    }

    tagFocusChanged(file: AuxObject, tag: string, focused: boolean) {
        this.fileManager.helper.setEditingFile(file);
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

        this._subs.push(
            this.fileManager.filePanel.filesUpdated.subscribe(e => {
                this.files = e.files;
                this.isDiff = e.isDiff;
                this.searchResult = e.searchResult;
                this.isSearch = e.isSearch;
                const now = Date.now();
                this.updateTime = now;
                // if (
                //     this.selectionMode === 'single' &&
                //     this.selectedFiles.length > 0
                // ) {
                //     this.isOpen = true;
                // }
            }),
            this.fileManager.filePanel.isOpenChanged.subscribe(open => {
                this.isOpen = open;
            })
        );

        this._subs.push(
            this.fileManager.watcher
                .fileChanged(this.fileManager.helper.userFile)
                .pipe(
                    tap(file => {
                        this.mode = getUserMode(file);

                        let previousSelectionMode = this.selectionMode;
                        this.selectionMode = getSelectionMode(file);
                        // if (
                        //     previousSelectionMode !== this.selectionMode &&
                        //     this.selectionMode === 'multi'
                        // ) {
                        //     this.isOpen = true;
                        // }
                    })
                )
                .subscribe()
        );

        this.isLoading = false;

        this._setStatus('Waiting for input...');
    }

    destroyed() {}

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
}
