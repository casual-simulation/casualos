import * as monaco from './MonacoLibs';
import {
    Bot,
    tagsOnBot,
    isFormula,
    Transpiler,
    KNOWN_TAGS,
    isScript,
    hasValue,
    getTagValueForSpace,
    calculateBotValue,
    BotsState,
    calculateBooleanTagValue,
    isBotInDimension,
    getBotShape,
    getActiveObjects,
    calculateNumericalTagValue,
    calculateStringTagValue,
    calculateFormattedBotValue,
} from '@casual-simulation/aux-common';
import EditorWorker from 'worker-loader!monaco-editor/esm/vs/editor/editor.worker.js';
import TypescriptWorker from 'worker-loader!monaco-editor/esm/vs/language/typescript/ts.worker';
import HtmlWorker from 'worker-loader!monaco-editor/esm/vs/language/html/html.worker';
import CssWorker from 'worker-loader!monaco-editor/esm/vs/language/css/css.worker';
import JsonWorker from 'worker-loader!monaco-editor/esm/vs/language/json/json.worker';
import { calculateFormulaDefinitions } from './FormulaHelpers';
import { libFileMap } from 'monaco-editor/esm/vs/language/typescript/lib/lib.js';
import { SimpleEditorModelResolverService } from 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';
import { SubscriptionLike, Subscription, Observable, NEVER, merge } from 'rxjs';
import {
    skip,
    flatMap,
    filter,
    first,
    takeWhile,
    tap,
    switchMap,
    map,
    scan,
    delay,
} from 'rxjs/operators';
import { Simulation } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import { propertyInsertText } from './CompletionHelpers';
import {
    bot,
    del,
    edit,
    edits,
    insert,
    mergeVersions,
    preserve,
    TagEditOp,
} from '@casual-simulation/aux-common/aux-format-2';
import { CurrentVersion } from '@casual-simulation/causal-trees';
import { Color } from 'three';
import { sha256 } from 'hash.js';
import { invertColor } from './scene/ColorUtils';

let cursorColors = document.createElement('style');
document.body.appendChild(cursorColors);

let availableColors = new Map<string, string>();
let availableLabels = new Map<string, HTMLStyleElement>();
let stylesheet = '';

function createColorClass(
    name: string,
    backgroundColor: Color,
    alpha: number
): [string, string] {
    const bRed = backgroundColor.r * 255;
    const bGreen = backgroundColor.g * 255;
    const bBlue = backgroundColor.b * 255;
    return [
        name,
        `.${name} {
        background-color: rgba(${bRed}, ${bGreen}, ${bBlue}, ${alpha});
    }
    
    .${name}::after {
        border-color: rgba(${bRed}, ${bGreen}, ${bBlue}, ${alpha});
    }`,
    ];
}

function createHoverClass(
    name: string,
    backgroundColor: Color,
    foregroundColor: Color,
    label: string
): string {
    const bRed = backgroundColor.r * 255;
    const bGreen = backgroundColor.g * 255;
    const bBlue = backgroundColor.b * 255;
    const fRed = foregroundColor.r * 255;
    const fGreen = foregroundColor.g * 255;
    const fBlue = foregroundColor.b * 255;
    return `.${name}:hover::after {
        content: '${label}';
        background-color: rgb(${bRed}, ${bGreen}, ${bBlue});
        color: rgb(${fRed}, ${fGreen}, ${fBlue});
        background-color: #000;
        color: #fff;
        border-width: 0;
        border-radius: 0;
        font-size: 12px;
        line-height: 12px;
        padding: 1px;
        left: -2px;
        top: -13px;
        overflow: hidden;
        width: auto;
        height: auto;
    }`;
}

function getColorClass(
    prefix: string,
    color: string,
    alpha: number = 0.5
): string {
    const c = new Color(color);
    const hex = c.getHexString();
    const name = prefix + hex;
    if (availableColors.has(name)) {
        return availableColors.get(name);
    } else {
        const [colorClass, colorStyle] = createColorClass(name, c, alpha);
        stylesheet += '\n' + colorStyle;
        cursorColors.innerHTML = stylesheet;
        availableColors.set(name, colorClass);

        return colorClass;
    }
}

function getLabelStyle(name: string): HTMLStyleElement {
    if (availableLabels.has(name)) {
        return availableLabels.get(name);
    } else {
        const style = document.createElement('style');
        document.body.appendChild(style);
        availableLabels.set(name, style);
        return style;
    }
}

function getLabelClass(
    prefix: string,
    id: string,
    foregroundColor: string,
    backgroundColor: string,
    label: string
): string {
    const foreground = new Color(foregroundColor);
    const background = new Color(backgroundColor);
    const name = prefix + id;
    const styleElement = getLabelStyle(name);

    const style = createHoverClass(name, background, foreground, label);
    if (styleElement.innerHTML !== style) {
        styleElement.innerHTML = style;
    }

    return name;
}

export function setup() {
    // Tell monaco how to create the web workers
    (<any>self).MonacoEnvironment = {
        getWorker: function (moduleId: string, label: string) {
            if (label === 'typescript' || label === 'javascript') {
                return new TypescriptWorker();
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

    // Set compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2015,

        // Auto-import the given libraries
        lib: ['defaultLib:lib.es2015.d.ts', 'file:///AuxDefinitions.d.ts'],

        allowJs: true,
        alwaysStrict: true,
        checkJs: true,
        newLine: monaco.languages.typescript.NewLineKind.LineFeed,
        noEmit: true,
    });

    // Eagerly sync models to get intellisense for all models
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    // Register the ES2015 core library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        libFileMap['lib.es2015.d.ts'],
        'defaultLib:lib.es2015.d.ts'
    );

    // Register the formula library
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
        calculateFormulaDefinitions(),
        'file:///AuxDefinitions.d.ts'
    );

    /**
     * Monkeypatch to make 'Find All References' work across multiple files
     * https://github.com/Microsoft/monaco-editor/issues/779#issuecomment-374258435
     */
    SimpleEditorModelResolverService.prototype.findModel = function (
        editor: monaco.editor.IStandaloneCodeEditor,
        resource: any
    ) {
        return monaco.editor
            .getModels()
            .find((model) => model.uri.toString() === resource.toString());
    };
}

interface ModelInfo {
    botId: string;
    tag: string;
    decorators: string[];
    isFormula: boolean;
    isScript: boolean;
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
export function watchSimulation(
    simulation: BrowserSimulation,
    getEditor: () => monaco.editor.ICodeEditor
) {
    let sub = simulation.watcher.botsDiscovered
        .pipe(flatMap((f) => f))
        .subscribe((f) => {
            for (let tag of tagsOnBot(f)) {
                if (
                    shouldKeepModelWithTagLoaded(tag) ||
                    isFormula(f.tags[tag])
                ) {
                    loadModel(simulation, f, tag, null, getEditor);
                }
            }
        });

    let referencesDisposable = monaco.languages.registerReferenceProvider(
        'javascript',
        {
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
                            const bot = simulation.helper.botsState[id];
                            // TODO: Support references to tag masks
                            let m = loadModel(
                                simulation,
                                bot,
                                tag,
                                null,
                                getEditor
                            );
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
                                    .map((r) => ({
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
        }
    );

    let completionDisposable = monaco.languages.registerCompletionItemProvider(
        'javascript',
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

    sub.add(() => {
        referencesDisposable.dispose();
        completionDisposable.dispose();
    });

    return sub;
}

const DECORATOR_OWNER_ID: number = 9731;

export function watchEditor(
    simulation: Simulation,
    editor: monaco.editor.ICodeEditor
): Subscription {
    const modelChangeObservable = new Observable<
        monaco.editor.IModelChangedEvent
    >((sub) => {
        return toSubscription(editor.onDidChangeModel((e) => sub.next(e)));
    });

    const decorators = modelChangeObservable.pipe(
        delay(100),
        filter((e) => !!e.newModelUrl),
        switchMap((e) => {
            const info = models.get(e.newModelUrl.toString());
            if (!info) {
                console.warn(
                    `[MonacoHelpers] Cannot watch model (${e.newModelUrl.toString()}) cursor bots.`
                );
                return NEVER;
            }

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
                    if (event.type === 'added_or_updated') {
                        for (let bot of event.bots) {
                            if (
                                isBotInDimension(null, bot, dimension) ===
                                    true &&
                                getBotShape(null, bot) === 'cursor'
                            ) {
                                state[bot.id] = bot;
                            }
                        }
                    } else {
                        for (let id of event.ids) {
                            delete state[id];
                        }
                    }
                    return state;
                }, {} as BotsState)
            );

            const botDecorators = dimensionStates.pipe(
                map((state) => {
                    let decorators = [] as monaco.editor.IModelDeltaDecoration[];
                    let offset = info?.isScript || info?.isFormula ? 1 : 0;
                    for (let bot of getActiveObjects(state)) {
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
                        const startPosition = info.model.getPositionAt(
                            cursorStart - offset
                        );
                        const endPosition = info.model.getPositionAt(
                            cursorEnd - offset
                        );
                        const range = new monaco.Range(
                            startPosition.lineNumber,
                            startPosition.column,
                            endPosition.lineNumber,
                            endPosition.column
                        );

                        let beforeContentClassName: string;
                        let afterContentClassName: string;

                        const color = calculateStringTagValue(
                            null,
                            bot,
                            'color',
                            'black'
                        );
                        const colorClass = getColorClass(
                            'bot-cursor-color-',
                            color,
                            0.1
                        );
                        const notchColorClass = getColorClass(
                            'bot-notch-cursor-color-',
                            color,
                            1
                        );

                        const label = calculateFormattedBotValue(
                            null,
                            bot,
                            'auxLabel'
                        );

                        const inverseColor = invertColor(
                            new Color(color).getHexString(),
                            true
                        );
                        const labelForeground = calculateStringTagValue(
                            null,
                            bot,
                            'labelColor',
                            inverseColor
                        );

                        let labelClass = '';
                        if (hasValue(label)) {
                            labelClass = getLabelClass(
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

                        decorators.push({
                            range,
                            options: {
                                className: `bot-cursor ${colorClass}`,
                                beforeContentClassName,
                                afterContentClassName,
                            },
                        });
                    }

                    return decorators;
                })
            );

            return botDecorators;
        }),

        scan((ids, decorators) => {
            return editor.getModel().deltaDecorations(ids, decorators);
        }, [] as string[])
    );

    const sub = new Subscription();

    sub.add(decorators.subscribe());

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

                const offset = info?.isScript || info?.isFormula ? 1 : 0;
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
 * @param simulation The simulation that the bot is in.
 * @param bot The bot.
 * @param tag The tag.
 */
export function loadModel(
    simulation: BrowserSimulation,
    bot: Bot,
    tag: string,
    space: string,
    getEditor: () => monaco.editor.ICodeEditor
) {
    const uri = getModelUri(bot, tag, space);
    let model = monaco.editor.getModel(uri);
    if (!model) {
        let script = getScript(bot, tag, space);
        model = monaco.editor.createModel(
            script,
            tagScriptLanguage(tag, getTagValueForSpace(bot, tag, space)),
            uri
        );

        watchModel(simulation, model, bot, tag, space, getEditor);
    }

    return model;
}

function tagScriptLanguage(tag: string, script: any): string {
    return isFormula(script) || isScript(script)
        ? 'javascript'
        : tag.indexOf('.') >= 0
        ? undefined
        : 'plaintext';
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
        return shouldKeepModelWithTagLoaded(info.tag) || info.isFormula;
    } else {
        return true;
    }
}

function shouldKeepModelWithTagLoaded(tag: string): boolean {
    return isScript(tag);
}

function watchModel(
    simulation: BrowserSimulation,
    model: monaco.editor.ITextModel,
    bot: Bot,
    tag: string,
    space: string,
    getEditor: () => monaco.editor.ICodeEditor
) {
    let sub = new Subscription();
    let info: ModelInfo = {
        botId: bot.id,
        tag: tag,
        decorators: [],
        isFormula: false,
        isScript: false,
        model: model,
        sub: sub,
    };
    let lastVersion = simulation.watcher.latestVersion;
    let applyingEdits: boolean = false;

    sub.add(
        simulation.watcher
            .botTagChanged(bot.id, tag, space)
            .pipe(
                tap((update) => {
                    lastVersion.vector = mergeVersions(
                        lastVersion.vector,
                        update.version
                    );
                }),
                filter((update) => {
                    // Only allow updates that are not edits
                    // or are not from the current site.
                    // TODO: Improve to allow edits from the current site to be mixed with
                    // edits from other sites.
                    return (
                        update.type !== 'edit' ||
                        Object.keys(lastVersion.localSites).every(
                            (site) => !hasValue(update.version[site])
                        )
                    );
                }),
                skip(1),
                takeWhile((update) => update !== null)
            )
            .subscribe((update) => {
                bot = update.bot;
                if (update.type === 'edit') {
                    const userSelections = getEditor()?.getSelections() || [];
                    const selectionPositions = userSelections.map(
                        (s) =>
                            [
                                new monaco.Position(
                                    s.startLineNumber,
                                    s.startColumn
                                ),
                                new monaco.Position(
                                    s.endLineNumber,
                                    s.endColumn
                                ),
                            ] as [monaco.Position, monaco.Position]
                    );

                    for (let ops of update.operations) {
                        let index = info.isFormula || info.isScript ? -1 : 0;
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

                                offsetSelections(
                                    pos,
                                    endPos,
                                    selectionPositions
                                );
                            } else if (op.type === 'delete') {
                                const startPos = model.getPositionAt(index);
                                const endPos = model.getPositionAt(
                                    index + op.count
                                );
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
                                offsetSelections(
                                    endPos,
                                    startPos,
                                    selectionPositions
                                );
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
                } else {
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
                            model,
                            tag,
                            getTagValueForSpace(bot, tag, space)
                        );
                    } finally {
                        applyingEdits = false;
                    }
                }
            })
    );

    // TODO:
    sub.add(
        toSubscription(
            model.onDidChangeContent(async (e) => {
                const info = models.get(model.uri.toString());
                if (info.isFormula || info.isScript) {
                    if (
                        e.changes.every(
                            (c) => c.rangeOffset === 0 && c.rangeLength === 1
                        )
                    ) {
                        return;
                    }
                }
                if (applyingEdits) {
                    return;
                }
                let operations = [] as TagEditOp[][];
                let index = 0;
                let offset = info.isFormula || info.isScript ? 1 : 0;
                const changes = sortBy(e.changes, (c) => c.rangeOffset);
                for (let change of changes) {
                    operations.push([
                        preserve(change.rangeOffset - index + offset),
                        del(change.rangeLength),
                        insert(change.text),
                    ]);
                    index += change.rangeLength;
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

    // sub.add(
    //     toSubscription(
    //         model.onDidChangeContent(async (e) => {
    //             if (e.isFlush) {
    //                 return;
    //             }
    //             let val = model.getValue();
    //             if (info.isFormula) {
    //                 val = '=' + val;
    //             } else if (info.isScript) {
    //                 if (val.indexOf('@') !== 0) {
    //                     val = '@' + val;
    //                 }
    //             }
    //             updateLanguage(model, tag, val);
    //             await simulation.editBot(bot, tag, val, space);
    //         })
    //     )
    // );

    sub.add(
        simulation.watcher.botsRemoved
            .pipe(
                flatMap((f) => f),
                first((id) => id === bot.id)
            )
            .subscribe((f) => {
                unloadModel(model);
            })
    );

    models.set(model.uri.toString(), info);
    updateDecorators(model, info, getTagValueForSpace(bot, tag, space));
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
    if (typeof nextLanguage === 'string' && nextLanguage !== currentLanguage) {
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
        const wasFormula = info.isFormula;
        info.isFormula = true;
        info.isScript = false;
        if (!wasFormula) {
            const text = model.getValue();
            if (text.indexOf('=') === 0) {
                // Delete the first character from the model cause
                // it is a formula marker
                model.applyEdits([
                    {
                        range: new monaco.Range(1, 1, 1, 2),
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
    } else if (isScript(value)) {
        const wasScript = info.isScript;
        info.isScript = true;
        info.isFormula = false;

        if (!wasScript) {
            const text = model.getValue();
            if (text.indexOf('@') === 0) {
                // Delete the first character from the model cause
                // it is a script marker
                model.applyEdits([
                    {
                        range: new monaco.Range(1, 1, 1, 2),
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
                    linesDecorationsClassName: 'script-marker',
                },
            },
        ]);
    } else {
        info.decorators = model.deltaDecorations(info.decorators, []);
        info.isFormula = false;
        info.isScript = false;
    }
}

function getModelUri(bot: Bot, tag: string, space: string) {
    return getModelUriFromId(bot.id, tag, space);
}

function getModelUriFromId(id: string, tag: string, space: string) {
    let tagWithExtension = tag.indexOf('.') >= 0 ? tag : `${tag}.js`;
    if (hasValue(space)) {
        return monaco.Uri.parse(
            encodeURI(`file:///${id}/${space}/${tagWithExtension}`)
        );
    } else {
        return monaco.Uri.parse(encodeURI(`file:///${id}/${tagWithExtension}`));
    }
}

export function getScript(bot: Bot, tag: string, space: string) {
    let val = getTagValueForSpace(bot, tag, space);
    if (typeof val !== 'undefined' && val !== null) {
        let str = val.toString();
        if (typeof val === 'object') {
            str = JSON.stringify(val);
        }
        if (isFormula(str)) {
            return transpiler.replaceMacros(str);
        } else {
            return str;
        }
    } else {
        return val || '';
    }
}

export function toSubscription(disposable: monaco.IDisposable) {
    return new Subscription(() => disposable.dispose());
}
