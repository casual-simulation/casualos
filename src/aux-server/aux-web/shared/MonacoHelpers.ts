import * as monaco from 'monaco-editor';
import {
    File,
    isFilterTag,
    tagsOnFile,
    isFormula,
    Transpiler,
} from '@casual-simulation/aux-common';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import { calculateFormulaDefinitions } from './FormulaHelpers';
import { lib_es2015_dts } from 'monaco-editor/esm/vs/language/typescript/lib/lib.js';
import { SimpleEditorModelResolverService } from 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';
import { SubscriptionLike, Subscription } from 'rxjs';
import { skip, flatMap, filter, first } from 'rxjs/operators';
import { Simulation } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

export function setup() {
    // Tell monaco how to create the web workers
    (<any>self).MonacoEnvironment = {
        getWorker: function(moduleId: string, label: string) {
            if (label === 'typescript' || label === 'javascript') {
                return new TypescriptWorker();
            }
            return new EditorWorker();
        },
    };

    // Set diagnostics
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
    });

    // Set compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2015,

        // Auto-import the given libraries
        lib: ['defaultLib:lib.es2015.d.ts', 'file:///formula-lib.d.ts'],

        allowJs: true,
    });

    // Eagerly sync models to get intellisense for all models
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    // Register the ES2015 core library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        lib_es2015_dts,
        'defaultLib:lib.es2015.d.ts'
    );

    // Register the formula library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        calculateFormulaDefinitions(),
        'file:///formula-lib.d.ts'
    );

    /**
     * Monkeypatch to make 'Find All References' work across multiple files
     * https://github.com/Microsoft/monaco-editor/issues/779#issuecomment-374258435
     */
    SimpleEditorModelResolverService.prototype.findModel = function(
        editor: monaco.editor.IStandaloneCodeEditor,
        resource: any
    ) {
        return monaco.editor
            .getModels()
            .find(model => model.uri.toString() === resource.toString());
    };
}

interface ModelInfo {
    fileId: string;
    tag: string;
    decorators: string[];
    isFormula: boolean;
    model: monaco.editor.ITextModel;
    sub: Subscription;
}

let subs: SubscriptionLike[] = [];
let activeModel: monaco.editor.ITextModel = null;
let models: Map<string, ModelInfo> = new Map();
let transpiler = new Transpiler();

/**
 * The model that should be marked as active.
 * @param model The model.
 */
export function setActiveModel(model: monaco.editor.ITextModel) {
    activeModel = model;
}

/**
 * Watches the given simulation for changes and updates the corresponding models.
 * @param simulation The simulation to watch.
 */
export function watchSimulation(simulation: BrowserSimulation) {
    let sub = simulation.watcher.filesDiscovered
        .pipe(flatMap(f => f))
        .subscribe(f => {
            for (let tag of tagsOnFile(f)) {
                if (shouldKeepModelWithTagLoaded(tag)) {
                    loadModel(simulation, f, tag);
                }
            }
        });

    let d = monaco.languages.registerReferenceProvider('javascript', {
        async provideReferences(
            model: monaco.editor.ITextModel,
            position: monaco.Position,
            context: monaco.languages.ReferenceContext,
            token: monaco.CancellationToken
        ): Promise<monaco.languages.Location[]> {
            const line = model.getLineContent(position.lineNumber);
            let startIndex = position.column;
            let endIndex = position.column;
            for (; startIndex >= 0; startIndex -= 1) {
                if (
                    line[startIndex] === '"' ||
                    line[startIndex] === "'" ||
                    line[startIndex] === '`'
                ) {
                    break;
                }
            }
            for (; endIndex < line.length; endIndex += 1) {
                if (
                    line[endIndex] === '"' ||
                    line[endIndex] === "'" ||
                    line[endIndex] === '`'
                ) {
                    break;
                }
            }

            const word = line.substring(startIndex + 1, endIndex);
            if (word) {
                const result = await simulation.code.getReferences(word);
                let locations: monaco.languages.Location[] = [];
                for (let id in result.references) {
                    for (let tag of result.references[id]) {
                        const file = simulation.helper.filesState[id];
                        let m = loadModel(simulation, file, tag);
                        locations.push(
                            ...m
                                .findMatches(
                                    result.tag,
                                    true,
                                    false,
                                    true,
                                    null,
                                    false
                                )
                                .map(r => ({
                                    range: r.range,
                                    uri: m.uri,
                                }))
                        );
                    }
                }
                return locations;
            }

            return [];
        },
    });

    sub.add(() => d.dispose());

    return sub;
}

/**
 * Clears the currently loaded models.
 */
export function clearModels() {
    for (let sub of subs) {
        sub.unsubscribe();
    }
    subs = [];
    for (let model of monaco.editor.getModels()) {
        model.dispose();
    }
}

/**
 * Loads the model for the given tag.
 * @param simulation The simulation that the file is in.
 * @param file The file.
 * @param tag The tag.
 */
export function loadModel(
    simulation: BrowserSimulation,
    file: File,
    tag: string
) {
    const uri = getModelUri(file, tag);
    let model = monaco.editor.getModel(uri);
    if (!model) {
        let script = getScript(file, tag);
        model = monaco.editor.createModel(
            script,
            tagScriptLanguage(tag, script),
            uri
        );

        watchModel(simulation, model, file, tag);
    }

    return model;
}

function tagScriptLanguage(tag: string, script: any): string {
    return isFilterTag(tag) || isFormula(script) ? 'javascript' : 'plaintext';
}

/**
 * Unloads and disposes of the given model.
 * @param model The model that should be unloaded.
 */
export function unloadModel(model: monaco.editor.ITextModel) {
    const uri = model.uri;
    let m = models.get(uri.toString());
    if (m) {
        m.sub.unsubscribe();
        models.delete(uri.toString());
        const index = subs.indexOf(m.sub);
        if (index >= 0) {
            subs.splice(index, 1);
        }
    }
    model.dispose();
}

/**
 * Determines if the given model should be kept alive.
 * @param model The model to check.
 */
export function shouldKeepModelLoaded(
    model: monaco.editor.ITextModel
): boolean {
    let info = models.get(model.uri.toString());
    if (info) {
        return shouldKeepModelWithTagLoaded(info.tag);
    } else {
        return true;
    }
}

function shouldKeepModelWithTagLoaded(tag: string): boolean {
    return isFilterTag(tag);
}

function watchModel(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    file: File,
    tag: string
) {
    let sub = new Subscription();
    // let changes = new Set<string>();
    let info: ModelInfo = {
        fileId: file.id,
        tag: tag,
        decorators: [],
        isFormula: false,
        model: model,
        sub: sub,
    };

    sub.add(
        simulation.watcher
            .fileTagsChanged(file.id)
            .pipe(skip(1))
            .subscribe(update => {
                file = update.file;
                if (model === activeModel || !update.tags.has(tag)) {
                    return;
                }
                let script = getScript(file, tag);
                let value = model.getValue();
                if (script !== value) {
                    model.setValue(script);
                }
                updateLanguage(model, tag, file.tags[tag]);
            })
    );

    sub.add(
        toSubscription(
            model.onDidChangeContent(async e => {
                if (e.isFlush) {
                    return;
                }
                let val = model.getValue();
                // changes.add(val);
                if (info.isFormula) {
                    val = '=' + val;
                }
                updateLanguage(model, tag, val);
                await simulation.editFile(file, tag, val);
            })
        )
    );

    sub.add(
        simulation.watcher.filesRemoved
            .pipe(
                flatMap(f => f),
                first(id => id === file.id)
            )
            .subscribe(f => {
                unloadModel(model);
            })
    );

    models.set(model.uri.toString(), info);
    updateDecorators(model, info, file.tags[tag]);
    subs.push(sub);
}

function updateLanguage(
    model: monaco.editor.ITextModel,
    tag: string,
    value: string
) {
    const info = models.get(model.uri.toString());
    if (!info) {
        return;
    }
    const currentLanguage = model.getModeId();
    const nextLanguage = tagScriptLanguage(tag, value);
    if (nextLanguage !== currentLanguage) {
        monaco.editor.setModelLanguage(model, nextLanguage);
    }
    updateDecorators(model, info, value);
}

function updateDecorators(
    model: monaco.editor.ITextModel,
    info: ModelInfo,
    value: string
) {
    if (isFormula(value)) {
        info.decorators = model.deltaDecorations(info.decorators, [
            {
                range: new monaco.Range(1, 1, 1, 1),
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName: 'formula-marker',
                },
            },
        ]);

        info.isFormula = true;
    } else {
        info.decorators = model.deltaDecorations(info.decorators, []);
        info.isFormula = false;
    }
}

function getModelUri(file: File, tag: string) {
    return getModelUriFromId(file.id, tag);
}

function getModelUriFromId(id: string, tag: string) {
    return monaco.Uri.parse(encodeURI(`file:///${id}/${tag}.js`));
}

export function getScript(file: File, tag: string) {
    let val = file.tags[tag];
    if (typeof val !== 'undefined' && val !== null) {
        let str = val.toString();
        if (isFormula(str)) {
            return transpiler.replaceMacros(str);
        } else {
            return str;
        }
    } else {
        return val || '';
    }
}

function toSubscription(disposable: monaco.IDisposable) {
    return new Subscription(() => disposable.dispose());
}
