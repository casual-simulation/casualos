import * as monaco from 'monaco-editor';
import { File, isFilterTag, tagsOnFile } from '@casual-simulation/aux-common';
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

let subs: SubscriptionLike[] = [];
let activeModel: monaco.editor.ITextModel = null;

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
    return simulation.watcher.filesDiscovered
        .pipe(flatMap(f => f))
        .subscribe(f => {
            for (let tag of tagsOnFile(f)) {
                loadModel(simulation, f, tag);
            }
        });
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
        model = monaco.editor.createModel(
            getScript(file, tag),
            isFilterTag(tag) ? 'javascript' : 'plaintext',
            uri
        );

        watchModel(simulation, model, file, tag);
    }

    return model;
}

function watchModel(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    file: File,
    tag: string
) {
    let sub = [
        simulation.watcher
            .fileChanged(file.id)
            .pipe(skip(1))
            .subscribe(f => {
                file = f;
                if (model === activeModel) {
                    return;
                }
                let script = getScript(file, tag);
                let value = model.getValue();
                if (script !== value) {
                    console.log('update');
                    model.setValue(script);
                }
            }),

        toSubscription(
            model.onDidChangeContent(async e => {
                if (model === activeModel) {
                    await simulation.editFile(file, tag, model.getValue());
                }
            })
        ),
    ];

    subs.push(...sub);

    simulation.watcher.filesRemoved
        .pipe(
            flatMap(f => f),
            first(id => id === file.id)
        )
        .subscribe(f => {
            for (let s of sub) {
                s.unsubscribe();
                const index = subs.indexOf(s);
                if (index >= 0) {
                    subs.splice(index, 1);
                }
            }
        });
}

function getModelUri(file: File, tag: string) {
    return monaco.Uri.parse(encodeURI(`file:///${file.id}/${tag}.js`));
}

export function getScript(file: File, tag: string) {
    let val = file.tags[tag];
    if (typeof val !== 'undefined' && val !== null) {
        return val.toString();
    } else {
        return val || '';
    }
}

function toSubscription(disposable: monaco.IDisposable) {
    return new Subscription(() => disposable.dispose());
}
