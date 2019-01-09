import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import { FileManager } from 'WebClient/FileManager';
import { Object } from 'common/Files';

// TODO: Fix to work again
@Component({
    inject: {
        fileManager: 'fileManager'
    }
})
export default class Editor extends Vue {

    @Inject() fileManager: FileManager;

    private _fileId: string;
    private _prevTag: string;

    @Prop() file: Object;
    @Prop() tag: string;

    get visible(): boolean {
        return this.file !== null;
    }

    get code(): string {
        if (this.file) {
            return this.file.tags[this.tag] || '';
        } else {
            return '';
        }
    }

    @Watch('file')
    onFileChanged() {
        this._updateCode();
    }

    @Watch('tag')
    onTagChanged() {
        this._updateCode();
    }

    private _updateCode() {
        
    }

    private _didFileOrTagChange() {
        if (this.file) {
            return this._fileId !== this.file.id || this._prevTag !== this.tag;
        } else {
            return !this._fileId;
        }
    }

    private _updateFile() {
    }

    created() {
    }

    mounted() {
    }

    destroyed() {
    }
};