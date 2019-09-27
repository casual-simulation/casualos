import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch, Provide } from 'vue-property-decorator';
import { EventBus } from '../../shared/EventBus';
import {
    Bot,
    getShortId,
    formatValue,
    UserMode,
    DEFAULT_USER_MODE,
    isDiff,
    tagsOnBot,
} from '@casual-simulation/aux-common';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';
import { BuilderSimulation3D } from '../scene/BuilderSimulation3D';
import BuilderGameView from '../BuilderGameView/BuilderGameView';
import MiniFile from '../MiniFile/MiniFile';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import Cube from '../public/icons/Cube.svg';
import CubeSearch from '../public/icons/CubeSearch.svg';

@Component({
    components: {
        'mini-bot': MiniFile,
        'cube-icon': Cube,
        'cubeSearch-icon': CubeSearch,
    },
})
export default class FileSearch extends Vue {
    isOpen: boolean = false;
    bots: Bot[] = [];
    recentFiles: Bot[] = [];
    selectedRecentBot: Bot = null;
    search: string = '';

    protected _gameView: BuilderGameView;

    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    mode: UserMode = DEFAULT_USER_MODE;

    toggleOpen() {
        appManager.simulationManager.primary.botPanel.toggleOpen();
    }

    async executeSearch() {
        await appManager.simulationManager.primary.helper.formulaBatch([
            this.search,
        ]);
    }

    @Watch('search')
    onSearchChanged() {
        appManager.simulationManager.primary.botPanel.search = this.search;
        appManager.simulationManager.primary.botPanel.isOpen = true;
    }

    get placeholder() {
        if (this.bots.length > 0) {
            let val = formatValue(this.bots);

            if (!this.bots.every(f => this.isEmptyOrDiff(f))) {
                if (val.length > 50) {
                    val = val.substring(0, 50) + '..';
                }
                return val;
            } else {
                return 'Search / Run';
            }
        } else {
            return 'Search / Run';
        }
    }

    constructor() {
        super();
    }

    get filesLength() {
        let num = 0;
        let temp = this.bots.length;
        if (temp !== 1) {
            num = this.bots.length;
        } else {
            if (this.isEmptyOrDiff(this.bots[0])) {
                num = 0;
            } else {
                num = 1;
            }
        }

        return num;
    }

    get filesMode() {
        return this.mode === 'bots';
    }

    uiHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.fileQueue];
    }

    mounted() {
        appManager.whileLoggedIn((user, fileManager) => {
            this.recentFiles = fileManager.recent.bots;
            this.selectedRecentBot = fileManager.recent.selectedRecentBot;

            let subs: SubscriptionLike[] = [];
            subs.push(
                fileManager.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                }),
                fileManager.botPanel.isOpenChanged.subscribe(open => {
                    this.isOpen = open;
                }),
                fileManager.botPanel.searchUpdated.subscribe(search => {
                    this.search = search;
                }),
                fileManager.recent.onUpdated.subscribe(() => {
                    this.recentFiles = fileManager.recent.bots;
                    this.selectedRecentBot =
                        fileManager.recent.selectedRecentBot;
                })
            );
            return subs;
        });
    }

    isEmptyOrDiff(f: Bot): boolean {
        return isDiff(null, f) || tagsOnBot(f).length === 0;
    }

    startSearch() {
        const search = <Vue>this.$refs.searchInput;
        if (search) {
            search.$el.focus();
        }
    }
}
