import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Provide, Prop } from 'vue-property-decorator';
import { getColorForTags } from '../../shared/scene/ColorUtils';

@Component({
    components: {},
})
export default class TagColor extends Vue {
    @Prop({ required: true })
    tag: string;

    get tagColor() {
        return getColorForTags([this.tag]);
    }

    get tagStyle() {
        return {
            'background-color': this.tagColor,
        };
    }
}
