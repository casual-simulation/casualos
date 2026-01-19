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
import * as monaco from './MonacoLibs';
import type { Bot, BotsState } from '@casual-simulation/aux-common';
import {
    tagsOnBot,
    isFormula,
    KNOWN_TAGS,
    isScript,
    hasValue,
    getTagValueForSpace,
    calculateBotValue,
    calculateBooleanTagValue,
    isBotInDimension,
    getBotShape,
    getActiveObjects,
    calculateNumericalTagValue,
    calculateStringTagValue,
    calculateFormattedBotValue,
    DNA_TAG_PREFIX,
    hasPortalScript,
    getScriptPrefix as calcGetScriptPrefix,
    KNOWN_TAG_PREFIXES,
    isPortalScript,
    action,
    CLICK_ACTION_NAME,
    ANY_CLICK_ACTION_NAME,
    onClickArg,
    onAnyClickArg,
    getBotTheme,
    EDITOR_CODE_BUTTON_DIMENSION,
    calculateBotVectorTagValue,
} from '@casual-simulation/aux-common';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import TypescriptWorker from './monaco/ts.worker?worker';
import { calculateFormulaDefinitions } from './FormulaHelpers';
import type { SubscriptionLike } from 'rxjs';
import { Subscription, Observable, merge, defer } from 'rxjs';
import {
    skip,
    mergeMap,
    filter,
    first,
    takeWhile,
    tap,
    switchMap,
    map,
    scan,
    delay,
    takeUntil,
    debounceTime,
    distinctUntilChanged,
    finalize,
} from 'rxjs/operators';
import type {
    BotTagChange,
    BotTagEdit,
    BotTagUpdate,
    Simulation,
} from '@casual-simulation/aux-vm';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { userBotTagsChanged } from '@casual-simulation/aux-vm-browser';
import { union, sortBy } from 'es-toolkit/compat';
import { propertyInsertText } from './CompletionHelpers';
import type {
    BotCalculationContext,
    TagEditOp,
} from '@casual-simulation/aux-common/bots';
import {
    del,
    edits,
    insert,
    isModule,
    mergeVersions,
    preserve,
    SHOW_SCRIPT_ISSUES,
} from '@casual-simulation/aux-common/bots';
import { Color } from '@casual-simulation/three';
import { invertColor } from './scene/ColorUtils';
import {
    getCursorColorClass,
    getCursorLabelClass,
    getHintColorClass,
    getHintLabelClass,
    getHintStrokeClass,
    getSystemTheme,
} from './StyleHelpers';
import MonacoJSXHighlighter from './public/monaco-jsx-highlighter/index';
import { triggerMonacoLoaded } from './MonacoAsync';
import './public/monaco-editor/quick-open-file/quick-open-file';
import './public/monaco-editor/quick-search-all/quick-search-all';
import { getModelUriFromId } from './MonacoUtils';
import {
    Transpiler,
    replaceMacros,
} from '@casual-simulation/aux-runtime/runtime/Transpiler';

let worker: Worker;

export function setup() {
    // Tell monaco how to create the web workers
    (<any>self).MonacoEnvironment = {
        getWorker: function (moduleId: string, label: string) {
            if (label === 'typescript' || label === 'javascript') {
                return (worker = new TypescriptWorker());
            } else if (label === 'html') {
                return new HtmlWorker();
            } else if (label === 'css') {
                return new CssWorker();
            } else if (label === 'json') {
                return new JsonWorker();
            }
            return new EditorWorker();
        },
    };

    // Set diagnostics
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
    });

    // Set compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,

        // Auto-import the given libraries
        lib: ['lib.es2015.d.ts', 'file:///AuxDefinitions.d.ts'],

        allowJs: true,
        alwaysStrict: true,
        checkJs: true,
        newLine: monaco.languages.typescript.NewLineKind.LineFeed,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.Preserve,
    });
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,

        // Auto-import the given libraries
        lib: ['lib.es2015.d.ts', 'file:///AuxDefinitions.d.ts'],

        allowJs: true,
        alwaysStrict: true,
        checkJs: true,
        newLine: monaco.languages.typescript.NewLineKind.LineFeed,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.Preserve,
    });

    // Eagerly sync models to get intellisense for all models
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    // Register the formula library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        calculateFormulaDefinitions(),
        'file:///AuxDefinitions.d.ts'
    );

    // Eagerly sync models to get intellisense for all models
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

    // Register the formula library
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
        calculateFormulaDefinitions(),
        'file:///AuxDefinitions.d.ts'
    );

    triggerMonacoLoaded();
}

interface ModelInfo {
    simId: string;
    botId: string;
    tag: string;
    space: string;
    decorators: string[];
    isFormula: boolean;
    isScript: boolean;
    isModule: boolean;
    isCustomPortalScript: boolean;
    prefix: string;
    editOffset: number;
    model: monaco.editor.ITextModel;
    language: string;
    sub: Subscription;
}

let subs: SubscriptionLike[] = [];
let activeModel: monaco.editor.ITextModel = null;
let models: Map<string, ModelInfo> = new Map();

export function getModelInfoFromUri(uri: monaco.Uri) {
    return models.get(uri.toString());
}

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
export function watchSimulation(
    simulation: BrowserSimulation,
    getEditor: () => monaco.editor.IEditor
) {
    let sub = simulation.watcher.botsDiscovered
        .pipe(mergeMap((f) => f))
        .subscribe((f) => {
            for (let tag of tagsOnBot(f)) {
                if (
                    isScript(f.tags[tag]) ||
                    isFormula(f.tags[tag]) ||
                    isCustomPortalScript(
                        simulation,
                        calculateBotValue(null, f, tag)
                    ) ||
                    isModule(f.tags[tag])
                ) {
                    loadModel(simulation, f, tag, null, () => {
                        if (getEditor) {
                            return getEditor();
                        } else {
                            return null;
                        }
                    });
                }
            }
        });

    function updateTheme(bot: Bot) {
        const theme = getBotTheme(null, bot);
        if (theme === 'dark') {
            monaco.editor.setTheme('vs-dark');
        } else if (theme === 'light') {
            monaco.editor.setTheme('vs');
        } else if (theme === 'auto') {
            const systemTheme = getSystemTheme();
            if (systemTheme === 'dark') {
                monaco.editor.setTheme('vs-dark');
            } else if (systemTheme === 'light') {
                monaco.editor.setTheme('vs');
            }
        }
    }

    function getSemanticHighlighting(
        context: BotCalculationContext,
        bot: Bot
    ): boolean {
        const value = calculateBooleanTagValue(
            context,
            bot,
            SHOW_SCRIPT_ISSUES,
            false
        );
        return value;
    }

    function updateSemanticHighlighting(bot: Bot) {
        const showScriptIssues = getSemanticHighlighting(null, bot);
        if (showScriptIssues) {
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
                {
                    noSemanticValidation: false,
                    noSyntaxValidation: false,
                }
            );
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
                {
                    noSemanticValidation: false,
                    noSyntaxValidation: false,
                }
            );
        } else {
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
                {
                    noSemanticValidation: true,
                    noSyntaxValidation: false,
                }
            );
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
                {
                    noSemanticValidation: true,
                    noSyntaxValidation: false,
                }
            );
        }
    }

    sub.add(
        userBotTagsChanged(simulation).subscribe((change) => {
            if (change.tags.has('theme')) {
                updateTheme(change.bot);
            }
            if (change.tags.has(SHOW_SCRIPT_ISSUES)) {
                updateSemanticHighlighting(change.bot);
            }
        })
    );

    const user = simulation.helper.userBot;
    if (user) {
        updateTheme(user);
    }

    let completionDisposable = monaco.languages.registerCompletionItemProvider(
        'typescript',
        {
            triggerCharacters: ['#', '.'],
            async provideCompletionItems(
                model,
                position,
                context,
                token
            ): Promise<monaco.languages.CompletionList> {
                const lineText = model.getLineContent(position.lineNumber);
                const textBeforeCursor = lineText.substring(0, position.column);
                let tagIndex = textBeforeCursor.lastIndexOf('#');
                let offset = '#'.length;

                // TODO: Allow configuring which variables tag autocomplete shows up for
                if (tagIndex < 0) {
                    tagIndex = textBeforeCursor.lastIndexOf('tags.');
                    offset = 'tags.'.length;
                }

                if (tagIndex < 0) {
                    return {
                        suggestions: [],
                    };
                }

                const usedTags = await simulation.code.getTags();
                const knownTags = KNOWN_TAGS;
                const allTags = sortBy(union(usedTags, knownTags)).filter(
                    (t) => !/[()]/g.test(t)
                );

                const tagColumn = tagIndex + offset;
                const completionStart = tagColumn + 1;

                return {
                    suggestions: allTags.map(
                        (t) =>
                            <monaco.languages.CompletionItem>{
                                kind: monaco.languages.CompletionItemKind.Field,
                                label: t,
                                insertText: propertyInsertText(t),
                                additionalTextEdits: [
                                    {
                                        text: '',
                                        range: new monaco.Range(
                                            position.lineNumber,
                                            tagColumn,
                                            position.lineNumber,
                                            tagColumn + 1
                                        ),
                                        forceMoveMarkers: true,
                                    },
                                ],
                                range: new monaco.Range(
                                    position.lineNumber,
                                    completionStart,
                                    position.lineNumber,
                                    position.column
                                ),
                            }
                    ),
                };
            },
        }
    );

    let commandDisposable = monaco.editor.registerCommand(
        'clickCodeButton',
        (
            accessor,
            botId: string,
            dimension: string,
            dimensionBotId: string,
            dimensionTag: string
        ) => {
            let bot = simulation.helper.botsState[botId];
            let dimensionBot = simulation.helper.botsState[dimensionBotId];
            let extraArgs = {
                dimensionBot: dimensionBot,
                dimensionTag: dimensionTag,
            };
            simulation.helper.transaction(
                action(CLICK_ACTION_NAME, [botId], simulation.helper.userId, {
                    ...onClickArg(
                        null,
                        dimension,
                        null,
                        null,
                        null,
                        null,
                        null
                    ),
                    ...extraArgs,
                }),
                action(ANY_CLICK_ACTION_NAME, null, simulation.helper.userId, {
                    ...onAnyClickArg(
                        null,
                        dimension,
                        bot,
                        null,
                        null,
                        null,
                        null,
                        null
                    ),
                    ...extraArgs,
                })
            );
        }
    );
    let registerCodeLanguage = (language: string) =>
        registerCodeLensForLanguage(simulation, language, 'clickCodeButton');

    let languages = monaco.languages.getLanguages().map((l) => l.id);
    let codeLensDisposables = languages.map(registerCodeLanguage);

    sub.add(() => {
        getEditor = null;
        completionDisposable.dispose();

        for (let disposable of codeLensDisposables) {
            disposable.dispose();
        }
        commandDisposable.dispose();
    });

    sub.add(
        simulation.portals.portalBotIdUpdated
            .pipe(
                mergeMap((b) => b),
                tap((data) => {
                    addDefinitionsForPortalBot(
                        data.portalId,
                        data.botId,
                        monaco.languages.typescript.typescriptDefaults
                    );
                })
            )
            .subscribe()
    );

    sub.add(registerEditorActionsForSimulation(simulation));

    addDefinitionsForPortalBot(
        'auth',
        'botId',
        monaco.languages.typescript.typescriptDefaults
    );

    sub.add(
        simulation.watcher.stateUpdated.subscribe(async (update) => {
            worker?.postMessage({
                __type: 'state',
                simId: simulation.id,
                update,
            });
        })
    );

    return sub;
}

/**
 * Configures TypeScript type checking in the Monaco editor.
 *
 * By default, semantic validation is disabled (noSemanticValidation: true) to reduce
 * visual noise in the editor. Syntax validation remains enabled by default.
 *
 * @param options The configuration options for type checking.
 */
export function configureMonacoTypeChecking(options: {
    noSemanticValidation?: boolean;
    noSyntaxValidation?: boolean;
}) {
    const diagnosticOptions = {
        noSemanticValidation: options.noSemanticValidation ?? true,
        noSyntaxValidation: options.noSyntaxValidation ?? false,
    };

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
        diagnosticOptions
    );
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
        diagnosticOptions
    );
}

function registerCodeLensForLanguage(
    simulation: Simulation,
    language: string,
    commandId: string
) {
    const newCodeButtonBots = simulation.watcher.botsDiscovered.pipe(
        skip(1),
        filter((bots) =>
            bots.some((b) => getBotShape(null, b) === 'codeButton')
        )
    );
    const udpatedCodeButtonBots = simulation.watcher.botsUpdated.pipe(
        skip(1),
        filter((bots) =>
            bots.some((b) => getBotShape(null, b) === 'codeButton')
        )
    );
    const deletedCodeButtonBots = simulation.watcher.botsRemoved.pipe(skip(1));
    const allEvents = merge(
        newCodeButtonBots,
        udpatedCodeButtonBots,
        deletedCodeButtonBots
    );

    const provider: monaco.languages.CodeLensProvider = {
        onDidChange: (listener) => {
            const sub = allEvents.subscribe(() => listener(provider));
            return {
                dispose: () => sub.unsubscribe(),
            };
        },

        provideCodeLenses(model, token) {
            return new Promise<monaco.languages.CodeLensList>(
                (resolve, reject) => {
                    try {
                        const uri = model.uri;
                        let info = models.get(uri.toString());

                        let lenses: monaco.languages.CodeLens[] = [];

                        if (info) {
                            const dimension = `${info.botId}.${info.tag}`;

                            for (let bot of simulation.helper.objects) {
                                if (
                                    isBotInDimension(null, bot, dimension) &&
                                    getBotShape(null, bot) === 'codeButton'
                                ) {
                                    const buttonStart =
                                        calculateNumericalTagValue(
                                            null,
                                            bot,
                                            `${dimension}Start`,
                                            0
                                        );
                                    const buttonEnd =
                                        calculateNumericalTagValue(
                                            null,
                                            bot,
                                            `${dimension}End`,
                                            0
                                        );
                                    const label = calculateFormattedBotValue(
                                        null,
                                        bot,
                                        'auxLabel'
                                    );

                                    lenses.push({
                                        range: {
                                            startLineNumber: Math.max(
                                                buttonStart,
                                                1
                                            ),
                                            startColumn: Math.max(buttonEnd, 1),
                                            endLineNumber: Math.max(
                                                buttonStart,
                                                1
                                            ),
                                            endColumn: Math.max(buttonEnd, 1),
                                        },
                                        command: {
                                            id: commandId,
                                            title: label ?? '',
                                            arguments: [
                                                bot.id,
                                                dimension,
                                                info.botId,
                                                info.tag,
                                            ],
                                        },
                                    });
                                }

                                if (token.isCancellationRequested) {
                                    break;
                                }
                            }
                        }

                        resolve({
                            lenses,
                            dispose: () => {},
                        });
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        },

        resolveCodeLens(model, codeLens, token) {
            return codeLens;
        },
    };

    return monaco.languages.registerCodeLensProvider(language, provider);
}

function registerEditorActionsForSimulation(simulation: Simulation) {
    const newCodeButtonBots = simulation.watcher.botsDiscovered.pipe(
        filter((bots) =>
            bots.some((b) => getBotShape(null, b) === 'codeButton')
        ),
        map((e) => ['add', e] as const)
    );
    const updatedCodeButtonBots = simulation.watcher.botsUpdated.pipe(
        filter((bots) =>
            bots.some((b) => getBotShape(null, b) === 'codeButton')
        ),
        map((e) => ['update', e] as const)
    );
    const deletedCodeButtonBots = simulation.watcher.botsRemoved.pipe(
        skip(1),
        map((e) => ['delete', e] as const)
    );
    const allEvents = merge(
        newCodeButtonBots,
        updatedCodeButtonBots,
        deletedCodeButtonBots
    );

    let codeButtons = new Map<string, Subscription>();
    const sub = allEvents.subscribe((e) => {
        if (e[0] === 'delete') {
            const deleted = e[1];
            for (let id of deleted) {
                let s = codeButtons.get(id);
                if (s) {
                    s.unsubscribe();
                    codeButtons.delete(id);
                }
            }
        } else {
            const bots = e[1];
            const calc = simulation.helper.createContext();

            for (let b of bots) {
                const wasAButton = codeButtons.has(b.id);
                const shouldBeAButton = isBotInDimension(
                    calc,
                    b,
                    EDITOR_CODE_BUTTON_DIMENSION
                );

                if (!wasAButton && !shouldBeAButton) {
                    continue;
                }

                // If it was a button and should be a button,
                // then we need to update the code button
                if (wasAButton) {
                    const sub = codeButtons.get(b.id);
                    if (sub) {
                        sub.unsubscribe();
                    }
                    codeButtons.delete(b.id);
                }

                if (shouldBeAButton) {
                    const label = calculateFormattedBotValue(
                        null,
                        b,
                        'auxLabel'
                    );
                    const disposable = monaco.editor.addEditorAction({
                        id: `codeButton.${simulation.id}.${b.id}`,
                        contextMenuGroupId: 'zz_codebuttons',
                        label: label,
                        run: (editor, ...args) => {
                            const bot = simulation.helper.botsState[b.id];
                            simulation.helper.transaction(
                                action(
                                    CLICK_ACTION_NAME,
                                    [b.id],
                                    simulation.helper.userId,
                                    onClickArg(
                                        null,
                                        EDITOR_CODE_BUTTON_DIMENSION,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null
                                    )
                                ),
                                action(
                                    ANY_CLICK_ACTION_NAME,
                                    null,
                                    simulation.helper.userId,
                                    onAnyClickArg(
                                        null,
                                        EDITOR_CODE_BUTTON_DIMENSION,
                                        bot,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null
                                    )
                                )
                            );
                        },
                    });

                    codeButtons.set(b.id, toSubscription(disposable));
                }
            }
        }
    });

    sub.add(() => {
        for (let [id, sub] of codeButtons) {
            sub.unsubscribe();
        }
        codeButtons = new Map();
    });
    return sub;
}

export async function getScriptIssues(
    simulation: BrowserSimulation,
    bot: Bot,
    tag: string
) {
    const model = loadModel(simulation, bot, tag, null, () => null);
    const worker = await monaco.languages.typescript.getTypeScriptWorker();
    const client = await worker(model.uri);
    return {
        syntax: await client.getSyntacticDiagnostics(model.uri.toString()),
        semantic: await client.getSemanticDiagnostics(model.uri.toString()),
        suggestion: await client.getSuggestionDiagnostics(model.uri.toString()),
    };
}

export function addDefinitionsForPortalBot(
    portalId: string,
    botId: string,
    defaults: typeof monaco.languages.typescript.typescriptDefaults
) {
    const extraLibs = defaults.getExtraLibs();
    const libs: { filePath: string; content: string }[] = [];
    const portalFilePath = `file:///${portalId}Bot.d.ts`;
    const portalContent = `import type { Bot } from './AuxDefinitions';
declare global { 
    const ${portalId}Bot: Bot;
}`;

    let hasLib: boolean = false;
    for (let key in extraLibs) {
        if (key === portalFilePath) {
            hasLib = true;
            if (!botId) {
                continue;
            }
        }
        libs.push({
            filePath: key,
            content: extraLibs[key].content,
        });
    }

    if (!hasLib) {
        libs.push({
            filePath: portalFilePath,
            content: portalContent,
        });
    }

    defaults.setExtraLibs(libs);
}

function finalizeWithValue<T>(callback: (value: T) => void) {
    return (source: Observable<T>) =>
        defer(() => {
            let lastValue: T;
            return source.pipe(
                tap((value) => (lastValue = value)),
                finalize(() => callback(lastValue))
            );
        });
}

export function watchEditor(
    simulation: Simulation,
    editor: monaco.editor.ICodeEditor
): Subscription {
    const monacoJsxHighlighter = new MonacoJSXHighlighter(
        new Transpiler(),
        editor
    );

    const modelChangeObservable =
        new Observable<monaco.editor.IModelChangedEvent>((sub) => {
            return toSubscription(editor.onDidChangeModel((e) => sub.next(e)));
        });

    const modelChangeLanguageObservable =
        new Observable<monaco.editor.IModelLanguageChangedEvent>((sub) => {
            return toSubscription(
                editor.onDidChangeModelLanguage((e) => sub.next(e))
            );
        });

    const decorators = modelChangeObservable.pipe(
        delay(100),
        filter((e) => !!e.newModelUrl),
        map((e) => models.get(e.newModelUrl.toString())),
        filter((info) => !!info),
        filter((info) => !info.model.isDisposed()),
        switchMap((info) => {
            const dimension = `${info.botId}.${info.tag}`;

            const botEvents = merge(
                simulation.watcher.botsDiscovered.pipe(
                    map((bots) => ({ type: 'added_or_updated', bots } as const))
                ),
                simulation.watcher.botsUpdated.pipe(
                    map((bots) => ({ type: 'added_or_updated', bots } as const))
                ),
                simulation.watcher.botsRemoved.pipe(
                    map((ids) => ({ type: 'removed', ids } as const))
                )
            );

            const dimensionStates = botEvents.pipe(
                scan((state, event) => {
                    const originalState = state;
                    if (event.type === 'added_or_updated') {
                        for (let bot of event.bots) {
                            if (
                                isBotInDimension(null, bot, dimension) === true
                            ) {
                                const shape = getBotShape(null, bot);
                                if (
                                    shape === 'cursor' ||
                                    shape === 'codeHint'
                                ) {
                                    if (originalState === state) {
                                        state = {
                                            ...originalState,
                                        };
                                    }
                                    state[bot.id] = bot;
                                }
                            } else if (bot.id in state) {
                                if (originalState === state) {
                                    state = {
                                        ...originalState,
                                    };
                                }
                                delete state[bot.id];
                            }
                        }
                    } else {
                        for (let id of event.ids) {
                            if (id in state) {
                                if (originalState === state) {
                                    state = {
                                        ...originalState,
                                    };
                                }
                                delete state[id];
                            }
                        }
                    }
                    return state;
                }, {} as BotsState),
                distinctUntilChanged()
            );

            const debouncedStates = dimensionStates.pipe(debounceTime(75));

            const botDecorators = debouncedStates.pipe(
                map((state) => {
                    let decorators =
                        [] as monaco.editor.IModelDeltaDecoration[];
                    let offset = info.editOffset;
                    for (let bot of getActiveObjects(state)) {
                        const shape = getBotShape(null, bot);

                        if (shape === 'cursor') {
                            decorators.push(
                                createCursorDecorator(
                                    bot,
                                    dimension,
                                    info,
                                    offset
                                )
                            );
                        } else if (shape === 'codeHint') {
                            decorators.push(
                                createCodeHintDecorator(
                                    bot,
                                    info.botId,
                                    info.tag,
                                    dimension,
                                    info,
                                    offset
                                )
                            );
                        }
                    }

                    return decorators;
                })
            );

            const onModelWillDispose = new Observable<void>((sub) => {
                info.model.onWillDispose(() => sub.next());
            });

            return botDecorators.pipe(
                takeUntil(onModelWillDispose),
                scan((ids, decorators) => {
                    return info.model.deltaDecorations(ids, decorators);
                }, [] as string[]),
                finalizeWithValue((ids) => {
                    info.model.deltaDecorations(ids, []);
                })
            );
        })
    );

    const modelInfos = merge(
        modelChangeObservable.pipe(
            filter((e) => !!e.newModelUrl),
            map((e) => models.get(e.newModelUrl.toString())),
            filter((info) => !!info),
            filter((info) => !info.model.isDisposed())
        ),
        modelChangeLanguageObservable.pipe(
            map((e) => editor.getModel()),
            filter((model) => !!model),
            map((model) => models.get(model.uri.toString())),
            filter((info) => !!info),
            filter((info) => !info.model.isDisposed())
        )
    );

    const enableJsxHighlightingOnCorrectModels = modelInfos.pipe(
        map(
            (info) =>
                info.language === 'javascript' || info.language === 'typescript'
        ),
        scan(
            (acc, needsJsxHighlighting) => {
                if (acc) {
                    acc();
                }
                if (needsJsxHighlighting) {
                    return monacoJsxHighlighter.highLightOnDidChangeModelContent(
                        undefined,
                        () => {},
                        undefined,
                        (err) => console.error(err)
                    );
                } else {
                    return () => {};
                }
            },
            () => {}
        )
    );

    const sub = new Subscription();

    sub.add(decorators.subscribe());
    sub.add(enableJsxHighlightingOnCorrectModels.subscribe());

    sub.add(
        toSubscription(
            editor.onDidChangeCursorSelection((e) => {
                const model = editor.getModel();
                const info = models.get(model.uri.toString());
                const dir = e.selection.getDirection();
                const startIndex = model.getOffsetAt(
                    e.selection.getStartPosition()
                );
                const endIndex = model.getOffsetAt(
                    e.selection.getEndPosition()
                );

                const offset = info.editOffset;
                let finalStartIndex = offset + startIndex;
                let finalEndIndex = offset + endIndex;

                if (dir === monaco.SelectionDirection.RTL) {
                    const temp = finalStartIndex;
                    finalStartIndex = finalEndIndex;
                    finalEndIndex = temp;
                }

                simulation.helper.updateBot(simulation.helper.userBot, {
                    tags: {
                        cursorStartIndex: finalStartIndex,
                        cursorEndIndex: finalEndIndex,
                    },
                });
            })
        )
    );

    sub.add(
        toSubscription(
            editor.onMouseUp((e) => {
                if (
                    e.target.type ===
                        monaco.editor.MouseTargetType.CONTENT_TEXT &&
                    e.target.detail
                ) {
                    const injectedText: any = (e.target.detail as any)
                        .injectedText;
                    if (hasValue(injectedText?.options?.attachedData?.botId)) {
                        const {
                            botId,
                            dimensionBotId,
                            dimensionTag,
                            dimension,
                        } = injectedText.options.attachedData;

                        let bot = simulation.helper.botsState[botId];
                        let dimensionBot =
                            simulation.helper.botsState[dimensionBotId];
                        let extraArgs = {
                            dimensionBot: dimensionBot,
                            dimensionTag: dimensionTag,
                        };
                        simulation.helper.transaction(
                            action(
                                CLICK_ACTION_NAME,
                                [botId],
                                simulation.helper.userId,
                                {
                                    ...onClickArg(
                                        null,
                                        dimension,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null
                                    ),
                                    ...extraArgs,
                                }
                            ),
                            action(
                                ANY_CLICK_ACTION_NAME,
                                null,
                                simulation.helper.userId,
                                {
                                    ...onAnyClickArg(
                                        null,
                                        dimension,
                                        bot,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null
                                    ),
                                    ...extraArgs,
                                }
                            )
                        );
                    }
                }
            })
        )
    );

    return sub;
}

function createCursorDecorator(
    bot: Bot,
    dimension: string,
    info: ModelInfo,
    offset: number
): monaco.editor.IModelDeltaDecoration {
    const cursorStart = calculateNumericalTagValue(
        null,
        bot,
        `${dimension}Start`,
        0
    );
    const cursorEnd = calculateNumericalTagValue(
        null,
        bot,
        `${dimension}End`,
        0
    );
    const startPosition = info.model.getPositionAt(cursorStart - offset);
    const endPosition = info.model.getPositionAt(cursorEnd - offset);
    const range = new monaco.Range(
        startPosition.lineNumber,
        startPosition.column,
        endPosition.lineNumber,
        endPosition.column
    );

    let beforeContentClassName: string;
    let afterContentClassName: string;

    const color = calculateStringTagValue(null, bot, 'color', 'black');
    const colorClass = getCursorColorClass('bot-cursor-color-', color, 0.1);
    const notchColorClass = getCursorColorClass(
        'bot-notch-cursor-color-',
        color,
        1
    );

    const label = calculateFormattedBotValue(null, bot, 'auxLabel');

    const inverseColor = invertColor(new Color(color).getHexString(), true);
    const labelForeground = calculateStringTagValue(
        null,
        bot,
        'labelColor',
        inverseColor
    );

    let labelClass = '';
    if (hasValue(label)) {
        labelClass = getCursorLabelClass(
            'bot-notch-label',
            bot.id,
            labelForeground,
            color,
            label
        );
    }

    if (cursorStart < cursorEnd) {
        beforeContentClassName = null;
        afterContentClassName = `bot-cursor-notch ${notchColorClass} ${labelClass}`;
    } else {
        beforeContentClassName = `bot-cursor-notch ${notchColorClass} ${labelClass}`;
        afterContentClassName = null;
    }

    return {
        range,
        options: {
            className: `bot-cursor ${colorClass}`,
            beforeContentClassName,
            afterContentClassName,
            stickiness:
                monaco.editor.TrackedRangeStickiness.GrowsOnlyWhenTypingAfter,
        },
    };
}

function createCodeHintDecorator(
    bot: Bot,
    dimensionBotId: string,
    dimensionTag: string,
    dimension: string,
    info: ModelInfo,
    offset: number
): monaco.editor.IModelDeltaDecoration {
    const dimensionStart = `${dimension}Start`;
    const dimensionEnd = `${dimension}End`;
    const hintStartLine = calculateBotVectorTagValue(
        null,
        bot,
        dimensionStart,
        null
    );
    const hintEndLine = calculateBotVectorTagValue(
        null,
        bot,
        dimensionEnd,
        null
    );

    let startPosition: monaco.Position;
    let endPosition: monaco.Position;
    let wrapsText = true;

    if (hasValue(hintStartLine)) {
        let lineNumber = hintStartLine.x;
        let columnNumber = hintStartLine.y;

        if (lineNumber === 0) {
            columnNumber -= offset;
        }

        startPosition = new monaco.Position(lineNumber, columnNumber);
    } else {
        const hintStart = calculateNumericalTagValue(
            null,
            bot,
            dimensionStart,
            0
        );
        startPosition = info.model.getPositionAt(hintStart - offset);
    }

    if (hasValue(hintEndLine)) {
        let lineNumber = hintEndLine.x;
        let columnNumber = hintEndLine.y;

        if (lineNumber === 0) {
            columnNumber -= offset;
        }

        endPosition = new monaco.Position(lineNumber, columnNumber);
    } else {
        const hintEnd = calculateNumericalTagValue(null, bot, dimensionEnd, 0);
        endPosition = info.model.getPositionAt(hintEnd - offset);
    }

    if (startPosition.equals(endPosition)) {
        wrapsText = false;
        endPosition = new monaco.Position(
            endPosition.lineNumber,
            endPosition.column + 1
        );
    }

    const range = new monaco.Range(
        startPosition.lineNumber,
        startPosition.column,
        endPosition.lineNumber,
        endPosition.column
    );

    const label = calculateFormattedBotValue(null, bot, 'auxLabel');

    const hasClick = hasValue(calculateBotValue(null, bot, 'onClick'));

    let labelClass = '';
    let colorClass = '';
    let strokeClass = '';

    if (hasValue(label)) {
        const color = calculateStringTagValue(null, bot, 'color', null);

        if (hasValue(color)) {
            colorClass = getHintColorClass('bot-hint-color-', color, 0.1);
        }

        const strokeColor = calculateStringTagValue(
            null,
            bot,
            'strokeColor',
            null
        );

        if (hasValue(strokeColor)) {
            strokeClass = getHintStrokeClass(
                'bot-hint-stroke-',
                strokeColor,
                0.4
            );
        }

        const inverseColor = hasValue(color)
            ? invertColor(new Color(color).getHexString(), true)
            : null;

        const labelForeground = calculateStringTagValue(
            null,
            bot,
            'labelColor',
            inverseColor
        );

        if (hasValue(labelForeground)) {
            labelClass = getHintLabelClass(
                'bot-hint-label-',
                bot.id,
                labelForeground,
                color
            );
        }
    }

    let options: monaco.editor.IModelDeltaDecoration = {
        range,
        options: {
            className: `bot-hint`,

            stickiness:
                monaco.editor.TrackedRangeStickiness.GrowsOnlyWhenTypingAfter,
        },
    };

    if (wrapsText) {
        options.options.className += ` ${colorClass} ${strokeClass}`;
    }

    if (hasValue(label)) {
        options.options.before = {
            attachedData: {
                botId: bot.id,
                dimensionBotId,
                dimensionTag,
                dimension,
            },
            content: label,
            cursorStops: monaco.editor.InjectedTextCursorStops.Both,
            inlineClassName: `bot-hint-label ${labelClass} ${colorClass} ${strokeClass} ${
                wrapsText ? 'wraps-text' : ''
            } ${hasClick ? 'clickable' : ''}`,
            inlineClassNameAffectsLetterSpacing: true,
        };

        options.options.className += ` has-label`;
    }

    return options;
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
 * @param simulation The simulation that the bot is in.
 * @param bot The bot.
 * @param tag The tag.
 */
export function loadModel(
    simulation: BrowserSimulation,
    bot: Bot,
    tag: string,
    space: string,
    getEditor: () => monaco.editor.IEditor
) {
    const uri = getModelUri(bot, tag, space);
    let model = monaco.editor.getModel(uri);
    if (!model) {
        let script = getScript(bot, tag, space);
        let language = tagScriptLanguage(
            simulation,
            tag,
            getTagValueForSpace(bot, tag, space)
        );
        model = monaco.editor.createModel(script, language, uri);

        watchModel(simulation, model, bot, tag, space, language, getEditor);
    }

    return model;
}

function tagScriptLanguage(
    simulation: BrowserSimulation,
    tag: string,
    script: any
): string {
    if (isScript(script)) {
        return 'typescript';
    } else if (
        (typeof script === 'object' && hasValue(script)) ||
        isFormula(script)
    ) {
        return 'json';
    } else if (tag.indexOf('.') >= 0) {
        return undefined;
    }

    const prefix = getScriptPrefix(simulation, script);
    if (prefix) {
        return prefix.language;
    }

    return 'plaintext';
}

function getScriptPrefix(simulation: BrowserSimulation, script: any) {
    return simulation.portals.scriptPrefixes.find(
        (p) => typeof script === 'string' && script.startsWith(p.prefix)
    );
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
        return (
            info.isScript ||
            info.isFormula ||
            info.isCustomPortalScript ||
            info.isModule
        );
    } else {
        return true;
    }
}

function watchModel(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    bot: Bot,
    tag: string,
    space: string,
    language: string,
    getEditor: () => monaco.editor.IEditor
) {
    let sub = new Subscription();
    let info: ModelInfo = {
        simId: simulation.id,
        botId: bot.id,
        tag: tag,
        space,
        decorators: [],
        isFormula: false,
        isScript: false,
        isModule: false,
        isCustomPortalScript: false,
        editOffset: 0,
        prefix: '',
        model: model,
        language: language,
        sub: sub,
    };

    let lastVersion = simulation.watcher.latestVersion;
    let applyingEdits: boolean = false;

    const applyEdit = (update: BotTagEdit) => {
        const userSelections = getEditor()?.getSelections() || [];
        const selectionPositions = userSelections.map(
            (s) =>
                [
                    new monaco.Position(s.startLineNumber, s.startColumn),
                    new monaco.Position(s.endLineNumber, s.endColumn),
                ] as [monaco.Position, monaco.Position]
        );

        for (let ops of update.operations) {
            let index = -info.editOffset;
            for (let op of ops) {
                if (op.type === 'preserve') {
                    index += op.count;
                } else if (op.type === 'insert') {
                    const pos = model.getPositionAt(index);
                    const selection = new monaco.Selection(
                        pos.lineNumber,
                        pos.column,
                        pos.lineNumber,
                        pos.column
                    );

                    try {
                        applyingEdits = true;
                        model.pushEditOperations(
                            [],
                            [{ range: selection, text: op.text }],
                            () => null
                        );
                    } finally {
                        applyingEdits = false;
                    }

                    index += op.text.length;

                    const endPos = model.getPositionAt(index);

                    offsetSelections(pos, endPos, selectionPositions);
                } else if (op.type === 'delete') {
                    const startPos = model.getPositionAt(index);
                    const endPos = model.getPositionAt(index + op.count);
                    const selection = new monaco.Selection(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column
                    );
                    try {
                        applyingEdits = true;
                        model.pushEditOperations(
                            [],
                            [{ range: selection, text: '' }],
                            () => null
                        );
                    } finally {
                        applyingEdits = false;
                    }

                    // Start and end positions are switched
                    // so that deltas are negative
                    offsetSelections(endPos, startPos, selectionPositions);
                }
            }
        }

        const finalSelections = selectionPositions.map(
            ([start, end]) =>
                new monaco.Selection(
                    start.lineNumber,
                    start.column,
                    end.lineNumber,
                    end.column
                )
        );
        getEditor()?.setSelections(finalSelections);
    };

    const applyUpdate = (update: BotTagUpdate) => {
        if (model === activeModel) {
            return;
        }
        let script = getScript(bot, tag, space);
        let value = model.getValue();
        try {
            applyingEdits = true;
            if (script !== value) {
                model.setValue(script);
            }
            updateLanguage(
                simulation,
                model,
                tag,
                getTagValueForSpace(bot, tag, space),
                true
            );
        } finally {
            applyingEdits = false;
        }
    };

    const isApplyableChange = (update: BotTagChange) => {
        // Only allow updates that are not edits
        // or are not from the current site.
        // TODO: Improve to allow edits from the current site to be mixed with
        // edits from other sites.
        return (
            update.type !== 'edit' ||
            Object.keys(simulation.watcher.localSites).every(
                (site) => !hasValue(update.version[site])
            )
        );
    };

    sub.add(
        simulation.watcher
            .botTagChanged(bot.id, tag, space)
            .pipe(
                skip(1),
                takeWhile((update) => update !== null)
            )
            .subscribe((update) => {
                // Ensure that the version vector is updated in the same browser tick
                // as applying the update to the editor.
                // If we update the version vector and apply the update in separate browser ticks,
                // then it is possible for a user edit to get in between the version vector update and the
                // update to the editor, which might cause the applied updates to be incorrect.

                // Update the version vector
                lastVersion.vector = mergeVersions(
                    lastVersion.vector,
                    update.version
                );

                // Check if we can apply the change to the editor
                if (!isApplyableChange(update)) {
                    return;
                }

                // Apply the change.
                bot = update.bot;
                if (update.type === 'edit') {
                    applyEdit(update);
                } else {
                    applyUpdate(update);
                }
            })
    );

    sub.add(
        toSubscription(
            model.onDidChangeContent(async (e) => {
                const info = models.get(model.uri.toString());
                if (applyingEdits) {
                    return;
                }
                let operations = [] as TagEditOp[][];
                let index = 0;
                let offset = info.editOffset;

                if (info.isFormula && !hasValue(info.prefix)) {
                    operations.push([insert(DNA_TAG_PREFIX)]);
                    offset += DNA_TAG_PREFIX.length;
                    info.editOffset = DNA_TAG_PREFIX.length;
                    info.prefix = DNA_TAG_PREFIX;
                }

                const changes = sortBy(e.changes, (c) => c.rangeOffset);
                for (let change of changes) {
                    operations.push([
                        preserve(change.rangeOffset - index + offset),
                        del(change.rangeLength),
                        insert(change.text),
                    ]);
                    index += change.rangeLength;
                    offset += change.text.length;
                }
                await simulation.editBot(
                    bot,
                    tag,
                    edits(lastVersion.vector, ...operations),
                    space
                );
            })
        )
    );

    sub.add(
        simulation.watcher.botsRemoved
            .pipe(
                mergeMap((f) => f),
                first((id) => id === bot.id)
            )
            .subscribe((f) => {
                unloadModel(model);
            })
    );

    sub.add(
        merge(
            simulation.portals.prefixesDiscovered.pipe(map((p) => {})),
            simulation.portals.prefixesRemoved.pipe(map((p) => {}))
        )
            .pipe(
                tap((p) => {
                    try {
                        applyingEdits = true;
                        updateLanguage(
                            simulation,
                            model,
                            tag,
                            getTagValueForSpace(bot, tag, space)
                        );
                    } finally {
                        applyingEdits = false;
                    }
                })
            )
            .subscribe()
    );

    models.set(model.uri.toString(), info);

    // We need to wrap updateDecorators() because it might try to apply
    // an edit to the model.
    try {
        applyingEdits = true;
        updateDecorators(
            simulation,
            model,
            info,
            getTagValueForSpace(bot, tag, space)
        );
    } finally {
        applyingEdits = false;
    }

    subs.push(sub);
}

function offsetSelections(
    startPos: monaco.Position,
    endPos: monaco.Position,
    selectionPositions: [monaco.Position, monaco.Position][]
) {
    for (let selections of selectionPositions) {
        const selectionStart = selections[0];
        const selectionEnd = selections[1];
        const startBefore = selectionStart.isBefore(startPos);
        const endAfter = startPos.isBefore(selectionEnd);

        // Selection does not start before edit position.
        // We should offset the selection start by how much
        // the edit changes
        if (!startBefore) {
            if (selectionStart.lineNumber === startPos.lineNumber) {
                selections[0] = selectionStart.delta(
                    endPos.lineNumber - startPos.lineNumber,
                    endPos.column - startPos.column
                );
            }
        }

        // Selection ends after edit position.
        // We should offset the selection end by how much
        // the edit changes
        if (endAfter) {
            if (selectionEnd.lineNumber === startPos.lineNumber) {
                selections[1] = selectionEnd.delta(
                    endPos.lineNumber - startPos.lineNumber,
                    endPos.column - startPos.column
                );
            }
        }
    }
}

/**
 *
 * @param simulation
 * @param model
 * @param tag
 * @param value
 * @param resetInfo Whether to reset the isFormula, isScript, and isCustomPortalScript properties of the info to false before updating decorators.
 * @returns
 */
function updateLanguage(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    tag: string,
    value: string,
    resetInfo: boolean = false
) {
    const info = models.get(model.uri.toString());
    if (!info) {
        return;
    }
    if (resetInfo) {
        info.isScript = false;
        info.isFormula = false;
        info.isCustomPortalScript = false;
        info.prefix = '';
    }

    const currentLanguage = model.getLanguageId();
    const nextLanguage = tagScriptLanguage(simulation, tag, value);
    info.language = nextLanguage;
    if (typeof nextLanguage === 'string' && nextLanguage !== currentLanguage) {
        monaco.editor.setModelLanguage(model, nextLanguage);
    }
    updateDecorators(simulation, model, info, value);
}

function updateDecorators(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    info: ModelInfo,
    value: string
) {
    const oldPrefix = info.prefix;
    const prefix = calcGetScriptPrefix(KNOWN_TAG_PREFIXES, value);
    info.isFormula = isFormula(value);
    info.isScript = isScript(value);
    info.isModule = isModule(value);
    info.isCustomPortalScript = false;
    info.prefix = prefix ?? '';
    if (hasValue(prefix)) {
        const prefixChanged = oldPrefix !== prefix;
        info.editOffset = prefix.length;
        if (prefixChanged) {
            const text = model.getValue();
            if (isPortalScript(prefix, text)) {
                // Delete the first character from the model cause
                // it is a prefix marker
                model.applyEdits([
                    {
                        range: new monaco.Range(1, 1, 1, 1 + info.editOffset),
                        text: '',
                    },
                ]);
            }
        }

        info.decorators = model.deltaDecorations(info.decorators, [
            {
                range: new monaco.Range(1, 1, 1, 1),
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName: 'formula-marker',
                },
            },
        ]);
    } else if (isCustomPortalScript(simulation, value)) {
        const prefix = getScriptPrefix(simulation, value);

        const wasPortalScript = info.isCustomPortalScript;
        info.isFormula = false;
        info.isScript = false;
        info.isModule = false;
        info.isCustomPortalScript = true;
        info.editOffset = prefix.prefix.length;

        if (!wasPortalScript) {
            const text = model.getValue();
            if (getScriptPrefix(simulation, text) === prefix) {
                model.applyEdits([
                    {
                        range: new monaco.Range(1, 1, 1, 1 + info.editOffset),
                        text: '',
                    },
                ]);
            }
        }
    } else {
        info.decorators = model.deltaDecorations(info.decorators, []);
        info.isFormula = typeof value === 'object' && hasValue(value);
        info.isScript = false;
        info.isModule = false;
        info.isCustomPortalScript = false;
        info.editOffset = 0;
    }
}

function getModelUri(bot: Bot, tag: string, space: string) {
    return parseModelUriFromId(bot.id, tag, space);
}

function parseModelUriFromId(id: string, tag: string, space: string) {
    return monaco.Uri.parse(getModelUriFromId(id, tag, space));
}

export function getScript(bot: Bot, tag: string, space: string) {
    let val = getTagValueForSpace(bot, tag, space);
    if (typeof val !== 'undefined' && val !== null) {
        let str = val.toString();
        if (typeof val === 'object') {
            str = JSON.stringify(val);
        }
        if (isFormula(str)) {
            return replaceMacros(str);
        } else {
            return str;
        }
    } else {
        return val || '';
    }
}

export function isCustomPortalScript(
    simulation: BrowserSimulation,
    value: unknown
) {
    const prefixes = simulation.portals.scriptPrefixes.map((p) => p.prefix);
    return hasPortalScript(prefixes, value);
}

export function toSubscription(disposable: monaco.IDisposable) {
    return new Subscription(() => disposable.dispose());
}
