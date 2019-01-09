import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { isFilterTag, parseFilterTag } from 'common/Files/FileCalculations';
import { SubscriptionLike } from 'rxjs';
import {Object, File} from 'common/Files';
import {invertColor, colorConvert} from '../utils';
import {assign} from 'lodash';


@Component({
})
export default class FileTag extends Vue {
    @Prop() tag: string;

    get filterData() {
        return parseFilterTag(this.tag);
    }

    get isFilter() {
        return isFilterTag(this.tag);
    }

    constructor() {
        super();
    }
};