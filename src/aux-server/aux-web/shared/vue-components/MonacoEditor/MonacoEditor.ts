import Vue from 'vue';
import Component from 'vue-class-component';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import * as monaco from 'monaco-editor';
import { Prop, Watch } from 'vue-property-decorator';
import formulaDefinitions from 'raw-loader!@casual-simulation/aux-common/Formulas/formula-lib.d.ts';
import { createFormulaLibrary } from '@casual-simulation/aux-common';
import { keys } from 'lodash';

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
    skipLibCheck: true,
    allowJs: true,
});

const formulaLib = createFormulaLibrary({
    config: { isBuilder: false, isPlayer: false },
});

const final =
    formulaDefinitions +
    [
        '\n',
        ...keys(formulaLib).map(k => `type _${k} = typeof ${k};`),
        'declare global {',
        ...keys(formulaLib).map(k => `const ${k}: _${k};`),
        '}',
    ].join('\n');

monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.javascriptDefaults.addExtraLib(
    final,
    'file:///builtin/functions.d.ts'
);
// monaco.languages.typescript.javascriptDefaults.addExtraLib(
//     ,
//     'file:///builtin/main.d.ts'
// );

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

        let model = monaco.editor.createModel(
            this.value,
            this.language,
            monaco.Uri.parse('file:///main.js')
        );

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

    beforeDestroy() {
        if (this._editor) {
            this._editor.dispose();
        }
    }

    resize() {
        if (this._editor) {
            const rect = this.$el.getBoundingClientRect();
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
