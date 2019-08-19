import Vue from 'vue';
import Component from 'vue-class-component';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import * as monaco from 'monaco-editor';
import { Prop, Watch } from 'vue-property-decorator';

(<any>self).MonacoEnvironment = {
    getWorker: function(moduleId: string, label: string) {
        if (label === 'typescript' || label === 'javascript') {
            return new TypescriptWorker();
        }
        return new EditorWorker();
    },
};

// monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
//     target: monaco.languages.typescript.ScriptTarget.ES5,
//     // lib: ['es2015']
// });

@Component({})
export default class MonacoEditor extends Vue {
    private _editor: monaco.editor.IStandaloneCodeEditor;

    @Prop({ default: '' }) value: string;
    @Prop({ default: 'plaintext' }) language: string;

    @Watch('value')
    onValueChanged() {
        if (this.isFocused()) {
            return;
        }

        if (this._editor) {
            this._editor.setValue(this.value);
        }
    }

    @Watch('language')
    onLanguageChanged() {
        if (this._editor) {
            monaco.editor.setModelLanguage(
                this._editor.getModel(),
                this.language
            );
        }
    }

    mounted() {
        const editorDiv = <HTMLElement>this.$refs.editor;

        this._editor = monaco.editor.create(editorDiv, {
            value: this.value,
            language: this.language,
            minimap: {
                enabled: false,
            },
        });

        this._editor.onDidChangeModelContent(e => {
            const value = this._editor.getValue();
            this.$emit('input', value);
        });
    }

    beforeDestroy() {
        if (this._editor) {
            this._editor.dispose();
        }
    }

    resize() {
        if (this._editor) {
            this._editor.layout();
        }
    }

    isFocused() {
        if (this.$el && document.activeElement) {
            return this.$el.contains(document.activeElement);
        }
        return false;
    }
}
