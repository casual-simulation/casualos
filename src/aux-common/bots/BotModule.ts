/**
 * Defines a function that can be used to import a module.
 * @param id The ID of the module to import.
 */
export type ImportFunc = (id: string) => Promise<BotModuleResult>;

/**
 * Defines a function that can be used to export a value from a module.
 * @param valueOrSource The value to export or the source code to export.
 * @param exports The exports to export from the source.
 */
export type ExportFunc = (
    valueOrSource: object | string,
    exports?: ([string] | [string, string])[]
) => void;

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

/**
 * Defines a module that has been identified by the {@link AuxRuntime}.
 */
export interface IdentifiedBotModule extends BotModule {
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
