import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { isFormula, Bot, isScript } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SubscriptionLike } from 'rxjs';
import { appManager } from '../../AppManager';
import BotTag from '../BotTag/BotTag';
import { isFocused } from '../VueHelpers';

@Component({
    components: {
        'bot-tag': BotTag,
    },
})
export default class SimpleTagEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) bot: Bot;

    tagValue: any = '';

    private _simulation: BrowserSimulation;
    private _sub: SubscriptionLike;

    get isTagFormula(): boolean {
        return isFormula(this.tagValue);
    }

    get isTagScript(): boolean {
        return isScript(this.tagValue);
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
    }

    @Watch('bot')
    botChanged() {
        this._updateValue();
    }

    @Watch('tagValue')
    valueChanged() {
        let bot = this.bot;
        let tag = this.tag;
        let value = this.tagValue;
        this._updateBot(bot, tag, value);
    }

    created() {
        this._sub = appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [];
        });
        this._updateValue();
    }

    destroyed() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    private _updateBot(bot: Bot, tag: string, value: any) {
        if (!isFocused(this.$el as HTMLElement)) {
            return;
        }
        this._simulation.editBot(bot, tag, value);
    }

    private _updateValue() {
        if (isFocused(this.$el as HTMLElement)) {
            return;
        }

        if (this.tag && this.bot) {
            this.tagValue = this.bot.tags[this.tag];
        } else {
            this.tagValue = '';
        }
    }
}
