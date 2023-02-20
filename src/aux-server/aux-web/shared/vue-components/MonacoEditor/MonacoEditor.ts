import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main';
import Vue from 'vue';
import Component from 'vue-class-component';
import { ResizeObserverEntry } from '@juggle/resize-observer/lib/ResizeObserverEntry';

@Component({})
export default class MonacoEditor extends Vue {
    private _editor: monaco.editor.IStandaloneCodeEditor;
    private _states: Map<string, monaco.editor.ICodeEditorViewState>;
    private _model: monaco.editor.ITextModel;
    private _resizeObserver: import('@juggle/resize-observer').ResizeObserver;
    private _modelChangeObserver: monaco.IDisposable;

    get editor() {
        return this._editor;
    }

    constructor() {
        super();
    }

    setModel(model: monaco.editor.ITextModel) {
        const editorDiv = <HTMLElement>this.$refs.editor;
        if (!this._editor && editorDiv) {
            this._createEditor();
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
            this._applyViewZones();
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
            this._createEditor();
        }
    }

    private _createEditor() {
        const editorDiv = <HTMLElement>this.$refs.editor;
        this._editor = monaco.editor.create(editorDiv, {
            model: this._model,
            minimap: {
                enabled: false,
            },
        });
        this._applyViewZones();
        this._watchSizeChanges();
        this._modelChangeObserver = this._editor.onDidChangeModel((e) => {
            this.$emit('modelChanged', e);
        });
        this.$emit('editorMounted', this._editor);
    }

    private async _watchSizeChanges() {
        const ResizeObserver =
            window.ResizeObserver ||
            (await import('@juggle/resize-observer')).ResizeObserver;

        if (this._editor) {
            // Uses native or polyfill, depending on browser support.
            this._resizeObserver = new ResizeObserver(
                debounceObserverUpdates(this.$el, () => {
                    this.resize();
                })
            );

            this._resizeObserver.observe(<HTMLElement>this.$el);
        }
    }

    beforeDestroy() {
        if (this._modelChangeObserver) {
            this._modelChangeObserver.dispose();
        }
        if (this._editor) {
            this._editor.dispose();
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
    }

    resize() {
        if (this._editor) {
            const container = this.getEditorContainer();

            if (container) {
                const rect = container.getBoundingClientRect();
                this._editor.layout({
                    width: rect.width,
                    height: rect.height,
                });
            }
        }
    }

    onFocused() {
        this.$emit('focus');
    }

    onNotFocused() {
        this.$emit('blur');
    }

    private _applyViewZones() {
        this._editor.changeViewZones((changeAccessor) => {
            const domNode = document.createElement('div');
            const viewZoneId = changeAccessor.addZone({
                afterLineNumber: 0,
                heightInLines: 1,
                domNode: domNode,
            });
        });
    }

    private getEditorContainer() {
        return this.$refs.editor as HTMLElement;
    }
}

function debounceObserverUpdates(
    target: Element,
    callback: Function
): (entries: ResizeObserverEntry[]) => void {
    let lastHeight = NaN;
    let lastWidth = NaN;

    return (entries) => {
        for (let entry of entries) {
            if (entry.target === target) {
                if (
                    entry.contentRect.height !== lastHeight ||
                    entry.contentRect.width !== lastWidth
                ) {
                    lastHeight = entry.contentRect.height;
                    lastWidth = entry.contentRect.width;
                    callback();
                }
            }
        }
    };
}
