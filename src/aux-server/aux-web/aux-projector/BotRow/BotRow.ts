import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import { SubscriptionLike } from 'rxjs';
import {
    Object,
    Bot,
    getShortId,
    AuxObject,
} from '@casual-simulation/aux-common';
import BotValue from '../BotValue/BotValue';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
        'bot-value': BotValue,
    },
})
export default class BotRow extends Vue {
    @Prop() bot: AuxObject;
    @Prop() tags: string[];
    @Prop({ default: false })
    readOnly: boolean;
    @Prop({})
    updateTime: number;
    @Prop({ default: true })
    showFormulasWhenFocused: boolean;

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    private _sub: SubscriptionLike;

    constructor() {
        super();
    }

    async toggleFile(bot: AuxObject) {
        await this.fileManager.selection.selectFile(
            bot,
            false,
            this.fileManager.botPanel
        );
    }

    onTagChanged(tag: string, value: string) {
        this.$emit('tagChanged', this.bot, tag, value);
    }

    getShortId(bot: Object) {
        return getShortId(bot);
    }

    tagFocusChanged(bot: Object, tag: string, focused: boolean) {
        this.$emit('tagFocusChanged', {
            bot,
            tag,
            focused,
        });
    }
}
