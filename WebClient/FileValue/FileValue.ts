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
            _this._updateValue();
        },
        tag: function(newTag: string, oldTag: string) {
            const _this: FileRow = this;
            _this._updateValue();
        },
    }
})
export default class FileRow extends Vue {
    @Prop() file: Object;
    @Prop() tag: string;
    value: string = '';
    isFocused: boolean = false;

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

    focus() {
        this.isFocused = true;
        this._updateValue();
    }

    blur() {
        this.isFocused = false;
        this._updateValue();
    }

    created() {
        this._updateValue();
    }

    private _updateValue() {
        if (!this.isFocused) {
            this.value = this.fileManager.calculateFileValue(this.file, this.tag);
        } else {
            this.value = this.file.tags[this.tag];
        }
    }
};