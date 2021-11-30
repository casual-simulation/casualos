import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import {} from '@casual-simulation/aux-common';
import TagColor from '../TagColor/TagColor';

@Component({
    components: {
        'tag-color': TagColor,
    },
})
export default class BotTag extends Vue {
    @Prop() tag: string;

    @Prop({ default: false }) isScript: boolean;
    @Prop({ default: false }) isFormula: boolean;
    @Prop({ default: false }) isLink: boolean;
    @Prop({ default: null }) prefix: string;

    /**
     * Whether the tag is allowed to be dragged from the bot table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    /**
     * Whether the tag name should be rendered with a light font weight.
     */
    @Prop({ default: false })
    light: boolean;

    get isCombine() {
        return false;
    }

    constructor() {
        super();
    }
}
