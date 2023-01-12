import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class Hotkey extends Vue {
    @Prop() keys: string[];
    @Prop({ default: false }) prevent: boolean;
    @Prop({ default: false }) stop: boolean;

    get realKeys(): string[] {
        // if (isMac()) {
        //     return this.keys.map(k => (k === 'ctrl' ? 'meta' : k));
        // }
        return this.keys;
    }

    trigger(e: any) {
        console.log('hotkey', e);
        this.$emit('triggered');
    }

    constructor() {
        super();
    }
}
