import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { SubscriptionLike } from 'rxjs';
import {Object, File} from 'aux-common/Files';
import FileValue from '../FileValue/FileValue';
import { appManager } from '../AppManager';
import { getShortId } from 'aux-common/Files/FileCalculations';

@Component({
    components: {
        'file-value': FileValue
    }
})
export default class FileRow extends Vue {
    @Prop() file: Object;
    @Prop() tags: string[];
    @Prop({ default: false }) readOnly: boolean;
    @Prop({}) updateTime: number;

    get fileManager() {
        return appManager.fileManager;
    }

    private _sub: SubscriptionLike;

    constructor() {
        super();
    }

    toggleFile(file: Object) {
        this.fileManager.selectFile(file);
    }

    onTagChanged(tag: string) {
        this.$emit('tagChanged', tag);
    }

    getShortId(file: Object) {
        return getShortId(file);
    }

    tagFocusChanged(file: Object, tag: string, focused: boolean) {
        this.$emit('tagFocusChanged', {
            file,
            tag,
            focused
        });
    }
};