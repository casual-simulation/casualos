import * as monaco from 'monaco-editor';
import Vue from 'vue';
import Component from 'vue-class-component';
import { setup } from '../../MonacoHelpers';

setup();

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
