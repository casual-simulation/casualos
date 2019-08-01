import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { isMac } from '../../SharedUtils';

@Component({
    components: {},
})
export default class Hotkey extends Vue {
    @Prop() keys: string[];

    get realKeys(): string[] {
        if (isMac()) {
            return this.keys.map(k => (k === 'ctrl' ? 'meta' : k));
        }
        return this.keys;
    }

    trigger() {
        this.$emit('triggered');
    }

    constructor() {
        super();
    }
}
