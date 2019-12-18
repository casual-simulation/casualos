import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import {} from '@casual-simulation/aux-common';
import CombineIcon from '../../public/icons/combine_icon.svg';
import { getColorForTags } from '../../scene/ColorUtils';
import TagColor from '../TagColor/TagColor';

@Component({
    components: {
        'combine-icon': CombineIcon,
        'tag-color': TagColor,
    },
})
export default class BotTag extends Vue {
    @Prop() tag: string;

    @Prop({ default: false }) isScript: boolean;

    /**
     * Whether the tag is allowed to be dragged from the bot table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    get isCombine() {
        return false;
    }

    constructor() {
        super();
    }
}
