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

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { TranspilerResult } from './Transpiler';
import {
    calculateFinalLineLocation,
    calculateOriginalLineLocation,
    Transpiler,
} from './Transpiler';
import type { BotModule } from '@casual-simulation/aux-common/bots';
import {
    isScript,
    parseScript,
    hasValue,
    isModule,
    parseModule,
} from '@casual-simulation/aux-common/bots';
import ErrorStackParser from '@casual-simulation/error-stack-parser';
import StackFrame from 'stackframe';
import type {
    Breakpoint,
    ConstructedFunction,
    Interpreter,
    InterpreterContinuation,
    InterpreterStop,
    PossibleBreakpointLocation,
} from '@casual-simulation/js-interpreter';
import {
    unwind,
    INTERPRETER_OBJECT,
} from '@casual-simulation/js-interpreter/InterpreterUtils';
import type {
    FunctionBody,
    FunctionDeclaration,
    AsyncFunctionDeclaration,
    ReturnStatement,
} from '@casual-simulation/engine262';
import type { CodeLocation } from './TranspilerUtils';

/**
 * A symbol that identifies a function as having been compiled using the AuxCompiler.
 */
export const COMPILED_SCRIPT_SYMBOL = Symbol('compiled_script');

/**
 * The symbol that is used to tag specific functions as interpretable.
 */
export const INTERPRETABLE_FUNCTION = Symbol('interpretable_function');

/**
 * The symbol that is used to tag function modules with the metadata for a function.
 */
export const FUNCTION_METADATA = Symbol('function_metadata');

/**
 * Creates a new interpretable function based on the given function.
 * @param interpretableFunc
 */
export function createInterpretableFunction<TArg extends Array<any>, R>(
    interpretableFunc: (...args: TArg) => Generator<any, R, any>
): {
    (...args: TArg): R;
    [INTERPRETABLE_FUNCTION]: (...args: TArg) => Generator<any, R, any>;
} {
    const normalFunc = ((...args: TArg) =>
        unwind(interpretableFunc(...args))) as any;

    (normalFunc as any)[INTERPRETABLE_FUNCTION] = interpretableFunc;
    return normalFunc as any;
}

/**
 * Sets the INTERPRETABLE_FUNCTION property on the given object (semantically a function) to the given interpretable version and returns the object.
 * @param interpretableFunc The version of the function that should be used as the interpretable version of the function.
 * @param normalFunc The function that should be tagged.
 */
export function tagAsInterpretableFunction<T, N>(
    interpretableFunc: T,
    normalFunc: N
): N & {
    [INTERPRETABLE_FUNCTION]: T;
} {
    (normalFunc as any)[INTERPRETABLE_FUNCTION] = interpretableFunc;
    return normalFunc as any;
}

/**
 * Determines if the given object has been tagged with the GENERATOR_FUNCTION_TAG.
 * @param obj The object.
 */
export function isInterpretableFunction(obj: unknown): boolean {
    return (
        (typeof obj === 'function' || typeof obj === 'object') &&
        obj !== null &&
        !!(obj as any)[INTERPRETABLE_FUNCTION]
    );
}

/**
 * Gets the interpretable version of the given function.
 */
export function getInterpretableFunction<T extends Function>(obj: unknown): T {
    return isInterpretableFunction(obj)
        ? (obj as any)[INTERPRETABLE_FUNCTION]
        : null;
}

export const JSX_FACTORY = 'html.h';
export const JSX_FRAGMENT_FACTORY = 'html.f';
export const IMPORT_FACTORY = '___importModule';
export const IMPORT_META_FACTORY = '___importMeta';
export const EXPORT_FACTORY = '___exportModule';

/**
 * Defines a class that can compile scripts into functions.
 */
export class AuxCompiler {
    private _transpiler = new Transpiler({
        jsxFactory: JSX_FACTORY,
        jsxFragment: JSX_FRAGMENT_FACTORY,
        importFactory: IMPORT_FACTORY,
        importMetaFactory: IMPORT_META_FACTORY,
        exportFactory: EXPORT_FACTORY,
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
        if (INTERPRETER_OBJECT in error) {
            return this._calculateInterpreterErrorOriginalStackTrace(
                functionNameMap,
                error
            );
        } else {
            return this._calculateNativeErrorOriginalStackTrace(
                functionNameMap,
                error
            );
        }
    }

    private _calculateInterpreterErrorOriginalStackTrace(
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
            let savedFrame = false;
            let functionName = frame.functionName;
            const lastDotIndex = functionName.lastIndexOf('.');
            if (lastDotIndex >= 0) {
                functionName = functionName.slice(lastDotIndex + 1);
            }

            const script = functionNameMap.get(functionName);
            let isWrapperFunc = false;

            if (!/^__wrapperFunc/.test(frame.functionName)) {
                if (script) {
                    lastScript = script;
                    const location: CodeLocation = {
                        lineNumber:
                            frame.lineNumber + this.functionErrorLineOffset,
                        column: frame.columnNumber,
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
                            lineNumber: Math.max(
                                originalLocation.lineNumber + 1,
                                1
                            ),
                            columnNumber: Math.max(
                                originalLocation.column + 1,
                                1
                            ),
                        })
                    );
                } else if (lastScript) {
                    if (
                        typeof frame.lineNumber === 'number' &&
                        typeof frame.columnNumber === 'number'
                    ) {
                        const location: CodeLocation = {
                            lineNumber:
                                frame.lineNumber + this.functionErrorLineOffset,
                            column: frame.columnNumber,
                        };
                        const originalLocation =
                            this.calculateOriginalLineLocation(
                                lastScript,
                                location
                            );
                        savedFrame = true;
                        transformedFrames.unshift(
                            new StackFrame({
                                functionName:
                                    lastScript.metadata
                                        .diagnosticFunctionName ?? functionName,
                                fileName:
                                    lastScript.metadata.fileName ??
                                    functionName,
                                lineNumber: Math.max(
                                    originalLocation.lineNumber + 1,
                                    1
                                ),
                                columnNumber: Math.max(
                                    originalLocation.column + 1,
                                    1
                                ),
                            })
                        );
                    } else {
                        savedFrame = true;
                        transformedFrames.unshift(
                            new StackFrame({
                                functionName:
                                    lastScript.metadata
                                        .diagnosticFunctionName ?? functionName,
                                fileName:
                                    lastScript.metadata.fileName ??
                                    functionName,
                            })
                        );
                    }
                }
            } else {
                isWrapperFunc = true;
            }

            if (!savedFrame && isWrapperFunc) {
                savedFrame = true;
                if (lastScriptFrameIndex > i) {
                    lastScriptFrameIndex -= 1;
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

    private _calculateNativeErrorOriginalStackTrace(
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
     * The returned location uses zero-based line and column numbers.
     * @param func The function.
     * @param location The location. Line and column numbers are one-based.
     */
    calculateOriginalLineLocation(
        func: AuxCompiledScript,
        location: CodeLocation
    ): CodeLocation {
        // Line numbers should be one based
        if (
            location.lineNumber <
            func.metadata.scriptLineOffset + func.metadata.transpilerLineOffset
        ) {
            return {
                lineNumber: 0,
                column: 0,
            };
        }

        let transpiledLocation: CodeLocation = {
            lineNumber:
                location.lineNumber -
                func.metadata.scriptLineOffset -
                func.metadata.transpilerLineOffset -
                1,
            column: location.column - 1,
        };

        let result = calculateOriginalLineLocation(
            func.metadata.transpilerResult,
            transpiledLocation
        );

        return {
            lineNumber: result.lineNumber,
            column: result.column,
        };
    }

    /**
     * Calculates the final location within the given function for the given location.
     * @param func The function.
     * @param location The location. Line and column numbers are zero based.
     */
    calculateFinalLineLocation(
        func: AuxCompiledScript,
        location: CodeLocation
    ): CodeLocation {
        // Line numbers should be zero based
        if (location.lineNumber < 0) {
            return {
                lineNumber: 0,
                column: 0,
            };
        }

        let transpiledLocation: CodeLocation = {
            lineNumber: location.lineNumber,
            column: location.column,
        };

        let result = calculateFinalLineLocation(
            func.metadata.transpilerResult,
            transpiledLocation
        );

        return {
            lineNumber:
                result.lineNumber +
                func.metadata.scriptLineOffset +
                func.metadata.transpilerLineOffset,
            column: result.column,
        };
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
            transpilerLineOffset,
            async,
            transpilerResult,
            constructedFunction,
            transpileTimeMs,
            engineCompileTimeMs,
        } = this._compileFunction(script, options || {});

        const scriptFunction = func;
        const meta = {
            scriptFunction,
            scriptLineOffset,
            transpilerLineOffset,
            transpilerResult,
            fileName: options?.fileName,
            diagnosticFunctionName: options?.diagnosticFunctionName,
            isAsync: async,
            constructedFunction,
            context: options?.context,
            isModule: transpilerResult.metadata.isModule,
            transpileTimeMs,
            engineCompileTimeMs,
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
                    if (isInterpretableFunction(scriptFunc)) {
                        const interpretableFunc =
                            getInterpretableFunction(scriptFunc);
                        const finalFunc = invoke
                            ? (...args: any[]) =>
                                  invoke(
                                      () => interpretableFunc(...args),
                                      context
                                  )
                            : interpretableFunc;
                        const interpretable = function* __wrapperFunc(
                            ...args: any[]
                        ) {
                            before(context);
                            try {
                                let result = yield* finalFunc(...args);
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
                        tagAsInterpretableFunction(interpretable, func);
                    }
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
                    if (isInterpretableFunction(scriptFunc)) {
                        const interpretableFunc =
                            getInterpretableFunction(scriptFunc);
                        const finalFunc = invoke
                            ? (...args: any[]) =>
                                  invoke(
                                      () => interpretableFunc(...args),
                                      context
                                  )
                            : interpretableFunc;
                        const interpretable = function* __wrapperFunc(
                            ...args: any[]
                        ) {
                            before(context);
                            try {
                                return yield* finalFunc(...args);
                            } catch (ex) {
                                onError(ex, context, meta);
                            } finally {
                                after(context);
                            }
                        };
                        tagAsInterpretableFunction(interpretable, func);
                    }
                }
            }
        }

        const final = func as AuxCompiledScript;
        final.metadata = meta;

        if (meta.constructedFunction?.module) {
            Object.defineProperty(
                meta.constructedFunction.module,
                FUNCTION_METADATA,
                {
                    value: meta,
                    writable: false,
                    enumerable: false,
                    configurable: true,
                }
            );
        }

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

    /**
     * Sets the given breakpoint.
     * @param breakpoint The breakpoint that should be set.
     */
    setBreakpoint(breakpoint: AuxCompilerBreakpoint) {
        const metadata = breakpoint.func.metadata;
        if (!metadata.constructedFunction) {
            throw new Error(
                'Cannot set breakpoints for non-interpreted functions.'
            );
        }

        if (!breakpoint.interpreter) {
            throw new Error(
                'You must provide an interpreter when setting a breakpoint.'
            );
        }

        const func = metadata.constructedFunction;
        const interpreter = breakpoint.interpreter;

        const loc = this.calculateFinalLineLocation(breakpoint.func, {
            lineNumber: breakpoint.lineNumber - 1,
            column: breakpoint.columnNumber - 1,
        });

        interpreter.setBreakpoint({
            id: breakpoint.id,
            func,
            lineNumber: loc.lineNumber + 1,
            columnNumber: loc.column + 1,
            states: breakpoint.states,
        });
    }

    listPossibleBreakpoints(func: AuxCompiledScript, interpreter: Interpreter) {
        const metadata = func.metadata;
        if (!metadata.constructedFunction) {
            throw new Error(
                'Cannot list possible breakpoints for non-interpreted functions.'
            );
        }

        if (!interpreter) {
            throw new Error(
                'You must provide an interpreter when listing possible breakpoints.'
            );
        }

        const code = (metadata.constructedFunction.func as any)
            .ECMAScriptCode as FunctionBody;

        const returnStatement = code.FunctionStatementList.find(
            (s) => s.type === 'ReturnStatement'
        ) as ReturnStatement;
        const functionDeclaration = returnStatement.Expression as unknown as
            | FunctionDeclaration
            | AsyncFunctionDeclaration;
        const body =
            'FunctionBody' in functionDeclaration
                ? functionDeclaration.FunctionBody
                : functionDeclaration.AsyncFunctionBody;

        const possibleBreakpoints = interpreter.listPossibleBreakpoints(
            body as any
        );

        let returnedValues: PossibleBreakpointLocation[] = [];

        for (let pb of possibleBreakpoints) {
            if (
                pb.lineNumber <
                metadata.scriptLineOffset + metadata.transpilerLineOffset
            ) {
                continue;
            }

            const loc = this.calculateOriginalLineLocation(func, {
                lineNumber: pb.lineNumber,
                column: pb.columnNumber,
            });

            if (loc.lineNumber < 0 || loc.column < 0) {
                continue;
            }

            returnedValues.push({
                lineNumber: loc.lineNumber + 1,
                columnNumber: loc.column + 1,
                possibleStates: pb.possibleStates,
            });
        }

        return returnedValues;
    }

    private _parseScript(script: string): TranspilerResult {
        script = parseScript(script);
        return this._transpiler.transpileWithMetadata(script);
    }

    private _parseModule(script: string): TranspilerResult {
        script = parseModule(script);
        return this._transpiler.transpileWithMetadata(script);
    }

    private _compileFunction<T>(
        script: string,
        options: AuxCompileOptions<T>
    ): {
        func: Function;
        scriptLineOffset: number;
        transpilerLineOffset: number;
        transpilerResult: TranspilerResult;
        async: boolean;
        constructedFunction: ConstructedFunction;
        transpileTimeMs: number;
        engineCompileTimeMs: number;
    } {
        // Yes this code is super ugly.
        // Some day we will engineer this into a real
        // compiler, but for now this ad-hoc method
        // seems to work.

        this._transpiler.forceSync = options.forceSync ?? false;

        let async = false;
        let transpiled: TranspilerResult;
        let transpilerLineOffset = 0;
        let scriptLineOffset = 0;
        let syntaxErrorLineOffset = 0;
        const transpileStartTime = performance.now();
        try {
            if (isScript(script)) {
                transpiled = this._parseScript(script);
            } else if (isModule(script)) {
                transpiled = this._parseModule(script);
            } else {
                transpiled = this._transpiler.transpileWithMetadata(script);
            }
        } catch (err) {
            if (err instanceof SyntaxError) {
                const replaced = replaceSyntaxErrorLineNumber(
                    err,
                    (location) => ({
                        lineNumber:
                            location.lineNumber -
                            transpilerLineOffset -
                            syntaxErrorLineOffset,
                        column: location.column,
                    })
                );

                if (replaced) {
                    throw replaced;
                }
            }
            throw err;
        }

        if (transpiled.metadata.isModule) {
            // All modules are async
            async = true;
        } else if (transpiled.metadata.isAsync) {
            async = true;
        }
        if (options.forceSync) {
            async = false;
        }
        let customGlobalThis = false;

        let constantsCode = '';
        if (options.constants) {
            const lines = Object.keys(options.constants)
                .filter((v) => v !== 'this')
                .map((v) => `const ${v} = constants["${v}"];`);
            customGlobalThis =
                !options.interpreter && 'globalThis' in options.constants;
            constantsCode = lines.join('\n') + '\n';
            scriptLineOffset += 1 + Math.max(lines.length - 1, 0);
        }

        let variablesCode = '';
        if (options.variables) {
            const lines = Object.keys(options.variables)
                .filter((v) => v !== 'this')
                .map((v) => `const ${v} = variables["${v}"](context);`);
            variablesCode = '\n' + lines.join('\n');
            transpilerLineOffset += 1 + Math.max(lines.length - 1, 0);
        }

        let argumentsCode = '';
        if (options.arguments) {
            const lines = options.arguments
                .filter((v) => v !== 'this')
                .map((v, i) =>
                    Array.isArray(v)
                        ? ([v, i] as const)
                        : ([[v] as string[], i] as const)
                )
                .flatMap(([v, i]) =>
                    v.map((name) => {
                        const defaultName = `_${name}`;
                        if (options.variables?.[defaultName]) {
                            return `const ${name} = typeof args[${i}] === 'undefined' ? variables?.["_${name}"]?.(context) : args[${i}];`;
                        }
                        return `const ${name} = args[${i}];`;
                    })
                );
            argumentsCode = '\n' + lines.join('\n');
            transpilerLineOffset += 1 + Math.max(lines.length - 1, 0);
        }

        let scriptCode: string;
        scriptCode = `\n { \n${transpiled.code}\n }`;
        transpilerLineOffset += 2;

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

        const transpileEndTime = performance.now();
        const transpileTimeMs = transpileEndTime - transpileStartTime;

        try {
            if (options.interpreter) {
                const finalCode = `${constantsCode}return ${functionCode};`;

                syntaxErrorLineOffset += 1;
                scriptLineOffset += 1;

                const engineCompileStartTime = performance.now();
                const func = options.interpreter.createFunction(
                    'test',
                    finalCode,
                    'constants',
                    'variables',
                    'context'
                );

                let result = unwind(
                    options.interpreter.callFunction(
                        func,
                        options.constants,
                        options.variables,
                        options.interpreter.proxyObject(options.context)
                    )
                );

                let finalFunc: any = result;
                if (options.variables) {
                    if ('this' in options.variables) {
                        finalFunc = result.bind(
                            options.variables['this'](options.context)
                        );
                    }
                }

                if (INTERPRETER_OBJECT in result) {
                    finalFunc = createInterpretableFunction(finalFunc);
                    finalFunc[INTERPRETER_OBJECT] = result[INTERPRETER_OBJECT];
                }
                const engineCompileEndTime = performance.now();
                const engineCompileTimeMs =
                    engineCompileEndTime - engineCompileStartTime;

                return {
                    func: finalFunc,
                    scriptLineOffset,
                    transpilerLineOffset,
                    async,
                    transpilerResult: transpiled,
                    constructedFunction: func,
                    transpileTimeMs,
                    engineCompileTimeMs,
                };
            } else {
                const finalCode = `${withCodeStart}return function(constants, variables, context) { "use strict"; ${constantsCode}return ${functionCode}; }${withCodeEnd}`;

                const engineCompileStartTime = performance.now();
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
                const engineCompileEndTime = performance.now();
                const engineCompileTimeMs =
                    engineCompileEndTime - engineCompileStartTime;

                return {
                    func,
                    scriptLineOffset: scriptLineOffset,
                    transpilerLineOffset: transpilerLineOffset,
                    async,
                    transpilerResult: transpiled,
                    constructedFunction: null,
                    transpileTimeMs,
                    engineCompileTimeMs,
                };
            }
        } catch (err) {
            if (err instanceof SyntaxError) {
                const replaced = replaceSyntaxErrorLineNumber(
                    err,
                    (location) => ({
                        lineNumber:
                            location.lineNumber -
                            transpilerLineOffset -
                            syntaxErrorLineOffset,
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

    [INTERPRETABLE_FUNCTION]:
        | ((
              ...args: any[]
          ) => Generator<InterpreterStop, any, InterpreterContinuation>)
        | null;

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
     * The number of lines that the user's script is offset from the tranpiler's output.
     */
    transpilerLineOffset: number;

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

    /**
     * Whether the function contains a module.
     */
    isModule: boolean;

    /**
     * The function that was constructed by the interpreter.
     */
    constructedFunction: ConstructedFunction;

    /**
     * The context that the function was created with.
     */
    context: any;

    /**
     * The number of miliseconds that it took to transpile the script.
     */
    transpileTimeMs: number;

    /**
     * The number of miliseconds that it took the engine to compile the script.
     */
    engineCompileTimeMs: number;
}

export interface CompiledBotModule extends BotModule, AuxCompiledScript {}

/**
 * The set of options that a script should be compiled with.
 */
export interface AuxCompileOptions<T> {
    /**
     * The context that should be used.
     */
    context?: T;

    /**
     * The realm that should be used for the script.
     * If provided, then the script will be parsed and executed in the context of this realm and
     * the corresponding engine262 agent.
     */
    interpreter?: Interpreter;

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

/**
 * The set of options that a breakpoint should use.
 */
export interface AuxCompilerBreakpoint extends Omit<Breakpoint, 'func'> {
    /**
     * The script that the breakpoint should be set for.
     */
    func: AuxCompiledScript;

    /**
     * The interpreter that the breakpoint should be set on.
     */
    interpreter: Interpreter;
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
