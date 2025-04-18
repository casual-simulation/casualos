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

@Component({})
export default class MonacoEditor extends Vue {
    private _editor: monaco.editor.IStandaloneDiffEditor;
    private _states: Map<string, monaco.editor.IDiffEditorViewState>;
    private _original: monaco.editor.ITextModel;
    private _modified: monaco.editor.ITextModel;
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    private _resizeObserver: import('@juggle/resize-observer').ResizeObserver;
    private _modelChangeObserver: monaco.IDisposable;

    get editor() {
        return this._editor;
    }

    constructor() {
        super();
    }

    setModel(
        original: monaco.editor.ITextModel,
        modified: monaco.editor.ITextModel
    ) {
        const editorDiv = <HTMLElement>this.$refs.editor;
        if (!this._editor && editorDiv) {
            this._createEditor();
        }

        if (
            !this._original ||
            this._original.uri.toString() !== original.uri.toString() ||
            !this._modified ||
            this._modified.uri.toString() !== modified.uri.toString()
        ) {
            if (this._original) {
                this._states.set(
                    this._original.uri.toString(),
                    this._editor.saveViewState()
                );
            }
            this._original = original;
            this._editor.setModel({
                original: original,
                modified: modified,
            });
            this._applyViewZones();
            let prevState = this._states.get(original.uri.toString());
            if (prevState) {
                this._editor.restoreViewState(prevState);
            }
        }
    }

    created() {
        this._states = new Map();
    }

    mounted() {
        if (this._original && this._modified && !this._editor) {
            this._createEditor();
        }
    }

    private _createEditor() {
        const editorDiv = <HTMLElement>this.$refs.editor;
        this._editor = monaco.editor.createDiffEditor(editorDiv, {
            // model: this._model,
            originalEditable: true,
            minimap: {
                enabled: false,
            },
            diffCodeLens: true,
        });
        this._applyViewZones();
        this._watchSizeChanges();

        this._editor.getOriginalEditor().onDidFocusEditorText(() => {
            this.$emit('focusOriginal');
        });
        this._editor.getOriginalEditor().onDidBlurEditorText(() => {
            this.$emit('blurOriginal');
        });
        this._editor.getModifiedEditor().onDidFocusEditorText(() => {
            this.$emit('focusModified');
        });
        this._editor.getModifiedEditor().onDidBlurEditorText(() => {
            this.$emit('blurModified');
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
                debouceObserverUpdates(this.$el, () => {
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
            // this.$el.style.display = 'none';
            this._editor.layout({ width: 1, height: 1 });
            setTimeout(() => {
                // this.$el.style.display = 'block';
                this._editor.layout();
            }, 1);
        }
    }

    private _applyViewZones() {
        // this._editor.changeViewZones((changeAccessor) => {
        //     const domNode = document.createElement('div');
        //     const viewZoneId = changeAccessor.addZone({
        //         afterLineNumber: 0,
        //         heightInLines: 1,
        //         domNode: domNode,
        //     });
        // });
    }
}

function debouceObserverUpdates(
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
