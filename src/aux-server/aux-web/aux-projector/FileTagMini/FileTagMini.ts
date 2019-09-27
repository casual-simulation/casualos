import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
import {
    isFilterTag,
    parseFilterTag,
    COMBINE_ACTION_NAME,
    AuxFile,
} from '@casual-simulation/aux-common';
import MiniFile from '../MiniFile/MiniFile';

@Component({
    components: {
        'mini-file': MiniFile,
    },
})
export default class FileTagMini extends Vue {
    @Prop() tag: string;

    /**
     * Whether the tag is allowed to be dragged from the file table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    @Prop()
    bots: AuxFile;

    get filterData() {
        return parseFilterTag(this.tag);
    }

    get isFilter() {
        return isFilterTag(this.tag);
    }

    get isCombine() {
        if (this.isFilter) {
            const data = this.filterData;
            return data.eventName === COMBINE_ACTION_NAME;
        } else {
            return false;
        }
    }

    constructor() {
        super();
    }
}
