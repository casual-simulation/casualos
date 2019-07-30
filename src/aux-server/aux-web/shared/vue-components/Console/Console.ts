import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { messages } from '../../Console';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import ConsoleMessage from '../ConsoleMessage/ConsoleMessage';

@Component({
    components: {
        'console-message': ConsoleMessage,
    },
})
export default class Console extends Vue {
    private _sub: Subscription;

    consoleMessages: ConsoleMessages[];
    sources: string[];
    selectedSources: string[];

    get filteredMessages() {
        return this.consoleMessages.filter(
            m => this.selectedSources.indexOf(m.source) >= 0
        );
    }

    constructor() {
        super();
        this.consoleMessages = [];
        this.selectedSources = [];
        this.sources = [];
    }

    close() {
        this.$emit('close');
    }

    created() {
        this._sub = messages.subscribe(m => {
            this.consoleMessages.push(m);
            if (this.sources.indexOf(m.source) < 0) {
                this.sources.push(m.source);
                if (this.selectedSources.indexOf(m.source) < 0) {
                    this.selectedSources.push(m.source);
                }
            }
        });
    }

    beforeDestroy() {
        this._sub.unsubscribe();
        this._sub = null;
    }
}
