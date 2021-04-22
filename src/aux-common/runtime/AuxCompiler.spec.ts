import { AuxCompiler, replaceSyntaxErrorLineNumber } from './AuxCompiler';
import ErrorStackParser from '@casual-simulation/error-stack-parser';

describe('AuxCompiler', () => {
    let compiler: AuxCompiler;

    beforeEach(() => {
        compiler = new AuxCompiler();
    });

    describe('compile()', () => {
        it('should return a function that executes the given code', () => {
            const func = compiler.compile('return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should make the given variables available to the script', () => {
            const func = compiler.compile('return num1 + num2', {
                variables: {
                    num1: () => 10,
                    num2: () => 5,
                },
            });

            expect(func()).toEqual(15);
        });

        it('should bind the given "this" variable to the script', () => {
            const func = compiler.compile('return this + num', {
                variables: {
                    num: () => 10,
                    this: () => 'hello',
                },
            });

            expect(func()).toEqual('hello10');
        });

        it('should support using a context object to derive variables', () => {
            const func = compiler.compile('return this + num', {
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
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                before: (ctx: any) => (ctx.num += 1),
                context,
            });

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
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                context,
            });

            expect(func()).toEqual(-1);
        });

        it('should not allow reassigning a constant value', () => {
            const func = compiler.compile('num = 1; return num;', {
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
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should support constant values compiled into the script', () => {
            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should return metadata for the compiled script', () => {
            const script = 'return str + num + abc;';
            const func = compiler.compile(script, {
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

            // Contants + variables + extras + lines added by the JS spec
            // See https://tc39.es/ecma262/#sec-createdynamicfunction
            expect(func.metadata.scriptLineOffset).toEqual(6);
        });

        it('should transpile the user code to include energy checks', () => {
            function __energyCheck() {
                throw new Error('Energy Check Hit!');
            }

            const script = 'let num = 0; while(num === 0) { num += 1; }';
            const func = compiler.compile(script, {
                constants: {
                    __energyCheck,
                },
            });

            expect(() => {
                func();
            }).toThrow(new Error('Energy Check Hit!'));
        });

        it('should support listen scripts', () => {
            const func = compiler.compile('@return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should support arguments in listeners', () => {
            const func = compiler.compile('return args.length');

            expect(func(1, 2, 3, 4, 5)).toEqual(5);
        });

        it('should support mapping arguments to variable names', () => {
            const func = compiler.compile('return abc + def + args.length', {
                arguments: ['abc', 'def'],
            });

            expect(func(1, 2, 3, 4, 5)).toEqual(3 + 5);
        });

        it('should support mapping multiple variable names to a single argument', () => {
            const func = compiler.compile('return abc + def + args.length', {
                arguments: [['abc', 'def']],
            });

            expect(func(1, 2, 3, 4, 5)).toEqual(2 + 5);
        });

        it('should support wrapping the invocation with another function', () => {
            const test = jest.fn();
            const context = {
                abc: 'def',
            };
            const func = compiler.compile('return 1 + 2 + abc + this.def;', {
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
            });

            expect(func(3)).toBe(10);
            expect(test).toBeCalledWith(context);
        });

        it('should support running some code when an error occurs', () => {
            let errors = [] as any[];
            const func = compiler.compile('throw new Error("abc")', {
                onError(err: any) {
                    errors.push(err);
                },
            });

            func();
            expect(errors).toEqual([new Error('abc')]);
        });

        it('should rethrow the error by default', () => {
            const func = compiler.compile('throw new Error("abc")', {
                before() {},
            });

            expect(() => {
                func();
            }).toThrow(new Error('abc'));
        });

        it('should return an AsyncFunction when the script contains await', async () => {
            const func = compiler.compile('return await abc;', {
                variables: {
                    abc: () => 100,
                },
            });

            const AsyncFunction = (async () => {}).constructor;
            expect(func).toBeInstanceOf(AsyncFunction);

            const result = func();
            expect(result).toBeInstanceOf(Promise);

            const final = await result;
            expect(final).toEqual(100);
        });

        it('should support wrapping the native promise with a global promise if theyre not the same', async () => {
            const DefaultPromise = Promise;
            try {
                class CustomPromise {}
                Promise = <any>CustomPromise;

                const func = compiler.compile('return await abc;', {
                    variables: {
                        abc: () => 100,
                    },
                });

                const AsyncFunction = (async () => {}).constructor;
                expect(func).toBeInstanceOf(AsyncFunction);

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
                    variables: {
                        abc: () => 100,
                    },
                });
            } catch (err) {
                error = err;
            }

            expect(error).toBeTruthy();
            expect(error).toEqual(new SyntaxError('Unexpected token (1:10)'));
        });

        it('should not include constants when mapping syntax errors', () => {
            let error: SyntaxError;
            try {
                compiler.compile('let def = ;', {
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
            expect(error).toEqual(new SyntaxError('Unexpected token (1:10)'));
        });

        describe('calculateOriginalLineLocation()', () => {
            it('should return (0, 0) if given a location before the user script actually starts', () => {
                const script = 'return str + num + abc;';
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
                });

                // Line number is before the user location
                // because of extra lines added by the compiler.
                const result = compiler.calculateOriginalLineLocation(func, {
                    lineNumber: 2,
                    column: 2,
                });

                expect(result).toEqual({
                    lineNumber: 0,
                    column: 0,
                });
            });

            it('should be able to return location at the start of one line user scripts', () => {
                const script = 'return str + num + abc;';
                const func = compiler.compile(script, {
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
                const result = compiler.calculateOriginalLineLocation(func, {
                    lineNumber: 6,
                    column: 1,
                });

                expect(result).toEqual({
                    lineNumber: 0,
                    column: 0,
                });
            });

            it('should be able to get the original location for errors', () => {
                const script = 'let abc = 123; throw new Error("abc");';
                const func = compiler.compile(script, {
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
                const result = compiler.calculateOriginalLineLocation(func, {
                    lineNumber: 6,
                    column: 22,
                });

                expect(result).toEqual({
                    lineNumber: 0,
                    column: 21,
                });
            });

            it('should be able to get the original location for errors on the second line', () => {
                const script = 'let abc = 123;\r\nthrow new Error("abc");';
                const func = compiler.compile(script, {
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

                let error: Error;
                try {
                    func();
                } catch (err) {
                    error = err;
                }

                // Line number is before the user location
                // because of extra lines added by the compiler.
                const result = compiler.calculateOriginalLineLocation(func, {
                    lineNumber: 7,
                    column: 7,
                });

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

                const lines = stack.split('\r\n');

                expect(lines).toEqual([
                    'Error: abc',
                    '   at test (test:1:22)',
                    '   at <CasualOS> ([Native CasualOS Code]::)',
                ]);
            });

            it('should support functions with a bound this', () => {
                const script = 'let abc = 123; throw new Error("abc");';
                const func = compiler.compile(script, {
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

                const lines = stack.split('\r\n');

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

                const lines = stack.split('\r\n');

                expect(lines).toEqual([
                    'Error: abc',
                    '   at test (abc:1:22)',
                    '   at <CasualOS> ([Native CasualOS Code]::)',
                ]);
            });

            it('should support nested functions', () => {
                const script =
                    'let abc = 123;\r\nmyFunc();\r\n function myFunc() {\r\n throw new Error("test"); \r\n}';
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

                const lines = stack.split('\r\n');

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

                const lines = stack.split('\r\n');

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

                const lines = stack.split('\r\n');

                expect(lines).toEqual([
                    'Error: abc',
                    '   at def (abc:1:22)',
                    '   at <CasualOS> ([Native CasualOS Code]::)',
                ]);
            });

            it('should support errors which originate from a nested script call', () => {
                const script1 = 'throw new Error("abc");';
                const func1 = compiler.compile(script1, {
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

                const lines = stack.split('\r\n');

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

                const lines = stack.split('\r\n');

                expect(lines).toEqual([
                    'Error: abc',
                    '   at func1 (abc:1:7)',
                    expect.stringContaining('myFunc'),
                    '   at func2 (def:1:1)',
                    '   at <CasualOS> ([Native CasualOS Code]::)',
                ]);
            });

            it('should support errors include a class identifier in the function name for some reason', () => {
                const script = 'throw new Error("abc");';
                const func = compiler.compile(script, {
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

                let error = new Error('abc');
                error.stack =
                    error.toString() +
                    '\r\n' +
                    [
                        '    at Object._ (eval at __constructFunction (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxCompiler.ts:424:24), <anonymous>:6:7)',
                        '    at __wrapperFunc (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxCompiler.ts:229:36)',
                        '    at event (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxLibrary.ts:5568:36)',
                        '    at Object.shout (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxLibrary.ts:5303:16)',
                        '    at E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:377:41',
                        '    at AuxRuntime._calculateScriptResults (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:938:24)',
                        '    at AuxRuntime._batchScriptResults (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:920:30)',
                        '    at AuxRuntime._shout (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:373:50)',
                        '    at AuxRuntime._processAction (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:247:33)',
                        '    at AuxRuntime._processCore (E:\\Projects\\Yeti\\yeti-aux\\src\\aux-common\\runtime\\AuxRuntime.ts:241:18)',
                    ].join('\r\n');

                expect(error).toBeTruthy();

                const stack = compiler.calculateOriginalStackTrace(
                    new Map([['_', func]]),
                    error
                );

                const lines = stack.split('\r\n');

                expect(lines).toEqual([
                    'Error: abc',
                    '   at func (def:1:7)',
                    '   at <CasualOS> ([Native CasualOS Code]::)',
                ]);
            });
        });
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
