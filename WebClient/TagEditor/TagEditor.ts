import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import { FileManager } from 'WebClient/FileManager';
import { Object } from 'common';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as LRU from 'lru-cache';

import './MonacoShims';

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true
});
monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

monaco.editor.createModel(`
function sum(values) {
    return 0;
}
`, 'javascript', monaco.Uri.parse('file://global.js'));

@Component({
    inject: {
        fileManager: 'fileManager'
    }
})
export default class Editor extends Vue {

    @Inject() fileManager: FileManager;

    private _cache: LRU.Cache<string, monaco.editor.ICodeEditorViewState>;
    private _fileId: string;
    private _prevTag: string;

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

        const didFileChange = this._didFileOrTagChange();
        if (didFileChange) {
            // save current state
            const currentModel = this.editor.saveViewState();
            this._cache.set(`${this._fileId}:${this._prevTag}`, currentModel);
        }

        if (this.file) {
            this._fileId = this.file.id;
        } else {
            this._fileId = null;
        }
        this._prevTag = this.tag;
        
        const value = this.editor.getValue();
        const code = this.code;
        if (value !== code) {
            this.editor.setValue(code);
        }

        if (didFileChange) {
            // load new state
            if (this.file) {
                const newModel = this._cache.get(`${this.file.id}:${this.tag}`);
                if (newModel) {
                    this.editor.restoreViewState(newModel);
                }
            }

            this.editor.focus();
        }
    }

    private _didFileOrTagChange() {
        if (this.file) {
            return this._fileId !== this.file.id || this._prevTag !== this.tag;
        } else {
            return !this._fileId;
        }
    }

    private _updateFile() {
        if (this.file && this.tag) {
            const model = this.editor.getModel();
            const value = model.getValue();

            if (value !== this.code) {
                this.fileManager.updateFile(this.file, {
                    tags: {
                        [this.tag]: value
                    }
                });
            }
        }
    }

    created() {
        this._cache = new LRU<string, monaco.editor.ICodeEditorViewState>({
            max: 10000
        });
    }

    mounted() {
        this.editor = monaco.editor.create(<HTMLElement>this.$refs.editor, {
            value: this.code,
            language: 'javascript',
            minimap: {
                enabled: false
            }
        });

        this.editor.onDidChangeModelContent(e => {
            this._updateFile();
        });
    }
};