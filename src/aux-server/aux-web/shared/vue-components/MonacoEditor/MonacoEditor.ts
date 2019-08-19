import Vue from 'vue';
import Component from 'vue-class-component';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import * as monaco from 'monaco-editor';

(<any>self).MonacoEnvironment = {
    getWorker: function(moduleId: string, label: string) {
        if (label === 'typescript' || label === 'javascript') {
            return new TypescriptWorker();
        }
        return new EditorWorker();
    },
};

@Component({})
export default class MonacoEditor extends Vue {
    private _editor: monaco.editor.IStandaloneCodeEditor;

    mounted() {
        const editorDiv = <HTMLElement>this.$refs.editor;

        this._editor = monaco.editor.create(editorDiv, {
            value: 'test',
            language: 'javascript',
            minimap: {
                enabled: false,
            },
        });
    }

    resize() {
        if (this._editor) {
            this._editor.layout();
        }
    }
}
