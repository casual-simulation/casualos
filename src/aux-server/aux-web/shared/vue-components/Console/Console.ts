import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { messages, ConsoleMessages } from '../../Console';
import ConsoleMessage from '../ConsoleMessage/ConsoleMessage';

@Component({
    components: {
        'console-message': ConsoleMessage,
    },
})
export default class Console extends Vue {
    private _sub: Subscription;

    consoleMessages: ConsoleMessages[];

    constructor() {
        super();
        this.consoleMessages = [];
    }

    close() {
        this.$emit('close');
    }

    created() {
        this._sub = messages.subscribe(m => {
            this.consoleMessages.push(m);
        });
    }

    beforeDestroy() {
        this._sub.unsubscribe();
        this._sub = null;
    }
}
