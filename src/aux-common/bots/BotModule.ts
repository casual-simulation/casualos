/**
 * Defines a function that can be used to import a module.
 * @param id The ID of the module to import.
 * @param meta The metadata about the import.
 */
export type ImportFunc = (
    id: string | ResolvedBotModule,
    meta?: ImportMetadata
) => Promise<BotModuleResult>;

/**
 * Defines a function that can be used to export a value from a module.
 * @param valueOrSource The value to export or the source code to export.
 * @param exports The exports to export from the source.
 * @param meta The metadata about the export.
 */
export type ExportFunc = (
    valueOrSource: object | string,
    exports?: (string | [string, string])[],
    meta?: ImportMetadata
) => Promise<void>;

export interface ImportMetadata {
    /**
     * The ID of the bot that the module is defined in.
     */
    botId?: string;

    /**
     * The name of the tag that the module is defined in.
     */
    tag?: string;

    /**
     * Attempts to resolve the given module.
     * Returns a promise that resolves with the module that should be used. If the module cannot be resolved, the promise will resolve with undefined.
     * @param module The module to resolve.
     */
    resolve?(module: string): Promise<ResolvedBotModule>;
}

/**
 * Defines a ES Module that can be loaded by the {@link AuxRuntime}.
 */
export interface BotModule {
    /**
     * The function that executes the module's code with the given import and export functions.
     * @param importFunc The function that can be used to import other modules.
     * @param exportFunc The function that can be used to register the module's exports.
     * @returns Returns a promise that resolves with the module's return value.
     */
    moduleFunc: (
        importFunc: ImportFunc,
        exportFunc: ExportFunc
    ) => Promise<any>;
}

export type ResolvedBotModule =
    | IdentifiedBotModule
    | SourceModule
    | ExportsModule
    | UrlModule;

/**
 * Defines a module that has been identified by the {@link AuxRuntime}.
 * It is made up of a link to a bot and a tag.
 */
export interface IdentifiedBotModule {
    /**
     * The ID of the module.
     */
    id: string;

    /**
     * The ID of the bot that the module is defined in.
     */
    botId: string;

    /**
     * The name of the tag that the module is defined in.
     */
    tag: string;
}

/**
 * Defines a module that is made up of source code.
 */
export interface SourceModule {
    /**
     * The ID of the module.
     */
    id: string;

    /**
     * The source code of the module.
     */
    source: string;
}

/**
 * Defines a module that is loaded from a URL.
 */
export interface UrlModule {
    /**
     * The ID of the module.
     */
    id: string;

    /**
     * The URL that the module is located at.
     */
    url: string;
}

/**
 * Defines a module that is made up of exports.
 */
export interface ExportsModule {
    /**
     * The ID of the module.
     */
    id: string;

    /**
     * The exports of the module.
     */
    exports: BotModuleResult;
}

/**
 * Defines an interface that represents the result of importing a module.
 */
export interface BotModuleResult {
    /**
     * The default export of the module.
     */
    default?: any;

    /**
     * The named exports of the module.
     */
    [exportName: string]: any;
}
