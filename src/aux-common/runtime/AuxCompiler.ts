import {
    calculateIndexFromLocation,
    calculateOriginalLineLocation,
    CodeLocation,
    Transpiler,
    TranspilerResult,
} from './Transpiler';
import { isFormula, isScript, parseScript, hasValue } from '../bots';
import { flatMap } from 'lodash';
import ErrorStackParser from '@casual-simulation/error-stack-parser';
import StackFrame from 'stackframe';

/**
 * A symbol that identifies a function as having been compiled using the AuxCompiler.
 */
export const COMPILED_SCRIPT_SYMBOL = Symbol('compiled_script');

const JSX_FACTORY = 'html.h';
const JSX_FRAGMENT_FACTORY = 'html.f';

/**
 * Defines a class that can compile scripts and formulas
 * into functions.
 */
export class AuxCompiler {
    private _transpiler = new Transpiler({
        jsxFactory: JSX_FACTORY,
        jsxFragment: JSX_FRAGMENT_FACTORY,
    });
    private _functionCache = new Map<string, Function>();

    /**
     * The offset that should be applied to error line numbers when calculating their original
     * position. Needed because Node.js Windows produces different line numbers than Mac/Linux.
     *
     * Node.js versions greater than v12.14.0 have an issue with identifying the correct line number
     * for errors and stack traces. This issue is fixed in Node.js v14 and later (possibly also fixed in v13 but I didn't check that).
     */
    functionErrorLineOffset: number = 0;

    /**
     * Calculates the "original" stack trace that the given error occurred at
     * within the given function.
     * Returns null if the original stack trace was unable to be determined.
     * @param functionNameMap A map of function names to their scripts.
     * @param error The error that occurred.
     */
    calculateOriginalStackTrace(
        functionNameMap: Map<string, AuxCompiledScript>,
        error: Error
    ): string {
        const frames = ErrorStackParser.parse(error);

        if (frames.length < 1) {
            return null;
        }

        let transformedFrames: StackFrame[] = [];
        let lastScriptFrameIndex = -1;
        let lastScript: AuxCompiledScript;
        for (let i = frames.length - 1; i >= 0; i--) {
            const frame = frames[i];
            const originFrame = frame.evalOrigin;
            let savedFrame = false;
            if (
                !!originFrame &&
                originFrame.functionName === '__constructFunction'
            ) {
                let functionName = frame.functionName;
                const lastDotIndex = functionName.lastIndexOf('.');
                if (lastDotIndex >= 0) {
                    functionName = functionName.slice(lastDotIndex + 1);
                }

                const script = functionNameMap.get(functionName);

                if (script) {
                    lastScript = script;
                    const location: CodeLocation = {
                        lineNumber:
                            originFrame.lineNumber +
                            this.functionErrorLineOffset,
                        column: originFrame.columnNumber,
                    };
                    const originalLocation = this.calculateOriginalLineLocation(
                        script,
                        location
                    );
                    savedFrame = true;
                    if (lastScriptFrameIndex < 0) {
                        lastScriptFrameIndex = i;
                    }
                    transformedFrames.unshift(
                        new StackFrame({
                            functionName:
                                lastScript.metadata.diagnosticFunctionName ??
                                functionName,
                            fileName: script.metadata.fileName ?? functionName,
                            lineNumber: originalLocation.lineNumber + 1,
                            columnNumber: originalLocation.column + 1,
                        })
                    );
                } else if (lastScript) {
                    const location: CodeLocation = {
                        lineNumber:
                            originFrame.lineNumber +
                            this.functionErrorLineOffset,
                        column: originFrame.columnNumber,
                    };
                    const originalLocation = this.calculateOriginalLineLocation(
                        lastScript,
                        location
                    );
                    savedFrame = true;
                    transformedFrames.unshift(
                        new StackFrame({
                            functionName:
                                lastScript.metadata.diagnosticFunctionName ??
                                functionName,
                            fileName:
                                lastScript.metadata.fileName ?? functionName,
                            lineNumber: originalLocation.lineNumber + 1,
                            columnNumber: originalLocation.column + 1,
                        })
                    );
                }
            }

            if (!savedFrame) {
                if (frame.functionName === '__wrapperFunc') {
                    savedFrame = true;
                    if (lastScriptFrameIndex > i) {
                        lastScriptFrameIndex -= 1;
                    }
                }
            }

            if (!savedFrame) {
                transformedFrames.unshift(frame);
            }
        }

        if (lastScriptFrameIndex >= 0) {
            const finalFrames = [
                ...transformedFrames.slice(0, lastScriptFrameIndex + 1),
                new StackFrame({
                    fileName: '[Native CasualOS Code]',
                    functionName: '<CasualOS>',
                }),
            ];

            const stack = finalFrames
                .map((frame) => '   at ' + frame.toString())
                .join('\n');
            return error.toString() + '\n' + stack;
        }

        return null;
    }

    /**
     * Calculates the original location within the given function for the given location.
     * @param func The function.
     * @param location The location.
     */
    calculateOriginalLineLocation(
        func: AuxCompiledScript,
        location: CodeLocation
    ): CodeLocation {
        // Line numbers should be one based
        if (location.lineNumber < func.metadata.scriptLineOffset) {
            return {
                lineNumber: 0,
                column: 0,
            };
        }

        let transpiledLocation: CodeLocation = {
            lineNumber:
                location.lineNumber - func.metadata.scriptLineOffset - 1,
            column: location.column - 1,
        };

        return calculateOriginalLineLocation(
            func.metadata.transpilerResult,
            transpiledLocation
        );
    }

    /**
     * Compiles the given script into a function.
     * @param script The script to compile.
     * @param options The options that should be used to compile the script.
     */
    compile<T>(
        script: string,
        options?: AuxCompileOptions<T>
    ): AuxCompiledScript {
        let {
            func,
            scriptLineOffset,
            async,
            transpilerResult,
        } = this._compileFunction(script, options || {});

        const scriptFunction = func;
        const meta = {
            scriptFunction,
            scriptLineOffset,
            transpilerResult,
            fileName: options?.fileName,
            diagnosticFunctionName: options?.diagnosticFunctionName,
            isAsync: async,
        };

        if (options) {
            if (
                options.before ||
                options.after ||
                options.onError ||
                options.invoke ||
                async
            ) {
                const before = options.before || (() => {});
                const after = options.after || (() => {});
                const onError =
                    options.onError ||
                    ((err) => {
                        throw err;
                    });

                const invoke = options.invoke;
                const context = options.context;
                const scriptFunc = func;
                const finalFunc = invoke
                    ? (...args: any[]) =>
                          invoke(() => scriptFunc(...args), context)
                    : scriptFunc;
                if (async) {
                    func = function __wrapperFunc(...args: any[]) {
                        before(context);
                        try {
                            let result = finalFunc(...args);
                            if (!(result instanceof Promise)) {
                                result = new Promise((resolve, reject) => {
                                    result.then(resolve, reject);
                                });
                            }
                            return result.catch((ex: any) => {
                                onError(ex, context, meta);
                            });
                        } catch (ex) {
                            onError(ex, context, meta);
                        } finally {
                            after(context);
                        }
                    };
                } else {
                    func = function __wrapperFunc(...args: any[]) {
                        before(context);
                        try {
                            return finalFunc(...args);
                        } catch (ex) {
                            onError(ex, context, meta);
                        } finally {
                            after(context);
                        }
                    };
                }
            }
        }

        const final = func as AuxCompiledScript;
        final.metadata = meta;

        return final;
    }

    /**
     * Finds the line number information for a function created with this compiler using the
     * given stack trace and metadata.
     * @param stackTrace The stack trace.
     * @param metadata The metadata.
     */
    findLineInfo(stackTrace: NodeJS.CallSite[], metadata: AuxScriptMetadata) {
        const frame = stackTrace.find((f) => {
            const func: any = f.getFunction();
            return func && func[COMPILED_SCRIPT_SYMBOL] === true;
        });

        if (frame) {
            const line = frame.getLineNumber();
            const column = frame.getColumnNumber();

            const result = {
                line: null,
                column: null,
            } as LineInfo;

            if (hasValue(line)) {
                result.line = line - metadata.scriptLineOffset;
            }
            if (hasValue(column)) {
                result.column = column;
            }

            return result;
        }

        return null;
    }

    private _parseScript(script: string): string {
        return script;
    }

    private _compileFunction<T>(
        script: string,
        options: AuxCompileOptions<T>
    ): {
        func: Function;
        scriptLineOffset: number;
        transpilerResult: TranspilerResult;
        async: boolean;
    } {
        // Yes this code is super ugly.
        // Some day we will engineer this into a real
        // compiler, but for now this ad-hoc method
        // seems to work.

        let async = false;
        if (isScript(script)) {
            script = parseScript(script);
        }
        if (script.indexOf('await ') >= 0) {
            async = true;
        }
        script = this._parseScript(script);
        let scriptLineOffset = 0;
        let constantsLineOffset = 0;
        let customGlobalThis = false;

        let constantsCode = '';
        if (options.constants) {
            const lines = Object.keys(options.constants)
                .filter((v) => v !== 'this')
                .map((v) => `const ${v} = constants["${v}"];`);
            customGlobalThis = 'globalThis' in options.constants;
            constantsCode = lines.join('\n') + '\n';
            constantsLineOffset += 1 + Math.max(lines.length - 1, 0);
        }

        let variablesCode = '';
        if (options.variables) {
            const lines = Object.keys(options.variables)
                .filter((v) => v !== 'this')
                .map((v) => `const ${v} = variables["${v}"](context);`);
            variablesCode = '\n' + lines.join('\n');
            scriptLineOffset += 1 + Math.max(lines.length - 1, 0);
        }

        let argumentsCode = '';
        if (options.arguments) {
            const lines = flatMap(
                options.arguments
                    .filter((v) => v !== 'this')
                    .map((v, i) =>
                        Array.isArray(v)
                            ? ([v, i] as const)
                            : ([[v] as string[], i] as const)
                    ),
                ([v, i]) => v.map((name) => `const ${name} = args[${i}];`)
            );
            argumentsCode = '\n' + lines.join('\n');
            scriptLineOffset += 1 + Math.max(lines.length - 1, 0);
        }

        let scriptCode: string;
        scriptCode = `\n { \n${script}\n }`;
        scriptLineOffset += 2;

        let withCodeStart = '';
        let withCodeEnd = '';
        if (customGlobalThis) {
            withCodeStart = 'with(__globalObj) {\n';
            withCodeEnd = '}';
            scriptLineOffset += 1;
        }

        // Function needs a name because acorn doesn't understand
        // that this function is allowed to be anonymous.
        let functionCode = `function ${
            options.functionName ?? '_'
        }(...args) { ${argumentsCode}${variablesCode}${scriptCode}\n }`;
        if (async) {
            functionCode = `async ` + functionCode;
        }
        try {
            if (options.forceSync) {
                async = false;
            }
            this._transpiler.forceSync = options.forceSync ?? false;
            const transpiled = this._transpiler.transpileWithMetadata(
                functionCode
            );

            scriptLineOffset += constantsLineOffset;
            const finalCode = `${withCodeStart}return function(constants, variables, context) { ${constantsCode}return ${transpiled.code}; }${withCodeEnd}`;

            let func = this._buildFunction(finalCode, options);
            (<any>func)[COMPILED_SCRIPT_SYMBOL] = true;

            // Add 1 extra line to count the line feeds that
            // is automatically inserted at the start of the script as part of the process of
            // compiling the dynamic script.
            // See https://tc39.es/ecma262/#sec-createdynamicfunction
            scriptLineOffset += 2;

            if (options.variables) {
                if ('this' in options.variables) {
                    func = func.bind(
                        options.variables['this'](options.context)
                    );
                }
            }

            return {
                func,
                scriptLineOffset,
                async,
                transpilerResult: transpiled,
            };
        } catch (err) {
            if (err instanceof SyntaxError) {
                const replaced = replaceSyntaxErrorLineNumber(
                    err,
                    (location) => ({
                        lineNumber: location.lineNumber - scriptLineOffset,
                        column: location.column,
                    })
                );

                if (replaced) {
                    throw replaced;
                }
            }
            throw err;
        }
    }

    private _buildFunction<T>(
        finalCode: string,
        options: AuxCompileOptions<T>
    ) {
        return this.__constructFunction<T>(finalCode)(
            options.constants?.globalThis
        )(options.constants, options.variables, options.context);
    }

    private __constructFunction<T>(
        finalCode: string
    ): (
        globalObj: any
    ) => (
        constants: AuxCompileOptions<T>['constants'],
        variables: AuxCompileOptions<T>['variables'],
        context: AuxCompileOptions<T>['context']
    ) => Function {
        let existing = this._functionCache.get(finalCode) as any;
        if (!existing) {
            existing = Function('__globalObj', finalCode) as any;

            this._functionCache.set(finalCode, existing);
        }
        return existing;
    }
}

const SYNTAX_ERROR_LINE_NUMBER_REGEX = /\((\d+):(\d+)\)$/;

/**
 * Parses the line and column numbers from the the given syntax error, transforms them with the given function,
 * and returns a new syntax error that contains the new location. Returns null if the line and column numbers could not be parsed.
 * @param error The error to transform.
 * @param transform The function that should be used to transform the errors.
 * @returns
 */
export function replaceSyntaxErrorLineNumber(
    error: SyntaxError,
    transform: (location: CodeLocation) => CodeLocation
): SyntaxError {
    const matches = SYNTAX_ERROR_LINE_NUMBER_REGEX.exec(error.message);

    if (matches) {
        const [str, line, column] = matches;

        const lineNumber = parseInt(line);
        const columnNumber = parseInt(column);

        const location = transform({
            lineNumber,
            column: columnNumber,
        });

        return new SyntaxError(
            error.message.replace(
                str,
                `(${location.lineNumber}:${location.column})`
            )
        );
    } else {
        return null;
    }
}

/**
 * A script that has been compiled.
 */
export interface AuxCompiledScript {
    (...args: any[]): any;

    /**
     * The metadata for the script.
     */
    metadata: AuxScriptMetadata;
}

/**
 * Line information that has been calculated from a stack trace.
 */
export interface LineInfo {
    /**
     * The line number.
     */
    line: number | null;

    /**
     * The column number.
     */
    column: number | null;
}

/**
 * Metadata about the script.
 */
export interface AuxScriptMetadata {
    /**
     * The function that directly wraps the script.
     */
    scriptFunction: Function;

    /**
     * The number of lines that the user's script is offset inside the returned function source.
     */
    scriptLineOffset: number;

    /**
     * The transpiler result;
     */
    transpilerResult: TranspilerResult;

    /**
     * The name that should be used for the function in stack traces.
     */
    diagnosticFunctionName: string;

    /**
     * The file name that was specified for the script.
     */
    fileName: string;

    /**
     * Whether the function is asynchronous and returns a promise.
     */
    isAsync: boolean;
}

/**
 * The set of options that a script should be compiled with.
 */
export interface AuxCompileOptions<T> {
    /**
     * The context that should be used.
     */
    context?: T;

    /**
     * The variables that should be made available to the script.
     */
    variables?: {
        [name: string]: (context?: T) => any;
    };

    /**
     * The constant values that should be made available to the script.
     */
    constants?: {
        [name: string]: any;
    };

    /**
     * The names that each argument should be assigned.
     */
    arguments?: (string | string[])[];

    /**
     * A function that should be called before the compiled function is executed.
     */
    before?: (context?: T) => void;

    /**
     * A function that should be called after the compiled function is executed.
     */
    after?: (context?: T) => void;

    /**
     * A function that should be called to invoke the compiled function.
     */
    invoke?: (func: Function, context?: T) => any;

    /**
     * A function that should be called when an error occurs.
     */
    onError?: (error: any, context?: T, meta?: AuxScriptMetadata) => void;

    /**
     * The name that should be given to the function.
     */
    functionName?: string;

    /**
     * The name that should be used for the function in stack traces.
     */
    diagnosticFunctionName?: string;

    /**
     * The file name that should be used for transformed error stack traces.
     */
    fileName?: string;

    /**
     * Whether to force the output function to be synchronous.
     * This will compile out any async/await code.
     */
    forceSync?: boolean;

    /**
     * The global object that the function should be compiled to reference.
     *
     */
    globalObj?: any;
}

// export class CompiledScriptError extends Error {
//     /**
//      * The inner error.
//      */
//     error: Error;

//     constructor(error: Error) {
//         super(error.message);
//         this.error = error;
//     }
// }
