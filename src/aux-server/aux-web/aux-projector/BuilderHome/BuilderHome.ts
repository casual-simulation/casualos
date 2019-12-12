import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch, Provide, Prop } from 'vue-property-decorator';
import {
    Bot,
    SelectionMode,
    DEFAULT_SELECTION_MODE,
    getSelectionMode,
    isBot,
} from '@casual-simulation/aux-common';
import BuilderGameView from '../BuilderGameView/BuilderGameView';
import BotTable from '../BotTable/BotTable';
import ColorPicker from '../ColorPicker/ColorPicker';
import { ContextMenuEvent } from '../../shared/interaction/ContextMenuEvent';
import TagEditor from '../TagEditor/TagEditor';
import { SubscriptionLike } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import BotTableToggle from '../BotTableToggle/BotTableToggle';
import { EventBus } from '../../shared/EventBus';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
        'game-view': BuilderGameView,
        'bot-table': BotTable,
        'color-picker': ColorPicker,
        'tag-editor': TagEditor,
        'bot-table-toggle': BotTableToggle,
    },
})
export default class BuilderHome extends Vue {
    @Provide() home = this;

    debug: boolean = false;

    contextMenuStyle: any = {
        left: '0px',
        top: '0px',
    };

    @Prop() channelId: string;
    contextMenuVisible: boolean = false;
    contextMenuEvent: ContextMenuEvent = null;
    status: string = '';
    bots: Bot[] = [];
    searchResult: any = null;
    isSearch: boolean = false;
    setLargeSheet: boolean = false;
    isDiff: boolean = false;
    tags: string[] = [];
    updateTime: number = -1;
    selectionMode: SelectionMode = DEFAULT_SELECTION_MODE;
    isOpen: boolean = false;
    isVis: boolean = false;
    isLoading: boolean = false;
    progress: number = 0;
    progressMode: 'indeterminate' | 'determinate' = 'determinate';
    private _simulation: BrowserSimulation;

    getUIHtmlElements(): HTMLElement[] {
        const table = <BotTable>this.$refs.table;
        if (table) {
            return table.uiHtmlElements();
        }
        return [];
    }

    get hasBots() {
        return this.bots && this.bots.length > 0;
    }

    get singleSelection() {
        return this.selectionMode === 'single' && this.bots.length > 0;
    }

    toggleSheetSize() {
        this.setLargeSheet = !this.setLargeSheet;
    }

    getSheetStyleEditor(): any {
        if (this.setLargeSheet) return { 'max-height': '100% !important' };
        else return {};
    }

    getSheetStyleCard(): any {
        if (this.setLargeSheet) return { 'max-width': '100% !important' };
        else return {};
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

    hideContextMenu() {
        this.contextMenuVisible = false;
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot);
    }

    constructor() {
        super();
    }

    @Watch('channelId')
    async channelIdChanged() {
        await appManager.setPrimarySimulation(this.channelId);
    }

    async created() {
        this.isLoading = true;
        await appManager.setPrimarySimulation(this.channelId);

        appManager.whileLoggedIn((user, botManager) => {
            let subs = [];
            this._simulation = appManager.simulationManager.primary;
            this.isOpen = false;
            this.isVis = true;
            this.bots = [];
            this.tags = [];
            this.updateTime = -1;

            subs.push(
                this._simulation.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                    this.isDiff = e.isDiff;
                    this.searchResult = e.searchResult;
                    this.isSearch = e.isSearch;
                    const now = Date.now();
                    this.updateTime = now;
                }),
                this._simulation.botPanel.isOpenChanged.subscribe(open => {
                    this.isOpen = open;
                }),
                this._simulation.botPanel.isVisChanged.subscribe(vis => {
                    this.isVis = vis;
                })
            );

            subs.push(
                userBotChanged(this._simulation)
                    .pipe(
                        tap(bot => {
                            let previousSelectionMode = this.selectionMode;
                            this.selectionMode = getSelectionMode(bot);
                        })
                    )
                    .subscribe()
            );

            this.isLoading = false;
            this._setStatus('Waiting for input...');
            return subs;
        });

        EventBus.$on('toggleSheetSize', this.toggleSheetSize);
    }

    destroyed() {}

    private _setStatus(status: string) {
        this.status = status;
        console.log('[BuilderHome] Status:', status);
    }
}
