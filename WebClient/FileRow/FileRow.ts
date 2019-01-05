import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { FileManager } from 'WebClient/FileManager';
import { SubscriptionLike } from 'rxjs';
import {Object, File} from 'common/Files';
import FileValue from '../FileValue/FileValue';

const numLoadingSteps: number = 4;

@Component({
    inject: {
        fileManager: 'fileManager'
    },
    components: {
        'file-value': FileValue
    }
})
export default class FileRow extends Vue {
    @Prop() file: Object;
    @Prop() tags: string[];

    @Inject() fileManager!: FileManager;

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

    tagFocusChanged(file: Object, tag: string, focused: boolean) {
        this.$emit('tagFocusChanged', {
            file,
            tag,
            focused
        });
    }
};