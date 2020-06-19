import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import { Bot, hasValue, BotTags } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import BotTable from '../BotTable/BotTable';
import { SubscriptionLike } from 'rxjs';

@Component({
    components: {
        'bot-table': BotTable,
    },
})
export default class BotSheet extends Vue {
    bots: Bot[] = [];
    dimension: string = '';
    isDiff: boolean = false;
    updateTime: number = -1;
    hasPortal: boolean = false;
    showNewBot: boolean = true;

    private _simulation: BrowserSimulation;

    constructor() {
        super();
    }

    created() {
        appManager.whileLoggedIn((user, botManager) => {
            let subs: SubscriptionLike[] = [];
            this._simulation = appManager.simulationManager.primary;
            this.bots = [];
            this.updateTime = -1;

            subs.push(
                this._simulation.botPanel.botsUpdated.subscribe(e => {
                    this.bots = e.bots;
                    this.isDiff = e.isDiff;
                    this.hasPortal = e.hasPortal;
                    this.dimension = e.dimension;
                    this.showNewBot = !e.isSingleBot;
                    const now = Date.now();
                    this.updateTime = now;
                })
            );
            return subs;
        });
    }

    tagFocusChanged(bot: Bot, tag: string, focused: boolean) {
        this._simulation.helper.setEditingBot(bot);
    }

    exitSheet() {
        const pagePortal = this._simulation.helper.userBot.values.pagePortal;
        let tags: BotTags = {
            sheetPortal: null,
        };
        if (!hasValue(pagePortal)) {
            tags.pagePortal = this.dimension;
        }
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: tags,
        });
    }

    goToTag(tag: string) {
        this._simulation.helper.updateBot(this._simulation.helper.userBot, {
            tags: {
                sheetPortal: tag,
            },
        });
    }
}
