import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { Bot, toast } from '@casual-simulation/aux-common';
import { copyToClipboard } from '../../SharedUtils';
import { appManager } from '../../AppManager';

@Component({
    components: {},
})
export default class BotID extends Vue {
    @Prop() tag: string;

    /**
     * Whether the tag is allowed to be dragged from the bot table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    @Prop()
    shortID: string;

    @Prop()
    bots: Bot;

    constructor() {
        super();
    }

    click() {
        this.$emit('click', this.bots.id);
    }
}
