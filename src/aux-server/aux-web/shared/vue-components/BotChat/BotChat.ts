import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch, Provide } from 'vue-property-decorator';
import {
    Bot,
    getShortId,
    formatValue,
    tagsOnBot,
    hasValue,
    runScript,
    superShout,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';

@Component({
    components: {},
})
export default class BotChat extends Vue {
    text: string = '';

    @Prop({ default: null }) prefill: string;

    async sendMessage() {
        // TODO:
        await appManager.simulationManager.primary.helper.transaction(
            runScript(this.text)
        );
    }

    setPrefill(prefill: string) {
        if (!prefill) {
            return;
        }
        if (!hasValue(this.text)) {
            this.text = prefill;
        }
    }

    get placeholder() {
        return 'Chat';
    }

    constructor() {
        super();
    }

    uiHtmlElements(): HTMLElement[] {
        return [];
    }

    mounted() {
        this.setPrefill(this.prefill);
    }

    startChat() {
        const search = <Vue>this.$refs.searchInput;
        if (search) {
            search.$el.focus();
        }
    }
}
