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
import MiniBot from '../MiniBot/MiniBot';
import { BotRenderer } from '../../shared/scene/BotRenderer';
import Cube from '../public/icons/Cube.svg';
import CubeSearch from '../public/icons/CubeSearch.svg';

@Component({
    components: {
        'mini-bot': MiniBot,
        'cube-icon': Cube,
        'cubeSearch-icon': CubeSearch,
    },
})
export default class BotSearch extends Vue {
    isOpen: boolean = false;
    bots: Bot[] = [];
    recentBots: Bot[] = [];
    selectedRecentBot: Bot = null;
    search: string = '';

    protected _gameView: BuilderGameView;

    @Provide() botRenderer: BotRenderer = new BotRenderer();

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

    get botsLength() {
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

    get botsMode() {
        return this.mode === 'bots';
    }

    uiHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.botQueue];
    }

    mounted() {
        appManager.whileLoggedIn((user, botManager) => {
            this.recentBots = botManager.recent.bots;
            this.selectedRecentBot = botManager.recent.selectedRecentBot;

            let subs: SubscriptionLike[] = [];
            subs.push(
                botManager.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                }),
                botManager.botPanel.isOpenChanged.subscribe(open => {
                    this.isOpen = open;
                }),
                botManager.botPanel.searchUpdated.subscribe(search => {
                    this.search = search;
                }),
                botManager.recent.onUpdated.subscribe(() => {
                    this.recentBots = botManager.recent.bots;
                    this.selectedRecentBot =
                        botManager.recent.selectedRecentBot;
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
