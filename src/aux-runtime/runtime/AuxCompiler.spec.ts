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

// Disable global assignments because this is a test file
// and we need to test that it handles promises correctly.
/* eslint-disable no-global-assign */

import type { AuxCompiledScript, AuxCompileOptions } from './AuxCompiler';
import {
    AuxCompiler,
    createInterpretableFunction,
    EXPORT_FACTORY,
    FUNCTION_METADATA,
    getInterpretableFunction,
    IMPORT_FACTORY,
    IMPORT_META_FACTORY,
    INTERPRETABLE_FUNCTION,
    isInterpretableFunction,
    replaceSyntaxErrorLineNumber,
    tagAsInterpretableFunction,
} from './AuxCompiler';
import ErrorStackParser from '@casual-simulation/error-stack-parser';
import { calculateIndexFromLocation } from './TranspilerUtils';
import {
    CreateDataProperty,
    runJobQueue,
    Value,
} from '@casual-simulation/engine262';
import type { InterpreterStop } from '@casual-simulation/js-interpreter';
import {
    Interpreter,
    isGenerator,
    unwind,
    unwindAndCapture,
} from '@casual-simulation/js-interpreter';

describe('AuxCompiler', () => {
    let compiler: AuxCompiler;

    beforeEach(() => {
        compiler = new AuxCompiler();
    });

    describe('compile()', () => {
        it('should support compiling without options', () => {
            const func = compiler.compile('return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should support compiling scripts', () => {
            const func = compiler.compile('@return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should compile in strict mode', () => {
            const func = compiler.compile('NaN = 5;');

            expect(() => {
                func();
            }).toThrow();
        });

        it('should always compile modules as async', async () => {
            const func = compiler.compile('📄', {
                arguments: [IMPORT_FACTORY],
            });

            expect(await func()).toBeUndefined();
        });

        it('should be able to compile import statements', async () => {
            const func = compiler.compile('📄import abc from "test";', {
                arguments: [IMPORT_FACTORY, IMPORT_META_FACTORY],
            });

            expect(await func(async () => ({}))).toEqual(undefined);
        });

        it('should be able to provide default values for arguments by variables that have the same name but with an underscore', async () => {
            const func = compiler.compile('@return abc + def;', {
                arguments: ['missing', 'abc', 'def'],
                variables: {
                    _abc: () => 1,
                    _def: () => 2,
                },
            });

            expect(func()).toEqual(3);
        });

        it('should be able to compile import.meta statements', async () => {
            const func = compiler.compile('📄return import.meta;', {
                arguments: [IMPORT_META_FACTORY],
            });

            expect(await func('abc')).toBe('abc');
        });

        it('should be able to compile export statements', async () => {
            const func = compiler.compile('export const abc = "def";', {
                arguments: [EXPORT_FACTORY],
            });

            const exportFunc = jest.fn();

            expect(await func(exportFunc)).toEqual(undefined);
            expect(exportFunc).toHaveBeenCalledWith({ abc: 'def' });
        });

        it('should be able to compile scripts with import statements', async () => {
            const func = compiler.compile('@import abc from "test";', {
                arguments: [IMPORT_FACTORY, IMPORT_META_FACTORY],
            });

            expect(await func(async () => ({}))).toEqual(undefined);
        });

        it('should support compiling with an interpreter', () => {
            const interpreter = new Interpreter();
            const func = compiler.compile('return 1 + 2', {
                interpreter,
            });

            expect(func()).toEqual(3);

            expect(typeof func[INTERPRETABLE_FUNCTION]).toBe('function');

            const interpretable = func[INTERPRETABLE_FUNCTION];
            const result = unwind(interpretable());
            expect(result).toEqual(3);
        });

        let interpreterCases = [
            ['no-interpreter'] as const,
            ['interpreter'] as const,
        ];

        describe.each(interpreterCases)('%s', (type) => {
            let interpreter: Interpreter | null = null;
            let options: AuxCompileOptions<any>;

            beforeEach(() => {
                if (type === 'no-interpreter') {
                    interpreter = null;
                    options = {};
                } else {
                    interpreter = new Interpreter();
                    options = {
                        interpreter: interpreter,
                    };
                }
            });

            it('should return a function that executes the given code', () => {
                const func = compiler.compile('return 1 + 2', options);

                expect(func()).toEqual(3);
            });

            it('should make the given variables available to the script', () => {
                const func = compiler.compile('return num1 + num2', {
                    ...options,
                    variables: {
                        num1: () => 10,
                        num2: () => 5,
                    },
                });

                expect(func()).toEqual(15);
            });

            it('should bind the given "this" variable to the script', () => {
                const func = compiler.compile('return this + num', {
                    ...options,
                    variables: {
                        num: () => 10,
                        this: () => 'hello',
                    },
                });

                expect(func()).toEqual('hello10');
            });

            it('should support using a context object to derive variables', () => {
                const func = compiler.compile('return this + num', {
                    ...options,
                    variables: {
                        num: (ctx: any) => ctx.num,
                        this: () => 'hello',
                    },
                    context: {
                        num: 5,
                    },
                });

                expect(func()).toEqual('hello5');
            });

            it('should support running arbitrary code before execution', () => {
                const context = {
                    num: 0,
                };

                const func = compiler.compile('return num', {
                    ...options,
                    variables: {
                        num: (ctx: any) => ctx.num,
                    },
                    before: (ctx: any) => (ctx.num += 1),
                    context,
                });

                if (interpreter) {
                    expect(isInterpretableFunction(func)).toBe(true);
                }

                expect(func()).toEqual(1);
                expect(func()).toEqual(2);

                expect(context).toEqual({
                    num: 2,
                });
            });

            it('should support running arbitrary code after execution', () => {
                const context = {
                    num: 0,
                };

                const func = compiler.compile('return num', {
                    ...options,
                    variables: {
                        num: (ctx: any) => ctx.num,
                    },
                    after: (ctx: any) => (ctx.num += 1),
                    context,
                });

                expect(func()).toEqual(0);
                expect(func()).toEqual(1);

                expect(context).toEqual({
                    num: 2,
                });
            });

            it('should allow redefining variables in the script', () => {
                const context = {
                    num: 5,
                };

                const func = compiler.compile('let num = -1; return num;', {
                    ...options,
                    variables: {
                        num: (ctx: any) => ctx.num,
                    },
                    context,
                });

                expect(func()).toEqual(-1);
            });

            it('should not allow reassigning a constant value', () => {
                const func = compiler.compile('num = 1; return num;', {
                    ...options,
                    constants: {
                        num: -5,
                    },
                });

                expect(() => {
                    func();
                }).toThrow();
            });

            it('should not allow reassigning a variable', () => {
                const func = compiler.compile('num = 1; return num;', {
                    ...options,
                    variables: {
                        num: () => -5,
                    },
                });

                expect(() => {
                    func();
                }).toThrow();
            });

            it('should support constant values compiled into the script', () => {
                const func = compiler.compile('return num;', {
                    ...options,
                    constants: {
                        num: -5,
                    },
                });

                expect(func()).toEqual(-5);
            });

            it('should support constant values compiled into the script', () => {
                const func = compiler.compile('return num;', {
                    ...options,
                    constants: {
                        num: -5,
                    },
                });

                expect(func()).toEqual(-5);
            });

            it('should return metadata for the compiled script', () => {
                const script = 'return str + num + abc;';
                const func = compiler.compile(script, {
                    ...options,
                    constants: {
                        num: -5,
                        str: 'abc',
                    },
                    variables: {
                        abc: () => 'def',
                    },
                    before: () => {},
                    after: () => {},
                });

                if (type === 'no-interpreter') {
                    // Contants + variables + extras + lines added by the JS spec
                    // See https://tc39.es/ecma262/#sec-createdynamicfunction
                    expect(
                        func.metadata.scriptLineOffset +
                            func.metadata.transpilerLineOffset
                    ).toEqual(7);
                } else {
                    // Contants + variables + extras + lines added by the JS spec
                    // See https://tc39.es/ecma262/#sec-createdynamicfunction
                    expect(
                        func.metadata.scriptLineOffset +
                            func.metadata.transpilerLineOffset
                    ).toEqual(6);

                    expect(
                        FUNCTION_METADATA in
                            func.metadata.constructedFunction.module
                    ).toBe(true);
                }
            });

            it('should transpile the user code to include energy checks', () => {
                function __energyCheck() {
                    throw new Error('Energy Check Hit!');
                }

                const script = 'let num = 0; while(num === 0) { num += 1; }';
                const func = compiler.compile(script, {
                    ...options,
                    constants: {
                        __energyCheck,
                    },
                });

                expect(() => {
                    func();
                }).toThrow(new Error('Energy Check Hit!'));
            });

            it('should support listen scripts', () => {
                const func = compiler.compile('@return 1 + 2', options);

                expect(func()).toEqual(3);
            });

            it('should support arguments in listeners', () => {
                const func = compiler.compile('return args.length', options);

                expect(func(1, 2, 3, 4, 5)).toEqual(5);
            });

            it('should support mapping arguments to variable names', () => {
                const func = compiler.compile(
                    'return abc + def + args.length',
                    {
                        ...options,
                        arguments: ['abc', 'def'],
                    }
                );

                expect(func(1, 2, 3, 4, 5)).toEqual(3 + 5);
            });

            it('should support mapping multiple variable names to a single argument', () => {
                const func = compiler.compile(
                    'return abc + def + args.length',
                    {
                        ...options,
                        arguments: [['abc', 'def']],
                    }
                );

                expect(func(1, 2, 3, 4, 5)).toEqual(2 + 5);
            });

            it('should support wrapping the invocation with another function', () => {
                const test = jest.fn();
                const context = {
                    abc: 'def',
                };
                const func = compiler.compile(
                    'return 1 + 2 + abc + this.def;',
                    {
                        ...options,
                        invoke(fn, ctx) {
                            test(ctx);
                            return fn();
                        },
                        context: context,
                        arguments: [['abc']],
                        variables: {
                            this: () => ({
                                def: 4,
                            }),
                        },
                    }
                );

                if (interpreter) {
                    expect(isInterpretableFunction(func)).toBe(true);
                }

                expect(func(3)).toBe(10);
                expect(test).toHaveBeenCalledWith(context);

                if (interpreter) {
                    const interpretable = getInterpretableFunction(func);

                    const result = interpretable(3);

                    expect(isGenerator(result)).toBe(true);
                    expect(unwind(result)).toBe(10);
                }
            });

            it('should support running some code when an error occurs', () => {
                let errors = [] as any[];
                const func = compiler.compile('throw new Error("abc")', {
                    ...options,
                    onError(err: any) {
                        errors.push(err);
                    },
                });

                func();
                expect(errors).toEqual([new Error('abc')]);
            });

            it('should support handling errors for promises', async () => {
                let errors = [] as any[];
                const func = compiler.compile(
                    'await Promise.resolve(); throw new Error("abc")',
                    {
                        ...options,
                        onError(err: any) {
                            errors.push(err);
                        },
                    }
                );

                const promise = func();

                if (interpreter) {
                    unwind(runJobQueue());
                }

                await promise;
                expect(errors).toEqual([new Error('abc')]);
            });

            it('should rethrow the error by default', () => {
                const func = compiler.compile('throw new Error("abc")', {
                    ...options,
                    before() {},
                });

                expect(() => {
                    func();
                }).toThrow(new Error('abc'));
            });

            it('should return an AsyncFunction when the script contains await', async () => {
                const func = compiler.compile('return await abc;', {
                    ...options,
                    variables: {
                        abc: () => 100,
                    },
                });

                // const AsyncFunction = (async () => {}).constructor;
                // expect(func.metadata.scriptFunction).toBeInstanceOf(AsyncFunction);

                if (interpreter) {
                    expect(isInterpretableFunction(func)).toBe(true);
                }

                const result = func();
                expect(result).toBeInstanceOf(Promise);

                if (interpreter) {
                    unwind(runJobQueue());
                }

                const final = await result;
                expect(final).toEqual(100);

                if (interpreter) {
                    const interpretable = getInterpretableFunction(func);

                    const result = interpretable();

                    expect(isGenerator(result)).toBe(true);

                    const promise = unwind(result);

                    expect(promise).toBeInstanceOf(Promise);

                    unwind(runJobQueue());

                    const final = await promise;
                    expect(final).toEqual(100);
                }
            });

            it('should support wrapping the native promise with a global promise if theyre not the same', async () => {
                const DefaultPromise = Promise;
                try {
                    class CustomPromise {
                        then() {
                            return this;
                        }
                        catch() {
                            return this;
                        }
                    }
                    Promise = <any>CustomPromise;

                    const func = compiler.compile('return await abc;', {
                        ...options,
                        variables: {
                            abc: () => 100,
                        },
                    });

                    // const AsyncFunction = (async () => {}).constructor;
                    // expect(func.metadata.scriptFunction).toBeInstanceOf(AsyncFunction);

                    const result = func();
                    expect(result).toBeInstanceOf(CustomPromise);
                } finally {
                    Promise = DefaultPromise;
                }
            });

            it('should map syntax errors to have the correct line numbers', () => {
                let error: SyntaxError;
                try {
                    compiler.compile('let def = ;', {
                        ...options,
                        variables: {
                            abc: () => 100,
                        },
                    });
                } catch (err) {
                    error = err;
                }

                expect(error).toBeTruthy();
                expect(error).toEqual(
                    new SyntaxError('Unexpected token (1:10)')
                );
            });

            it('should not include constants when mapping syntax errors', () => {
                let error: SyntaxError;
                try {
                    compiler.compile('let def = ;', {
                        ...options,
                        variables: {
                            abc: () => 100,
                        },
                        constants: {
                            myTest: 123,
                            myOtherTest: 456,
                        },
                    });
                } catch (err) {
                    error = err;
                }

                expect(error).toBeTruthy();
                expect(error).toEqual(
                    new SyntaxError('Unexpected token (1:10)')
                );
            });

            it('should compile JSX to point to html.h()', () => {
                let symbol = Symbol('return value');
                let fn = compiler.compile('return <div></div>', {
                    ...options,
                    variables: {
                        html: () => ({
                            h: () => symbol,
                        }),
                    },
                    constants: {
                        myTest: 123,
                        myOtherTest: 456,
                    },
                });

                const result = fn();

                expect(result).toBe(symbol);
            });

            it('should compile JSX fragments to point to html.f', () => {
                let symbol = Symbol('return value');
                let fn = compiler.compile('return <><h1></h1></>', {
                    ...options,
                    variables: {
                        html: () => ({
                            h: (type: any) => type,
                            f: symbol,
                        }),
                    },
                    constants: {
                        myTest: 123,
                        myOtherTest: 456,
                    },
                });

                const result = fn();

                expect(result).toBe(symbol);
            });

            it('should be able to compile scripts without async', () => {
                let symbol = Symbol('return value');
                let fn = compiler.compile('return await value;', {
                    ...options,
                    invoke(fn, ctx) {
                        return fn();
                    },
                    constants: {
                        value: symbol,
                    },
                    forceSync: true,
                });

                const result = fn();

                expect(result).toBe(symbol);
            });

            it('should be able to compile normal functions after sync functions', async () => {
                let symbol = Symbol('return value');
                let fn = compiler.compile('return await value;', {
                    ...options,
                    invoke(fn, ctx) {
                        return fn();
                    },
                    constants: {
                        value: symbol,
                    },
                    forceSync: true,
                });

                let fn2 = compiler.compile('return await abc;', {
                    variables: {
                        abc: () => symbol,
                    },
                    forceSync: false,
                });

                const result = fn();
                const result2 = fn2();

                expect(result).toBe(symbol);
                expect(result2).toBeInstanceOf(Promise);
                expect(await result2).toBe(symbol);
            });

            if (type === 'no-interpreter') {
                // Intepreters don't use the given global object and instead use
                // the interpreter realm global object
                it('should be able to compile with a custom global object', async () => {
                    let symbol = Symbol('return value');
                    let globalObj = {
                        value: symbol,
                    };
                    let fn = compiler.compile('return value;', {
                        ...options,
                        constants: {
                            globalThis: globalObj,
                        },
                    });

                    const result = fn();

                    expect(result).toBe(symbol);
                });
            } else {
                it('should be able to reference the realm global object', async () => {
                    let symbol = Symbol('return value');
                    CreateDataProperty(
                        interpreter.realm.GlobalObject,
                        new Value('value'),
                        interpreter.copyToValue(symbol)
                    );

                    let fn = compiler.compile('return value;', {
                        ...options,
                    });

                    const result = fn();

                    expect(result).toBe(symbol);
                });
            }

            it('should not override other constants with the custom global object', async () => {
                let symbol = Symbol('return value');
                let globalObj = {
                    value: 123,
                };
                let fn = compiler.compile('return value;', {
                    ...options,
                    constants: {
                        value: symbol,
                        globalThis: globalObj,
                    },
                });

                const result = fn();

                expect(result).toBe(symbol);
            });

            it('should not override other variables with the custom global object', async () => {
                let symbol = Symbol('return value');
                let globalObj = {
                    value: 123,
                };
                let fn = compiler.compile('return value;', {
                    ...options,
                    constants: {
                        globalThis: globalObj,
                    },
                    variables: {
                        value: () => symbol,
                    },
                });

                const result = fn();

                expect(result).toBe(symbol);
            });

            it('should be able to stop at interpreted function breakpoints', () => {
                if (type !== 'interpreter') {
                    return;
                }
                let fn = compiler.compile(
                    [
                        'let abc = 123;',
                        'let def = 456;',
                        'return abc + def + const1 + const2 + const3 + const4 + var1 + var2;',
                    ].join('\n'),
                    {
                        ...options,
                        constants: {
                            const1: 5,
                            const2: 6,
                            const3: 7,
                            const4: 8,
                        },
                        variables: {
                            var1: () => 9,
                            var2: () => 10,
                        },
                    }
                );

                expect(isInterpretableFunction(fn)).toBe(true);

                interpreter.debugging = true;
                compiler.setBreakpoint({
                    id: 'breakpoint-1',
                    func: fn,
                    interpreter,
                    columnNumber: 1,
                    lineNumber: 3,
                    states: ['before'],
                });

                const interpretable =
                    getInterpretableFunction<
                        () => Generator<InterpreterStop, any, any>
                    >(fn);

                const { result, states } = unwindAndCapture(interpretable());

                expect(result).toBe(579 + 5 + 6 + 7 + 8 + 9 + 10);
                expect(states.length).toBe(1);
                expect(states[0].state).toBe('before');
                expect(states[0].breakpoint.id).toBe('breakpoint-1');
            });

            it('should be able to list common breakpoint locations', () => {
                if (type !== 'interpreter') {
                    return;
                }
                let fn = compiler.compile(['func1();', 'func1();'].join('\n'), {
                    ...options,
                    constants: {
                        const1: 5,
                        const2: 6,
                        const3: 7,
                        const4: 8,
                    },
                    variables: {
                        var1: () => 9,
                        var2: () => 10,
                    },
                });

                expect(isInterpretableFunction(fn)).toBe(true);

                expect(
                    compiler.listPossibleBreakpoints(fn, interpreter)
                ).toEqual([
                    {
                        lineNumber: 1,
                        columnNumber: 1,
                        possibleStates: ['before', 'after'],
                    },
                    {
                        lineNumber: 2,
                        columnNumber: 1,
                        possibleStates: ['before', 'after'],
                    },
                ]);
            });

            it('should be able to list common breakpoint locations for async functions', () => {
                if (type !== 'interpreter') {
                    return;
                }
                let fn = compiler.compile(
                    ['await func1();', 'func1();'].join('\n'),
                    {
                        ...options,
                        constants: {
                            const1: 5,
                            const2: 6,
                            const3: 7,
                            const4: 8,
                        },
                        variables: {
                            var1: () => 9,
                            var2: () => 10,
                        },
                    }
                );

                expect(isInterpretableFunction(fn)).toBe(true);

                expect(
                    compiler.listPossibleBreakpoints(fn, interpreter)
                ).toEqual([
                    {
                        lineNumber: 1,
                        columnNumber: 7,
                        possibleStates: ['before', 'after'],
                    },
                    {
                        lineNumber: 2,
                        columnNumber: 1,
                        possibleStates: ['before', 'after'],
                    },
                ]);
            });

            describe('calculateOriginalLineLocation()', () => {
                let interpreterLineOffset = 0;

                beforeEach(() => {
                    // Constructing functions regularly causes 1 additional lines
                    // to be added to the function body that are not there when the interpreter
                    // is running.
                    interpreterLineOffset = !!interpreter ? -1 : 0;
                });

                it('should return (0, 0) if given a location before the user script actually starts', () => {
                    const script = 'return str + num + abc;';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                    });

                    // Line number is before the user location
                    // because of extra lines added by the compiler.
                    const result = compiler.calculateOriginalLineLocation(
                        func,
                        {
                            lineNumber: 2,
                            column: 2,
                        }
                    );

                    expect(result).toEqual({
                        lineNumber: 0,
                        column: 0,
                    });
                });

                it('should be able to return location at the start of one line user scripts', () => {
                    const script = 'return str + num + abc;';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                    });

                    // Line number is before the user location
                    // because of extra lines added by the compiler.
                    const result = compiler.calculateOriginalLineLocation(
                        func,
                        {
                            lineNumber: 8 + interpreterLineOffset,
                            column: 1,
                        }
                    );

                    expect(result).toEqual({
                        lineNumber: 0,
                        column: 0,
                    });
                });

                it('should be able to get the original location for errors', () => {
                    const script = 'let abc = 123; throw new Error("abc");';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                    });

                    // Line number is before the user location
                    // because of extra lines added by the compiler.
                    const result = compiler.calculateOriginalLineLocation(
                        func,
                        {
                            lineNumber: 8 + interpreterLineOffset,
                            column: 22,
                        }
                    );

                    expect(result).toEqual({
                        lineNumber: 0,
                        column: 21,
                    });
                });

                it('should be able to get the original location for errors on the second line', () => {
                    const script = 'let abc = 123;\nthrow new Error("abc");';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                    });

                    // Line number is before the user location
                    // because of extra lines added by the compiler.
                    const result = compiler.calculateOriginalLineLocation(
                        func,
                        {
                            lineNumber: 9 + interpreterLineOffset,
                            column: 7,
                        }
                    );

                    expect(result).toEqual({
                        lineNumber: 1,
                        column: 6,
                    });
                });
            });

            describe('transformErrorStackTrace()', () => {
                it('should transform the stack trace to have correct line numbers', () => {
                    const script = 'let abc = 123; throw new Error("abc");';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'test',
                    });

                    let error: Error;
                    try {
                        func();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['test', func]]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error: abc',
                        '   at test (test:1:22)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support functions with a bound this', () => {
                    const script = 'let abc = 123; throw new Error("abc");';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        variables: {
                            abc: () => 'def',
                            this: () => {},
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'test',
                    });

                    let error: Error;
                    try {
                        func();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['test', func]]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error: abc',
                        '   at test (test:1:22)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support custom file names', () => {
                    const script = 'let abc = 123; throw new Error("abc");';
                    const func = compiler.compile(script, {
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'test',
                        fileName: 'abc',
                    });

                    let error: Error;
                    try {
                        func();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['test', func]]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error: abc',
                        '   at test (abc:1:22)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support nested functions', () => {
                    const script =
                        'let abc = 123;\nmyFunc();\n function myFunc() {\n throw new Error("test"); \n}';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'test',
                        fileName: 'abc',
                    });

                    let error: Error;
                    try {
                        func();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['test', func]]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error: test',
                        '   at myFunc (abc:4:8)',
                        '   at test (abc:2:1)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support errors which originate from another imported function', () => {
                    const script = 'myFunc();';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                            myFunc: () => {
                                throw new Error();
                            },
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'test',
                        fileName: 'abc',
                    });

                    let error: Error;
                    try {
                        func();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['test', func]]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error',
                        expect.stringContaining('myFunc'),
                        '   at test (abc:1:1)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support using a separate diagnostic name for the function', () => {
                    const script = 'let abc = 123; throw new Error("abc");';
                    const func = compiler.compile(script, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        variables: {
                            abc: () => 'def',
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'test',
                        diagnosticFunctionName: 'def',
                        fileName: 'abc',
                    });

                    let error: Error;
                    try {
                        func();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['test', func]]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error: abc',
                        '   at def (abc:1:22)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support errors which originate from a nested script call', () => {
                    const script1 = 'throw new Error("abc");';
                    const func1 = compiler.compile(script1, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'func1',
                        fileName: 'abc',
                    });

                    const script2 = 'myFunc();';
                    const func2 = compiler.compile(script2, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                            myFunc: func1,
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'func2',
                        fileName: 'def',
                    });

                    let error: Error;
                    try {
                        func2();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([
                            ['func1', func1],
                            ['func2', func2],
                        ]),
                        error
                    );

                    const lines = stack.split('\n');

                    expect(lines).toEqual([
                        'Error: abc',
                        '   at func1 (abc:1:7)',
                        '   at func2 (def:1:1)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should support errors which originate from a nested script call inside a function call', () => {
                    const script1 = 'throw new Error("abc");';
                    const func1 = compiler.compile(script1, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'func1',
                        fileName: 'abc',
                    });

                    const script2 = 'myFunc();';
                    const func2 = compiler.compile(script2, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                            myFunc: function myFunc() {
                                return func1();
                            },
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'func2',
                        fileName: 'def',
                    });

                    let error: Error;
                    try {
                        func2();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([
                            ['func1', func1],
                            ['func2', func2],
                        ]),
                        error
                    );

                    const lines = stack.split('\n');

                    if (type === 'no-interpreter') {
                        expect(lines).toEqual([
                            'Error: abc',
                            '   at func1 (abc:1:7)',
                            expect.stringContaining('myFunc'),
                            '   at func2 (def:1:1)',
                            '   at <CasualOS> ([Native CasualOS Code]::)',
                        ]);
                    } else {
                        expect(lines).toEqual([
                            'Error: abc',
                            '   at func1 (abc:1:7)',
                            '   at myFunc (def::)',
                            '   at func2 (def:1:1)',
                            '   at <CasualOS> ([Native CasualOS Code]::)',
                        ]);
                    }
                });

                if (type === 'no-interpreter') {
                    it('should support errors that include a class identifier in the function name for some reason', () => {
                        const script = 'throw new Error("abc");';
                        const func = compiler.compile(script, {
                            ...options,
                            constants: {
                                num: -5,
                                str: 'abc',
                                bool: true,
                            },
                            before: () => {},
                            after: () => {},
                            diagnosticFunctionName: 'func',
                            fileName: 'def',
                        });

                        compiler.functionErrorLineOffset = 0;

                        let error = new Error('abc');
                        error.stack =
                            error.toString() +
                            '\n' +
                            [
                                '    at Object._ (eval at __constructFunction (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxCompiler.ts:424:24), <anonymous>:8:7)',
                                '    at __wrapperFunc (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxCompiler.ts:229:36)',
                                '    at event (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxLibrary.ts:5568:36)',
                                '    at Object.shout (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxLibrary.ts:5303:16)',
                                '    at E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:377:41',
                                '    at AuxRuntime._calculateScriptResults (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:938:24)',
                                '    at AuxRuntime._batchScriptResults (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:920:30)',
                                '    at AuxRuntime._shout (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:373:50)',
                                '    at AuxRuntime._processAction (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:247:33)',
                                '    at AuxRuntime._processCore (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:241:18)',
                            ].join('\n');

                        expect(error).toBeTruthy();

                        const stack = compiler.calculateOriginalStackTrace(
                            new Map([['_', func]]),
                            error
                        );

                        const lines = stack.split('\n');

                        expect(lines).toEqual([
                            'Error: abc',
                            '   at func (def:1:7)',
                            '   at <CasualOS> ([Native CasualOS Code]::)',
                        ]);
                    });
                }

                it('should do nothing if given an unrelated error', () => {
                    function test() {
                        throw new Error('def');
                    }

                    const script1 = 'throw new Error("abc");';
                    const func1 = compiler.compile(script1, {
                        ...options,
                        constants: {
                            num: -5,
                            str: 'abc',
                            bool: true,
                        },
                        before: () => {},
                        after: () => {},
                        functionName: 'func1',
                        fileName: 'abc',
                    });

                    let error: Error;
                    try {
                        test();
                    } catch (err) {
                        error = err;
                    }

                    expect(error).toBeTruthy();

                    const stack = compiler.calculateOriginalStackTrace(
                        new Map([['func1', func1]]),
                        error
                    );

                    expect(stack).toBe(null);
                });
            });
        });
    });

    describe('calculateOriginalLineLocation()', () => {
        it('should return the original line location for the given multi-line script', () => {
            const code =
                '// comment\ntest.call();\n// a really really really long comment';
            const script = compiler.compile(code, {
                constants: {
                    abc: 123,
                    def: 'ghi',
                    jfk: true,
                },
                variables: {
                    myVar: () => 456,
                },
            });

            const result = compiler.calculateOriginalLineLocation(script, {
                lineNumber:
                    3 +
                    script.metadata.scriptLineOffset +
                    script.metadata.transpilerLineOffset,
                column: 20,
            });

            expect(result).toEqual({
                lineNumber: 2,
                column: 19,
            });
            expect(
                code.substring(calculateIndexFromLocation(code, result))
            ).toBe('really long comment');
        });

        it('should return the original line location for the given single line script', () => {
            const code = 'throw new Error("abc")';
            const script = compiler.compile(code, {
                constants: {
                    abc: 123,
                    def: 'ghi',
                    jfk: true,
                },
                variables: {
                    myVar: () => 456,
                },
            });

            const result = compiler.calculateOriginalLineLocation(script, {
                lineNumber:
                    1 +
                    script.metadata.scriptLineOffset +
                    script.metadata.transpilerLineOffset,
                column: 7,
            });

            expect(result).toEqual({
                lineNumber: 0,
                column: 6,
            });
            expect(
                code.substring(calculateIndexFromLocation(code, result))
            ).toBe('new Error("abc")');
        });

        it('should support scripts with custom global objects', () => {
            const code = 'throw new Error("abc")';
            const script = compiler.compile(code, {
                constants: {
                    abc: 123,
                    def: 'ghi',
                    jfk: true,
                    globalThis: {
                        myGlobal: true,
                    },
                },
                variables: {
                    myVar: () => 456,
                },
            });

            const result = compiler.calculateOriginalLineLocation(script, {
                lineNumber:
                    1 +
                    script.metadata.scriptLineOffset +
                    script.metadata.transpilerLineOffset,
                column: 7,
            });

            expect(result).toEqual({
                lineNumber: 0,
                column: 6,
            });
            expect(
                code.substring(calculateIndexFromLocation(code, result))
            ).toBe('new Error("abc")');
        });
    });

    describe('calculateFinalLineLocation()', () => {
        const cases = [['interpreter'] as const, ['no-interpreter'] as const];

        describe.each(cases)('%s', (type) => {
            let interpreter: Interpreter | null = null;
            let options: AuxCompileOptions<any>;

            beforeEach(() => {
                if (type === 'no-interpreter') {
                    interpreter = null;
                    options = {};
                } else {
                    interpreter = new Interpreter();
                    options = {
                        interpreter: interpreter,
                    };
                }
            });

            it('should return the final line location for the given multi-line script', () => {
                const code =
                    '// comment\nthrow new Error();\n// a really really really long comment';
                const script = compiler.compile(code, {
                    ...options,
                    constants: {
                        abc: 123,
                        def: 'ghi',
                        jfk: true,
                    },
                    variables: {
                        myVar: () => 456,
                    },
                });

                const result = compiler.calculateFinalLineLocation(script, {
                    lineNumber: 1,
                    column: 18,
                });

                if (type === 'interpreter') {
                    validateErrorLineNumber(script, 9, 7);
                    expect(
                        compiler.calculateOriginalLineLocation(script, {
                            lineNumber: 9,
                            column: 7,
                        })
                    ).toEqual({
                        lineNumber: 1,
                        column: 6,
                    });
                    expect(result).toEqual({
                        lineNumber: 8,
                        column: 18,
                    });
                } else {
                    validateErrorLineNumber(script, 10, 7);
                    expect(result).toEqual({
                        lineNumber: 9,
                        column: 18,
                    });
                }
            });

            it('should return the final line location for the given single line script', () => {
                const code = 'throw new Error("abc")';
                const script = compiler.compile(code, {
                    ...options,
                    constants: {
                        abc: 123,
                        def: 'ghi',
                        jfk: true,
                    },
                    variables: {
                        myVar: () => 456,
                    },
                });

                const result = compiler.calculateFinalLineLocation(script, {
                    lineNumber: 0,
                    column: 6,
                });

                if (type === 'interpreter') {
                    validateErrorLineNumber(script, 8, 7);
                    expect(
                        compiler.calculateOriginalLineLocation(script, {
                            lineNumber: 8,
                            column: 7,
                        })
                    ).toEqual({
                        lineNumber: 0,
                        column: 6,
                    });
                    expect(result).toEqual({
                        lineNumber: 7,
                        column: 6,
                    });
                } else {
                    validateErrorLineNumber(script, 9, 7);
                    expect(result).toEqual({
                        lineNumber: 8,
                        column: 6,
                    });
                }
            });

            it('should support scripts with custom global objects', () => {
                const code = 'throw new Error("abc")';
                const script = compiler.compile(code, {
                    ...options,
                    constants: {
                        abc: 123,
                        def: 'ghi',
                        jfk: true,
                        globalThis: {
                            myGlobal: true,
                        },
                    },
                    variables: {
                        myVar: () => 456,
                    },
                });

                const result = compiler.calculateFinalLineLocation(script, {
                    lineNumber: 0,
                    column: 6,
                });

                if (type === 'interpreter') {
                    validateErrorLineNumber(script, 9, 7);
                    expect(
                        compiler.calculateOriginalLineLocation(script, {
                            lineNumber: 9,
                            column: 7,
                        })
                    ).toEqual({
                        lineNumber: 0,
                        column: 6,
                    });
                    expect(result).toEqual({
                        lineNumber: 8,
                        column: 6,
                    });
                } else {
                    validateErrorLineNumber(script, 11, 7);
                    expect(result).toEqual({
                        lineNumber: 10,
                        column: 6,
                    });
                }
            });
        });

        function validateErrorLineNumber(
            script: AuxCompiledScript,
            expectedLine: number,
            expectedColumn: number
        ) {
            let err: any;
            try {
                script();
            } catch (e) {
                err = e;
            }

            const [frame] = ErrorStackParser.parse(err);
            const origin = frame.evalOrigin ?? frame;

            expect(origin.lineNumber).toEqual(expectedLine);
            expect(origin.columnNumber).toEqual(expectedColumn);
        }
    });
});

describe('replaceSyntaxErrorLineNumber()', () => {
    it('should return a new syntax error with the transformed location', () => {
        const result = replaceSyntaxErrorLineNumber(
            new SyntaxError('this is a test (44:21)'),
            (location) => ({
                lineNumber: location.lineNumber + 1,
                column: location.column + 1,
            })
        );

        expect(result).toEqual(new SyntaxError('this is a test (45:22)'));
    });

    it('should return null if it could not find the location', () => {
        const result = replaceSyntaxErrorLineNumber(
            new SyntaxError('this is a test'),
            (location) => ({
                lineNumber: location.lineNumber + 1,
                column: location.column + 1,
            })
        );

        expect(result).toBe(null);
    });
});

describe('isInterpretableFunction()', () => {
    it('should return false if given null', () => {
        expect(isInterpretableFunction(null)).toBe(false);
    });

    it('should return true if given a function that has the GENERATOR_FUNCTION_TAG property set to true', () => {
        function abc() {}

        (abc as any)[INTERPRETABLE_FUNCTION] = true;

        expect(isInterpretableFunction(abc)).toBe(true);
    });
});

describe('createInterpretableFunction()', () => {
    it('should use the given function as the interpretable function', () => {
        function abc() {}

        let result = createInterpretableFunction(abc as any);

        expect(typeof result[INTERPRETABLE_FUNCTION]).toBe('function');
        expect(result === abc).toBe(false);
        expect(isInterpretableFunction(result)).toBe(true);
        expect(isInterpretableFunction(abc)).toBe(false);
        expect(getInterpretableFunction(result) === abc).toBe(true);
    });
});

describe('tagAsInterpretableFunction()', () => {
    it('should use the given functions as the interpretable and normal functions', () => {
        function abc() {}
        function def() {}

        let result = tagAsInterpretableFunction(abc as any, def as any);

        expect(result[INTERPRETABLE_FUNCTION] === abc).toBe(true);
        expect(result === def).toBe(true);
        expect(isInterpretableFunction(def)).toBe(true);
        expect(getInterpretableFunction(def) === abc).toBe(true);
    });
});
