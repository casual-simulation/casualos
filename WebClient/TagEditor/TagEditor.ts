import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import { FileManager } from 'WebClient/FileManager';
import { Object } from 'common';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true
});

@Component({
    inject: {
        fileManager: 'fileManager'
    }
})
export default class Editor extends Vue {

    @Inject() fileManager: FileManager;

    @Prop() file: Object;
    @Prop() tag: string;

    editor: monaco.editor.ICodeEditor;

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
        if(!this.editor) {
            return;
        }
        this.editor.setValue(this.code);
    }

    mounted() {
        this.editor = monaco.editor.create(<HTMLElement>this.$refs.editor, {
            value: this.code,
            language: 'javascript',
        });
    }
};