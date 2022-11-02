import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import {} from '@casual-simulation/aux-common';
import TagColor from '../TagColor/TagColor';
import HighlightedText from '../HighlightedText/HighlightedText';

@Component({
    components: {
        'tag-color': TagColor,
        'highlighted-text': HighlightedText,
    },
})
export default class BotTag extends Vue {
    @Prop() tag: string;
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

    /**
     * The part of the tag that should be highlighted.
     */
    @Prop({ required: false, default: null })
    highlight: {
        startIndex: number;
        endIndex: number;
    };

    get isCombine() {
        return false;
    }

    get isScript() {
        return this.prefix === '@';
    }

    emitClick() {
        this.$emit('click');
    }

    constructor() {
        super();
    }
}
