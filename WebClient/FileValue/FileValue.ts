import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { FileManager } from 'WebClient/FileManager';
import { SubscriptionLike } from 'rxjs';
import {Object, File} from 'common';

const numLoadingSteps: number = 4;

@Component({
    inject: {
        fileManager: 'fileManager'
    },
    watch: {
        file: function(newFile: Object, oldFile: Object) {
            const _this: FileRow = this;
            this.value = _this.fileManager.calculateFileValue(this.file, this.tag);
        },
        tag: function(newTag: string, oldTag: string) {
            const _this: FileRow = this;
            this.value = _this.fileManager.calculateFileValue(this.file, this.tag);
        },
    }
})
export default class FileRow extends Vue {
    @Prop() file: Object;
    @Prop() tag: string;
    value: string = '';

    @Inject() fileManager!: FileManager;

    private _sub: SubscriptionLike;

    constructor() {
        super();
    }

    valueChanged(file: File, tag: string, value: string) {
        if (file.type === 'object') {
            (<any>this.$parent.$parent).lastEditedTag = tag;
            this.fileManager.updateFile(file, {
                tags: {
                    [tag]: value
                }
            });
        }
    }

    created() {
        this.value = this.fileManager.calculateFileValue(this.file, this.tag);
    }
};