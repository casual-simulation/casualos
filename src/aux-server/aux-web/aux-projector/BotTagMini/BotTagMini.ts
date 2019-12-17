import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import { AuxBot } from '@casual-simulation/aux-common';
import MiniBot from '../MiniBot/MiniBot';

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

    @Prop()
    bots: AuxBot;

    constructor() {
        super();
    }
}
