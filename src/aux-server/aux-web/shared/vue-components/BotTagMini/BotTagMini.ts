import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import MiniBot from '../MiniBot/MiniBot';
import { Bot } from '@casual-simulation/aux-common';

@Component({
    components: {
        'mini-bot': MiniBot,
    },
})
export default class BotTagMini extends Vue {
    @Prop() tag: string;

    /**
     * Whether the tag is allowed to be dragged from the bot table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    /**
     * Whether the tag should create a mod when dragged.
     */
    @Prop({ default: false })
    createMod: boolean;

    @Prop()
    bots: Bot;

    click() {
        this.$emit('click');
    }

    constructor() {
        super();
    }
}
