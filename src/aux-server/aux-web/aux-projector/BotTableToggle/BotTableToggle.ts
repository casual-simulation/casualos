import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import { Bot, Object } from '@casual-simulation/aux-common';

@Component({
    components: {},
})
export default class BotTableToggle extends Vue {
    @Prop() bots: Object[];
    @Prop({ default: false })
    raised: boolean;
    @Prop({ default: true })
    showNumBots: boolean;
    numBotsSelected: number = 0;

    @Watch('bots')
    botsChanged() {
        this.numBotsSelected = this.bots.length;
    }

    click() {
        this.$emit('click');
    }

    constructor() {
        super();
    }

    async created() {
        this.numBotsSelected = this.bots.length;
    }
}
