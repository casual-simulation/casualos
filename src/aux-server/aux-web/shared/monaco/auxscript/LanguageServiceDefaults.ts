import type { IEvent } from '@casual-simulation/monaco-editor';
import { Emitter, IDisposable } from '@casual-simulation/monaco-editor';
import type ts from 'typescript';

type CompilerOptions = ts.CompilerOptions;
type Diagnostic = ts.Diagnostic;

interface EmitOutput {
    outputFiles: OutputFile[];
    emitSkipped: boolean;
}

interface OutputFile {
    name: string;
    writeByteOrderMark: boolean;
    text: string;
}

export interface DiagnosticsOptions {
    noSemanticValidation?: boolean;
    noSyntaxValidation?: boolean;
    noSuggestionDiagnostics?: boolean;
    /**
     * Limit diagnostic computation to only visible files.
     * Defaults to false.
     */
    onlyVisible?: boolean;
    diagnosticCodesToIgnore?: number[];
}

interface InlayHintsOptions {
    readonly includeInlayParameterNameHints?: 'none' | 'literals' | 'all';
    readonly includeInlayParameterNameHintsWhenArgumentMatchesName?: boolean;
    readonly includeInlayFunctionParameterTypeHints?: boolean;
    readonly includeInlayVariableTypeHints?: boolean;
    readonly includeInlayPropertyDeclarationTypeHints?: boolean;
    readonly includeInlayFunctionLikeReturnTypeHints?: boolean;
    readonly includeInlayEnumMemberValueHints?: boolean;
}

interface IExtraLib {
    content: string;
    version: number;
}

export interface IExtraLibs {
    [path: string]: IExtraLib;
}

export interface LanguageServiceDefaults {
    /**
     * Event fired when compiler options or diagnostics options are changed.
     */
    readonly onDidChange: IEvent<void>;

    /**
     * Event fired when extra libraries registered with the language service change.
     */
    readonly onDidExtraLibsChange: IEvent<void>;

    readonly inlayHintsOptions: InlayHintsOptions;

    /**
     * Get the current extra libs registered with the language service.
     */
    getExtraLibs(): IExtraLibs;

    /**
     * Add an additional source file to the language service. Use this
     * for typescript (definition) files that won't be loaded as editor
     * documents, like `jquery.d.ts`.
     *
     * @param content The file content
     * @param filePath An optional file path
     * @returns A disposable which will remove the file from the
     * language service upon disposal.
     */
    addExtraLib(content: string, filePath?: string): IDisposable;

    /**
     * Remove all existing extra libs and set the additional source
     * files to the language service. Use this for typescript definition
     * files that won't be loaded as editor documents, like `jquery.d.ts`.
     * @param libs An array of entries to register.
     */
    setExtraLibs(libs: { content: string; filePath?: string }[]): void;

    /**
     * Get current TypeScript compiler options for the language service.
     */
    getCompilerOptions(): CompilerOptions;

    /**
     * Set TypeScript compiler options.
     */
    setCompilerOptions(options: CompilerOptions): void;

    /**
     * Get the current diagnostics options for the language service.
     */
    getDiagnosticsOptions(): DiagnosticsOptions;

    /**
     * Configure whether syntactic and/or semantic validation should
     * be performed
     */
    setDiagnosticsOptions(options: DiagnosticsOptions): void;

    /**
     * No-op.
     */
    setMaximumWorkerIdleTime(value: number): void;

    /**
     * Configure if all existing models should be eagerly sync'd
     * to the worker on start or restart.
     */
    setEagerModelSync(value: boolean): void;

    /**
     * Get the current setting for whether all existing models should be eagerly sync'd
     * to the worker on start or restart.
     */
    getEagerModelSync(): boolean;

    /**
     * Configure inlay hints options.
     */
    setInlayHintsOptions(options: InlayHintsOptions): void;
}

export interface TypeScriptWorker {
    /**
     * Get diagnostic messages for any syntax issues in the given file.
     */
    getSyntacticDiagnostics(fileName: string): Promise<Diagnostic[]>;

    /**
     * Get diagnostic messages for any semantic issues in the given file.
     */
    getSemanticDiagnostics(fileName: string): Promise<Diagnostic[]>;

    /**
     * Get diagnostic messages for any suggestions related to the given file.
     */
    getSuggestionDiagnostics(fileName: string): Promise<Diagnostic[]>;

    /**
     * Get the content of a given file.
     */
    getScriptText(fileName: string): Promise<string | undefined>;

    /**
     * Get diagnostic messages related to the current compiler options.
     * @param fileName Not used
     */
    getCompilerOptionsDiagnostics(fileName: string): Promise<Diagnostic[]>;

    /**
     * Get code completions for the given file and position.
     * @returns `Promise<typescript.CompletionInfo | undefined>`
     */
    getCompletionsAtPosition(
        fileName: string,
        position: number
    ): Promise<any | undefined>;

    /**
     * Get code completion details for the given file, position, and entry.
     * @returns `Promise<typescript.CompletionEntryDetails | undefined>`
     */
    getCompletionEntryDetails(
        fileName: string,
        position: number,
        entry: string
    ): Promise<any | undefined>;

    /**
     * Get signature help items for the item at the given file and position.
     * @returns `Promise<typescript.SignatureHelpItems | undefined>`
     */
    getSignatureHelpItems(
        fileName: string,
        position: number,
        options: any
    ): Promise<any | undefined>;

    /**
     * Get quick info for the item at the given position in the file.
     * @returns `Promise<typescript.QuickInfo | undefined>`
     */
    getQuickInfoAtPosition(
        fileName: string,
        position: number
    ): Promise<any | undefined>;

    getDocumentHighlights(
        fileName: string,
        position: number,
        filesToSearch: string[]
    ): Promise<ReadonlyArray<any> | undefined>;

    /**
     * Get the definition of the item at the given position in the file.
     * @returns `Promise<ReadonlyArray<typescript.DefinitionInfo> | undefined>`
     */
    getDefinitionAtPosition(
        fileName: string,
        position: number
    ): Promise<ReadonlyArray<any> | undefined>;

    /**
     * Get references to the item at the given position in the file.
     * @returns `Promise<typescript.ReferenceEntry[] | undefined>`
     */
    getReferencesAtPosition(
        fileName: string,
        position: number
    ): Promise<any[] | undefined>;

    /**
     * Get outline entries for the item at the given position in the file.
     * @returns `Promise<typescript.NavigationTree | undefined>`
     */
    getNavigationTree(fileName: string): Promise<any | undefined>;

    /**
     * Get changes which should be applied to format the given file.
     * @param options `typescript.FormatCodeOptions`
     * @returns `Promise<typescript.TextChange[]>`
     */
    getFormattingEditsForDocument(
        fileName: string,
        options: any
    ): Promise<any[]>;

    /**
     * Get changes which should be applied to format the given range in the file.
     * @param options `typescript.FormatCodeOptions`
     * @returns `Promise<typescript.TextChange[]>`
     */
    getFormattingEditsForRange(
        fileName: string,
        start: number,
        end: number,
        options: any
    ): Promise<any[]>;

    /**
     * Get formatting changes which should be applied after the given keystroke.
     * @param options `typescript.FormatCodeOptions`
     * @returns `Promise<typescript.TextChange[]>`
     */
    getFormattingEditsAfterKeystroke(
        fileName: string,
        postion: number,
        ch: string,
        options: any
    ): Promise<any[]>;

    /**
     * Get other occurrences which should be updated when renaming the item at the given file and position.
     * @returns `Promise<readonly typescript.RenameLocation[] | undefined>`
     */
    findRenameLocations(
        fileName: string,
        positon: number,
        findInStrings: boolean,
        findInComments: boolean,
        providePrefixAndSuffixTextForRename: boolean
    ): Promise<readonly any[] | undefined>;

    /**
     * Get edits which should be applied to rename the item at the given file and position (or a failure reason).
     * @param options `typescript.RenameInfoOptions`
     * @returns `Promise<typescript.RenameInfo>`
     */
    getRenameInfo(
        fileName: string,
        positon: number,
        options: any
    ): Promise<any>;

    /**
     * Get transpiled output for the given file.
     * @returns `typescript.EmitOutput`
     */
    getEmitOutput(fileName: string): Promise<EmitOutput>;

    /**
     * Get possible code fixes at the given position in the file.
     * @param formatOptions `typescript.FormatCodeOptions`
     * @returns `Promise<ReadonlyArray<typescript.CodeFixAction>>`
     */
    getCodeFixesAtPosition(
        fileName: string,
        start: number,
        end: number,
        errorCodes: number[],
        formatOptions: any
    ): Promise<ReadonlyArray<any>>;

    /**
     * Get inlay hints in the range of the file.
     * @param fileName
     * @returns `Promise<typescript.InlayHint[]>`
     */
    provideInlayHints(
        fileName: string,
        start: number,
        end: number
    ): Promise<ReadonlyArray<any>>;
}

// --- TypeScript configuration and defaults ---------

export class LanguageServiceDefaultsImpl implements LanguageServiceDefaults {
    private _onDidChange = new Emitter<void>();
    private _onDidExtraLibsChange = new Emitter<void>();

    private _extraLibs: IExtraLibs;
    private _removedExtraLibs: { [path: string]: number };
    private _eagerModelSync: boolean;
    private _compilerOptions!: CompilerOptions;
    private _diagnosticsOptions!: DiagnosticsOptions;
    private _onDidExtraLibsChangeTimeout: number;
    private _inlayHintsOptions!: InlayHintsOptions;

    constructor(
        compilerOptions: CompilerOptions,
        diagnosticsOptions: DiagnosticsOptions,
        inlayHintsOptions: InlayHintsOptions
    ) {
        this._extraLibs = Object.create(null);
        this._removedExtraLibs = Object.create(null);
        this._eagerModelSync = false;
        this.setCompilerOptions(compilerOptions);
        this.setDiagnosticsOptions(diagnosticsOptions);
        this.setInlayHintsOptions(inlayHintsOptions);
        this._onDidExtraLibsChangeTimeout = -1;
    }

    get onDidChange(): IEvent<void> {
        return this._onDidChange.event;
    }

    get onDidExtraLibsChange(): IEvent<void> {
        return this._onDidExtraLibsChange.event;
    }

    get inlayHintsOptions(): InlayHintsOptions {
        return this._inlayHintsOptions;
    }

    getExtraLibs(): IExtraLibs {
        return this._extraLibs;
    }

    addExtraLib(content: string, _filePath?: string): IDisposable {
        let filePath: string;
        if (typeof _filePath === 'undefined') {
            filePath = `ts:extralib-${Math.random()
                .toString(36)
                .substring(2, 15)}`;
        } else {
            filePath = _filePath;
        }

        if (
            this._extraLibs[filePath] &&
            this._extraLibs[filePath].content === content
        ) {
            // no-op, there already exists an extra lib with this content
            return {
                dispose: () => {},
            };
        }

        let myVersion = 1;
        if (this._removedExtraLibs[filePath]) {
            myVersion = this._removedExtraLibs[filePath] + 1;
        }
        if (this._extraLibs[filePath]) {
            myVersion = this._extraLibs[filePath].version + 1;
        }

        this._extraLibs[filePath] = {
            content: content,
            version: myVersion,
        };
        this._fireOnDidExtraLibsChangeSoon();

        return {
            dispose: () => {
                let extraLib = this._extraLibs[filePath];
                if (!extraLib) {
                    return;
                }
                if (extraLib.version !== myVersion) {
                    return;
                }

                delete this._extraLibs[filePath];
                this._removedExtraLibs[filePath] = myVersion;
                this._fireOnDidExtraLibsChangeSoon();
            },
        };
    }

    setExtraLibs(libs: { content: string; filePath?: string }[]): void {
        for (const filePath in this._extraLibs) {
            this._removedExtraLibs[filePath] =
                this._extraLibs[filePath].version;
        }
        // clear out everything
        this._extraLibs = Object.create(null);

        if (libs && libs.length > 0) {
            for (const lib of libs) {
                const filePath =
                    lib.filePath ||
                    `ts:extralib-${Math.random()
                        .toString(36)
                        .substring(2, 15)}`;
                const content = lib.content;
                let myVersion = 1;
                if (this._removedExtraLibs[filePath]) {
                    myVersion = this._removedExtraLibs[filePath] + 1;
                }
                this._extraLibs[filePath] = {
                    content: content,
                    version: myVersion,
                };
            }
        }

        this._fireOnDidExtraLibsChangeSoon();
    }

    private _fireOnDidExtraLibsChangeSoon(): void {
        if (this._onDidExtraLibsChangeTimeout !== -1) {
            // already scheduled
            return;
        }
        this._onDidExtraLibsChangeTimeout = window.setTimeout(() => {
            this._onDidExtraLibsChangeTimeout = -1;
            this._onDidExtraLibsChange.fire(undefined);
        }, 0);
    }

    getCompilerOptions(): CompilerOptions {
        return this._compilerOptions;
    }

    setCompilerOptions(options: CompilerOptions): void {
        this._compilerOptions = options || Object.create(null);
        this._onDidChange.fire(undefined);
    }

    getDiagnosticsOptions(): DiagnosticsOptions {
        return this._diagnosticsOptions;
    }

    setDiagnosticsOptions(options: DiagnosticsOptions): void {
        this._diagnosticsOptions = options || Object.create(null);
        this._onDidChange.fire(undefined);
    }

    setInlayHintsOptions(options: InlayHintsOptions): void {
        this._inlayHintsOptions = options || Object.create(null);
        this._onDidChange.fire(undefined);
    }

    setMaximumWorkerIdleTime(value: number): void {}

    setEagerModelSync(value: boolean) {
        // doesn't fire an event since no
        // worker restart is required here
        this._eagerModelSync = value;
    }

    getEagerModelSync() {
        return this._eagerModelSync;
    }
}
