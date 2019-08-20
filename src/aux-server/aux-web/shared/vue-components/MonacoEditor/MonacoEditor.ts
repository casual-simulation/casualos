import * as monaco from 'monaco-editor';
import Vue from 'vue';
import Component from 'vue-class-component';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import { calculateFormulaDefinitions } from '../../FormulaHelpers';
import { lib_es2015_dts } from 'monaco-editor/esm/vs/language/typescript/lib/lib.js';

(<any>self).MonacoEnvironment = {
    getWorker: function(moduleId: string, label: string) {
        if (label === 'typescript' || label === 'javascript') {
            return new TypescriptWorker();
        }
        return new EditorWorker();
    },
};

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
});

monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2015,
    lib: ['defaultLib:lib.es2015.d.ts', 'file:///formula-lib.d.ts'],
    allowJs: true,
});

monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.javascriptDefaults.addExtraLib(
    lib_es2015_dts,
    'defaultLib:lib.es2015.d.ts'
);
monaco.languages.typescript.javascriptDefaults.addExtraLib(
    calculateFormulaDefinitions(),
    'file:///formula-lib.d.ts'
);

@Component({})
export default class MonacoEditor extends Vue {
    private _editor: monaco.editor.IStandaloneCodeEditor;
    private _states: Map<string, monaco.editor.ICodeEditorViewState>;
    private _model: monaco.editor.ITextModel;

    constructor() {
        super();
    }

    setModel(model: monaco.editor.ITextModel) {
        const editorDiv = <HTMLElement>this.$refs.editor;
        if (!this._editor && editorDiv) {
            this._editor = monaco.editor.create(editorDiv, {
                model: model,
                minimap: {
                    enabled: false,
                },
            });
            this._editor.onDidChangeModelContent(e => {
                const value = this._editor.getValue();
                this.$emit('input', value);
            });
        }

        if (
            !this._model ||
            this._model.uri.toString() !== model.uri.toString()
        ) {
            if (this._model) {
                this._states.set(
                    this._model.uri.toString(),
                    this._editor.saveViewState()
                );
            }
            this._model = model;
            this._editor.setModel(model);
            let prevState = this._states.get(model.uri.toString());
            if (prevState) {
                this._editor.restoreViewState(prevState);
            }
        }
    }

    created() {
        this._states = new Map();
    }

    mounted() {
        if (this._model && !this._editor) {
            const editorDiv = <HTMLElement>this.$refs.editor;
            this._editor = monaco.editor.create(editorDiv, {
                model: this._model,
                minimap: {
                    enabled: false,
                },
            });
            this._editor.onDidChangeModelContent(e => {
                const value = this._editor.getValue();
                this.$emit('input', value);
            });
        }
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
