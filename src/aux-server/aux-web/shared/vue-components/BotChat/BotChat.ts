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
    ON_CHAT_ACTION_NAME,
    onChatArg,
    ON_CHAT_TYPING_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';

@Component({
    components: {},
})
export default class BotChat extends Vue {
    text: string = '';

    @Prop({ default: null }) prefill: string;

    private _updatingText: boolean = false;

    async sendMessage() {
        await this._ignoreTextUpdates(async text => {
            this.text = '';
            await appManager.simulationManager.primary.helper.action(
                ON_CHAT_ACTION_NAME,
                null,
                onChatArg(text)
            );
        });
    }

    @Watch('text')
    async onTextUpdated() {
        if (!this._updatingText) {
            await appManager.simulationManager.primary.helper.action(
                ON_CHAT_TYPING_ACTION_NAME,
                null,
                onChatArg(this.text)
            );
        }
    }

    async setPrefill(prefill: string) {
        await this._ignoreTextUpdates(async text => {
            if (!prefill) {
                return;
            }
            if (!hasValue(this.text)) {
                this.text = prefill;
            }
        });
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

    private async _ignoreTextUpdates(action: (text: string) => Promise<void>) {
        try {
            this._updatingText = true;
            await action(this.text);
        } finally {
            this._updatingText = false;
        }
    }
}
