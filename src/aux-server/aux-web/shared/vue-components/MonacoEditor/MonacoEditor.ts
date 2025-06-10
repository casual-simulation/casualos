/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import * as monaco from '../../MonacoLibs';
import Vue from 'vue';
import Component from 'vue-class-component';
import type { ResizeObserverEntry } from '@juggle/resize-observer/lib/ResizeObserverEntry';
const states: Map<string, monaco.editor.ICodeEditorViewState> = new Map();
@Component({})
export default class MonacoEditor extends Vue {
    private _editor: monaco.editor.IStandaloneCodeEditor;
    private _model: monaco.editor.ITextModel;
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
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
                states.set(
                    this._model.uri.toString(),
                    this._editor.saveViewState()
                );
            }
            this._model = model;
            this._editor.setModel(model);
            this._applyViewZones();
            let prevState = states.get(model.uri.toString());
            if (prevState) {
                this._editor.restoreViewState(prevState);
            }
        }
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
            inlineSuggest: {
                enabled: true,
                mode: 'subword',
                suppressSuggestions: false,
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
    callback: () => any
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
