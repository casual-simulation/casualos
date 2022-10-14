import {
    Agent,
    ManagedRealm,
    setSurroundingAgent,
    Value,
    inspect,
    CreateDataProperty,
    ParseScript,
    ThrowCompletion,
    EnsureCompletion,
    surroundingAgent,
    ExecutionContext,
    GlobalDeclarationInstantiation,
    NormalCompletion,
    // unwind,
    Evaluate,
    ScriptEvaluation,
    ManagedRealmOptions,
    SourceTextModuleRecord,
    ObjectValue,
    Call,
    IsCallable,
    NumberValue,
    Get,
    Type,
    NullValue,
    Completion,
    MakeBasicObject,
    OrdinaryObjectCreate,
    Construct,
    ECMAScriptNode,
    FunctionBody,
    SameValue,
    CreateBuiltinFunction,
    runJobQueue,
    Invoke,
    HasProperty,
    JSStringValue,
    IsPromise,
    InstanceofOperator,
    HasOwnProperty,
    Set,
    DeletePropertyOrThrow,
    DefinePropertyOrThrow,
    Descriptor,
    isProxyExoticObject,
    EnumerableOwnPropertyNames,
    FromPropertyDescriptor,
    SymbolValue,
} from '@casual-simulation/engine262';
import { del } from '../aux-common/aux-format-2';
import {
    Breakpoint,
    PossibleBreakpointLocation,
    Interpreter,
    traverse,
    VisitedNode,
    InterpreterAfterStop,
} from './Interpreter';
import {
    getInterpreterObject,
    getRegularObject,
    INTERPRETER_OBJECT,
    REGULAR_OBJECT,
    unwind,
    unwindAndCapture,
} from './InterpreterUtils';
import { waitAsync } from './test/TestHelpers';

describe('Interpreter', () => {
    it.skip('should work', () => {
        const agent = new Agent({
            yieldEachNode: true,
        });
        setSurroundingAgent(agent);
        function resolveModule(
            module: SourceTextModuleRecord | Completion<any>
        ) {
            if ('Type' in module) {
                return Value.null;
            }
            return module;
        }

        let realm: ManagedRealm;
        let options: ManagedRealmOptions = {
            resolveImportedModule: (reference, specifier) => {
                if (specifier === './testFile') {
                    return resolveModule(
                        realm.createSourceTextModule(
                            './testFile',
                            `
                        export let test = 123;
                        export let test2 = 'abc';
                    `
                        )
                    );
                } else if (specifier === './coolio') {
                    return resolveModule(
                        realm.createSourceTextModule(
                            './coolio',
                            `
                        export function first() {}

                        export let second = 2;
                    `
                        )
                    );
                } else if (specifier === './hello') {
                    return resolveModule(
                        realm.createSourceTextModule(
                            './hello',
                            `
                        export let value = 999;
                    `
                        )
                    );
                }

                return Value.null;
            },
        };
        realm = new ManagedRealm(options);

        realm.scope(() => {
            const print = new Value((args: any[]) => {
                console.log(...args.map((tmp) => inspect(tmp)));
                return Value.undefined;
            });

            CreateDataProperty(realm.GlobalObject, new Value('print'), print);
        });

        const record = realm.createSourceTextModule(
            'abc',
            `
            import { test, test2 } from './testFile';
            import * as cool from './coolio';

            export * from './hello';
            export function abc(value1, value2) {
                return value1 + value2;
            }
        `
        );

        if ('Type' in record) {
            throw new Error('Unable to parse module!');
        }

        realm.scope(() => {
            let result = record.Link();

            expect(result).toBe(Value.undefined);
            expect(record).toBeDefined();

            result = record.EvaluateAndUnwind();

            const binding = record.Environment.GetBindingValue(
                new Value('abc'),
                Value.true
            );

            expect(binding).toBeInstanceOf(ObjectValue);

            expect(IsCallable(binding)).toBe(Value.true);

            const r = unwind(
                Call(binding as ObjectValue, binding, [
                    new Value(2),
                    new Value(2),
                ])
            );

            expect(r.Value).toBeInstanceOf(NumberValue);
            expect(r.Value).toEqual(new NumberValue(4));
        });

        // realm.scope(() => {
        //     const realm = agent.currentRealmRecord;
        //     const s = ParseScript(script, realm, {
        //         specifier: undefined,
        //         public: { specifier: undefined },
        //     });

        //     if (Array.isArray(s)) {
        //         return ThrowCompletion(s[0]);
        //     }

        //     let result = EnsureCompletion(unwind(ScriptEvaluation(s)));

        //     console.log(result);
        // });
    });

    let interpreter: Interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe('globals', () => {
        describe('console', () => {
            it('should define a global console object', () => {
                expect(
                    interpreter.realm.GlobalObject.HasProperty(
                        new Value('console')
                    )
                ).toBe(Value.true);

                let result = unwind(
                    Get(interpreter.realm.GlobalObject, new Value('console'))
                );

                expect(result.Type).toBe('normal');
                expect(Type(result.Value)).toBe('Object');
            });

            const functionCases = [
                ['log'] as const,
                ['error'] as const,
                ['warn'] as const,
            ];

            it.each(functionCases)(
                'should define console.%s function',
                (funcName) => {
                    expect(
                        interpreter.realm.GlobalObject.HasProperty(
                            new Value('console')
                        )
                    ).toBe(Value.true);

                    let result = unwind(
                        Get(
                            interpreter.realm.GlobalObject,
                            new Value('console')
                        )
                    );
                    expect(result.Type).toBe('normal');

                    let log = unwind(Get(result.Value, new Value(funcName)));

                    expect(log.Type).toBe('normal');
                    expect(Type(log.Value)).toBe('Object');
                    expect(IsCallable(log.Value)).toBe(Value.true);
                }
            );
        });
    });

    describe('createAndLinkModule()', () => {
        it('should create and return a module', () => {
            const module = interpreter.createAndLinkModule(
                `
                export function add(first, second) {
                    return first + second;
                }
            `,
                'test'
            );

            expect(module.LocalExportEntries).toEqual([
                {
                    ImportName: Value.null,
                    ModuleRequest: Value.null,
                    LocalName: new Value('add'),
                    ExportName: new Value('add'),
                },
            ]);
        });

        it('should throw a syntax error if unable to parse the module', () => {
            expect(() => {
                interpreter.createAndLinkModule(
                    `
                    export function add(first, second) {
                `,
                    'test'
                );
            }).toThrow(SyntaxError);
        });
    });

    describe('createFunction()', () => {
        it('should be able to create a function with the given name and code', () => {
            const result = interpreter.createFunction(
                'myFunc',
                'return a + b;',
                'a',
                'b'
            );

            expect(result !== null).toBe(true);
            expect(result.module.LocalExportEntries).toEqual([
                {
                    ImportName: Value.null,
                    ModuleRequest: Value.null,
                    LocalName: new Value('myFunc'),
                    ExportName: new Value('myFunc'),
                },
            ]);

            expect(Type(result.func)).toBe('Object');
            expect(IsCallable(result.func)).toBe(Value.true);
        });

        it('should report the correct line number for syntax errors', () => {
            let error: Error = null;
            try {
                interpreter.createFunction('myFunc', 'return a + ;', 'a', 'b');
            } catch (err) {
                error = err;
            }

            expect(error).not.toBeFalsy();
            expect(error.message).toBe('Unexpected token');
            expect(error.stack).toMatchSnapshot();
        });
    });

    describe('callFunction()', () => {
        it('should be able to call the given function with number arguments', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return a + b;',
                'a',
                'b'
            );

            const result = unwind(interpreter.callFunction(func, 1, 2));

            expect(result).toBe(3);
        });

        it('should be able to call the given function with object arguments', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return { value: first.value + second.value };',
                'first',
                'second'
            );
            const result = unwind(
                interpreter.callFunction(func, { value: 1 }, { value: 2 })
            );

            expect(result).toEqual({
                value: 3,
            });
        });

        it('should report the correct line number for errors', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return new Error("My Error")'
            );
            const result = unwind(interpreter.callFunction(func));

            expect(result).toEqual(new Error('My Error'));
            expect(result.stack).toMatchSnapshot();
        });

        it('should throw errors that are thrown from the function', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'throw new Error("My Error")'
            );

            let error: Error = null;
            try {
                unwind(interpreter.callFunction(func));
            } catch (err) {
                error = err;
            }

            expect(error).toEqual(new Error('My Error'));
            expect(error.stack).toMatchSnapshot();
        });

        it('should map line numbers for errors returned in objects', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return { error: new Error("My Error") }'
            );
            const result = unwind(interpreter.callFunction(func));

            expect(result).toEqual({
                error: new Error('My Error'),
            });
            expect(result.error.stack).toMatchSnapshot();
        });

        it('should support passing interpreter values as function arguments', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return a + b',
                'a',
                'b'
            );

            const result = unwind(
                interpreter.callFunction(func, 1, new Value(2))
            );
            expect(result).toEqual(3);
        });

        it('should return a proxy if a function is returned', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return function() { return 123; }'
            );
            const result = unwind(interpreter.callFunction(func));

            expect(typeof result).toBe('function');

            const finalResult = unwind(result());

            expect(finalResult).toBe(123);
        });
    });

    describe('setBreakpoint()', () => {
        let originalLog = console.log;

        beforeEach(() => {
            interpreter.debugging = true;
            console.log = jest.fn();

            let echo = CreateBuiltinFunction(
                (args: Value[]) => args[0],
                1,
                new Value('echo'),
                [],
                interpreter.realm
            );
            CreateDataProperty(
                interpreter.realm.GlobalObject,
                new Value('echo'),
                echo
            );
        });

        afterEach(() => {
            console.log = originalLog;
        });

        it('should be able to stop script execution at the given breakpoint', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return a + b;',
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 1,
                columnNumber: 1,
                states: ['before'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(3);
            expect(states.length).toBe(1);

            const state = states[0];
            const code = (func.func as any).ECMAScriptCode as FunctionBody;

            expect(state.state).toBe('before');
            expect(state.node === code.FunctionStatementList[0]).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 1
            );
        });

        it('should be able to stop script execution after the given breakpoint', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return a + b;',
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 1,
                columnNumber: 1,
                states: ['after'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(3);
            expect(states.length).toBe(1);

            const state = states[0] as InterpreterAfterStop;
            const code = (func.func as any).ECMAScriptCode as FunctionBody;

            expect(state.state).toBe('after');
            expect(state.node === code.FunctionStatementList[0]).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            expect(state.result.Type).toBe('return');
            expect(SameValue(state.result.Value, new Value(3))).toBe(
                Value.true
            );
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 1
            );
        });

        it('should be able to stop inside expressions', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'console.log(a + b)',
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 1,
                columnNumber: 13,
                states: ['before'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(undefined);
            expect(states.length).toBe(1);

            const state = states[0] as InterpreterAfterStop;
            const code = (func.func as any).ECMAScriptCode
                .FunctionStatementList[0].Expression.Arguments[0];

            expect(state.state).toBe('before');
            expect(state.node === code).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            // expect(state.result.Type).toBe('return');
            // expect(SameValue(state.result.Value, new Value(3))).toBe(Value.true);
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 1
            );
        });

        it('should be able to stop after expressions', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'console.log(a + b)',
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 1,
                columnNumber: 13,
                states: ['after'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(undefined);
            expect(states.length).toBe(1);

            const state = states[0] as InterpreterAfterStop;
            const code = (func.func as any).ECMAScriptCode
                .FunctionStatementList[0].Expression.Arguments[0];

            expect(state.state).toBe('after');
            expect(state.node === code).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            expect(state.result.Type).toBe('normal');
            expect(SameValue(state.result.Value, new Value(3))).toBe(
                Value.true
            );
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 1
            );
        });

        it('should be able to stop before function calls', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'console.log("hello")',
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 1,
                columnNumber: 1,
                states: ['before'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(undefined);
            expect(states.length).toBe(1);

            const state = states[0] as InterpreterAfterStop;
            const code = (func.func as any).ECMAScriptCode
                .FunctionStatementList[0].Expression;

            expect(state.state).toBe('before');
            expect(state.node === code).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            // expect(state.result.Type).toBe('normal');
            // expect(SameValue(state.result.Value, new Value(3))).toBe(Value.true);
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 1
            );
        });

        it('should be able to stop after function calls', () => {
            const func = interpreter.createFunction(
                'myFunc',
                'echo(5)',
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 1,
                columnNumber: 1,
                states: ['after'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(undefined);
            expect(states.length).toBe(1);

            const state = states[0] as InterpreterAfterStop;
            const code = (func.func as any).ECMAScriptCode
                .FunctionStatementList[0].Expression;

            expect(state.state).toBe('after');
            expect(state.node === code).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            expect(state.result.Type).toBe('normal');
            expect(SameValue(state.result.Value, new Value(5))).toBe(
                Value.true
            );
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 1
            );
        });

        it('should be able to stop inside functions', () => {
            const func = interpreter.createFunction(
                'myFunc',
                trimFunctionCode(`
                    function abc(first, second) {
                        return first + second;
                    }

                    return abc(a, b);
                `),
                'a',
                'b'
            );

            let breakpoint: Breakpoint = {
                id: 'breakpoint-id',
                func,
                lineNumber: 2,
                columnNumber: 1,
                states: ['before'],
            };
            interpreter.setBreakpoint(breakpoint);

            const { result, states } = unwindAndCapture(
                interpreter.callFunction(func, 1, 2)
            );

            expect(result).toBe(3);
            expect(states.length).toBe(1);

            const state = states[0] as InterpreterAfterStop;
            const code = (func.func as any).ECMAScriptCode
                .FunctionStatementList[0].FunctionBody.FunctionStatementList[0];

            expect(state.state).toBe('before');
            expect(state.node === code).toBe(true);
            expect(state.breakpoint === breakpoint).toBe(true);
            expect(state.stack.length).toBe(
                interpreter.agent.executionContextStack.length + 2
            );
        });
    });

    describe('listPossibleBreakpoints()', () => {
        const locationCases: [string, string, PossibleBreakpointLocation[]][] =
            [
                [
                    `call expressions`,
                    `func();`,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `assignment expressions`,
                    `a = 123;`,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `let/const declarations`,
                    `let abc = 123;`,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['after'],
                        },
                    ],
                ],
                [
                    `variable declarations`,
                    `
                    var abc = 123;
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['after'],
                        },
                    ],
                ],
                [
                    `if statements`,
                    `
                    if (true) {

                    }
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before'],
                        },
                    ],
                ],
                [
                    `else-if statements`,
                    `
                    if (true) {

                    } else if (false) {

                    }
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before'],
                        },
                        {
                            lineNumber: 3,
                            columnNumber: 8,
                            possibleStates: ['before'],
                        },
                    ],
                ],
                [
                    `else statements`,
                    `
                    if (true) {

                    } else if (false) {

                    } else {

                    }
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before'],
                        },
                        {
                            lineNumber: 3,
                            columnNumber: 8,
                            possibleStates: ['before'],
                        },
                        {
                            lineNumber: 5,
                            columnNumber: 8,
                            possibleStates: ['before'],
                        },
                    ],
                ],
                [
                    `switch statements`,
                    `
                    switch(value) {
                        case "abc":
                        break;
                        case "def":
                        break;
                    }
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before'],
                        },
                    ],
                ],
                [
                    `add expressions`,
                    `
                    a + b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `multiply expressions`,
                    `
                    a * b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `subtract expressions`,
                    `
                    a - b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `divide expressions`,
                    `
                    a / b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `modulo expressions`,
                    `
                    a % b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `bitwise xor expressions`,
                    `
                    a ^ b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `bitwise or expressions`,
                    `
                    a | b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
                [
                    `bitwise and expressions`,
                    `
                    a & b
                `,
                    [
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['before', 'after'],
                        },
                    ],
                ],
            ];

        it.each(locationCases)(
            'should return a possible location for %s',
            (desc, code, expected) => {
                const func = interpreter.createFunction(
                    'myFunc',
                    trimFunctionCode(code),
                    'first',
                    'second'
                );
                const locations = interpreter.listPossibleBreakpoints(func);
                expect(locations).toEqual(expected);
            }
        );
    });

    describe('proxyObject()', () => {
        it('should return an interpreted object that proxies the given object', () => {
            let getCalled = false;
            let otherValue: boolean = undefined;
            let obj = {
                value: 'abc',
                get myVal() {
                    getCalled = true;
                    return 123;
                },
                set otherValue(val: boolean) {
                    otherValue = val;
                },

                func: jest.fn(),
            };

            obj.func.mockReturnValue('my string');

            let proxyResult = interpreter.proxyObject(obj);

            expect(proxyResult.Type).toBe('normal');

            const proxy = proxyResult.Value as ObjectValue;

            expect(proxy).toBeInstanceOf(ObjectValue);
            expect(HasProperty(proxy, new Value('value'))).toBe(Value.true);
            expect(HasProperty(proxy, new Value('myVal'))).toBe(Value.true);
            expect(HasProperty(proxy, new Value('otherValue'))).toBe(
                Value.true
            );
            expect(HasProperty(proxy, new Value('func'))).toBe(Value.true);

            const myValResult = unwind(Get(proxy, new Value('myVal')));
            expect(myValResult).toEqual(NormalCompletion(new Value(123)));
            expect(getCalled).toBe(true);

            const setValueResult = EnsureCompletion(
                unwind(
                    Set(proxy, new Value('value'), new Value(999), Value.true)
                )
            );
            expect(setValueResult).toEqual(NormalCompletion(Value.true));
            expect(obj.value).toBe(999);

            const setterResult = EnsureCompletion(
                unwind(
                    Set(proxy, new Value('otherValue'), Value.true, Value.true)
                )
            );
            expect(setterResult).toEqual(NormalCompletion(Value.true));
            expect(otherValue).toBe(true);

            const invokeResult = unwind(
                Invoke(proxy, new Value('func'), [new Value(777), Value.true])
            );
            expect(invokeResult).toEqual(
                NormalCompletion(new Value('my string'))
            );

            expect(obj.func).toBeCalledTimes(1);
            expect(obj.func).toHaveBeenCalledWith(777, true);

            const deleteResult = EnsureCompletion(
                DeletePropertyOrThrow(proxy, new Value('value'))
            );
            expect(deleteResult).toEqual(NormalCompletion(Value.true));

            expect(obj).not.toHaveProperty('value');
            expect(HasProperty(proxy, new Value('value'))).toBe(Value.false);

            interpreter.realm.scope(() => {
                const defineResult = EnsureCompletion(
                    DefinePropertyOrThrow(
                        proxy,
                        new Value('newProp'),
                        new Descriptor({
                            Value: new Value(42),
                            Writable: Value.false,
                            Configurable: undefined,
                            Enumerable: undefined,
                            Get: undefined,
                            Set: undefined,
                        })
                    )
                );

                expect(defineResult).toEqual(NormalCompletion(Value.true));
                expect(obj).toHaveProperty('newProp');
                expect(Object.getOwnPropertyDescriptor(obj, 'newProp')).toEqual(
                    {
                        value: 42,
                        writable: false,
                        configurable: false,
                        enumerable: false,
                    }
                );

                const newPropResult = EnsureCompletion(
                    proxy.GetOwnProperty(new Value('newProp'))
                );
                expect(newPropResult.Type).toBe('normal');

                const descriptor = FromPropertyDescriptor(newPropResult.Value);

                const writableResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('writable')))
                );
                expect(writableResult).toEqual(NormalCompletion(Value.false));

                const configurableResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('configurable')))
                );
                expect(configurableResult).toEqual(
                    NormalCompletion(Value.false)
                );

                const enumerableResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('enumerable')))
                );
                expect(enumerableResult).toEqual(NormalCompletion(Value.false));

                const valueResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('value')))
                );
                expect(valueResult).toEqual(NormalCompletion(new Value(42)));

                let expectedKeys = Object.keys(obj);
                let ownKeys = EnumerableOwnPropertyNames(proxy, 'key');
                expect(ownKeys).toEqual([
                    ...expectedKeys.map((k) => new Value(k)),
                ]);
            });
        });

        it('should recursively proxy objects', () => {
            let obj = {
                other: {
                    nested: true,
                    func: jest.fn(),
                },
            };

            let proxyResult = interpreter.proxyObject(obj);
            expect(proxyResult.Type).toBe('normal');

            const proxy = proxyResult.Value as ObjectValue;

            expect(proxy).toBeInstanceOf(ObjectValue);

            const otherResult = unwind(Get(proxy, new Value('other')));
            expect(otherResult.Type).toBe('normal');
            expect(otherResult.Value).toBeInstanceOf(ObjectValue);

            const other = otherResult.Value as ObjectValue;

            expect(isProxyExoticObject(other)).toBe(true);

            unwind(Set(other, new Value('nested'), new Value(123), Value.true));
            expect(obj.other.nested).toBe(123);
        });

        it('should support functions that have additional properties', () => {
            let abc = 'def';
            let obj = function (value: any) {
                abc = value;
                return 999;
            };

            (obj as any).test = true;

            let proxyResult = interpreter.proxyObject(obj);
            expect(proxyResult.Type).toBe('normal');

            const proxy = proxyResult.Value as ObjectValue;

            expect(proxy).toBeInstanceOf(ObjectValue);
            expect(isProxyExoticObject(proxy)).toBe(true);

            const result = unwind(Call(proxy, proxy, [new Value('other')]));

            expect(result).toEqual(NormalCompletion(new Value(999)));
            expect(abc).toBe('other');

            const getResult = EnsureCompletion(
                unwind(Get(proxy, new Value('test')))
            );
            expect(getResult).toEqual(NormalCompletion(Value.true));
        });

        it('should return the original object if using reverseProxyObject() on it', () => {
            let abc = 'def';
            let obj = function (value: any) {
                abc = value;
                return 999;
            };

            (obj as any).test = true;

            let proxyResult = interpreter.proxyObject(obj);
            expect(proxyResult.Type).toBe('normal');

            const proxy = proxyResult.Value as ObjectValue;

            const reverseProxy = interpreter.reverseProxyObject(proxy);
            expect(reverseProxy === obj).toBe(true);
        });
    });

    describe('reverseProxyObject()', () => {
        it('should return an interpreted object that proxies the given object', () => {
            const func = interpreter.createFunction(
                'myFunc',
                `
                let obj = {
                    value: 'abc',
                    get myVal() {
                        proxy.getCalled = true;
                        return 123;
                    },
                    set otherValue(val) {
                        proxy.otherValue = val;
                    },

                    func: function() {
                        proxy.funcCalled = true;
                        return 'my string';
                    },
                };
                return obj;
            `,
                'proxy'
            );

            let obj = {
                funcCalled: false,
                getCalled: false,
                otherValue: null as any,
            };

            const proxiedObj = interpreter.proxyObject(obj);
            const result = getInterpreterObject(
                unwind(interpreter.callFunction(func, proxiedObj.Value))
            ) as ObjectValue;

            let proxy = interpreter.reverseProxyObject(result);

            expect(typeof proxy).toBe('object');

            expect(proxy).toBeInstanceOf(Object);
            expect(proxy).toHaveProperty('value');
            expect(proxy).toHaveProperty('myVal');
            expect(proxy).toHaveProperty('otherValue');
            expect(proxy).toHaveProperty('func');

            const myVal = proxy.myVal;
            expect(myVal).toEqual(123);
            expect(obj.getCalled).toBe(true);

            proxy.value = 999;

            const valueResult1 = EnsureCompletion(
                unwind(Get(result, new Value('value')))
            );
            expect(valueResult1).toEqual(NormalCompletion(new Value(999)));

            proxy.otherValue = true;
            expect(obj.otherValue).toBe(true);

            const invokeResult = unwind(proxy.func(777, true));
            expect(invokeResult).toBe('my string');
            expect(obj.funcCalled).toBe(true);

            delete proxy.value;

            expect(proxy).not.toHaveProperty('value');

            expect(HasProperty(result, new Value('value'))).toBe(Value.false);

            interpreter.realm.scope(() => {
                Object.defineProperty(proxy, 'newProp', {
                    value: 42,
                    writable: false,
                });

                // expect(defineResult).toEqual(NormalCompletion(Value.true));
                expect(proxy).toHaveProperty('newProp');
                expect(HasProperty(result, new Value('newProp'))).toBe(
                    Value.true
                );

                expect(
                    Object.getOwnPropertyDescriptor(proxy, 'newProp')
                ).toEqual({
                    value: 42,
                    writable: false,
                    configurable: false,
                    enumerable: false,
                });

                const newPropResult = EnsureCompletion(
                    result.GetOwnProperty(new Value('newProp'))
                );
                expect(newPropResult.Type).toBe('normal');

                const descriptor = FromPropertyDescriptor(newPropResult.Value);

                const writableResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('writable')))
                );
                expect(writableResult).toEqual(NormalCompletion(Value.false));

                const configurableResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('configurable')))
                );
                expect(configurableResult).toEqual(
                    NormalCompletion(Value.false)
                );

                const enumerableResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('enumerable')))
                );
                expect(enumerableResult).toEqual(NormalCompletion(Value.false));

                const valueResult = EnsureCompletion(
                    unwind(Get(descriptor, new Value('value')))
                );
                expect(valueResult).toEqual(NormalCompletion(new Value(42)));

                let expectedKeys = Object.keys(proxy);
                expect(expectedKeys).toEqual(['myVal', 'otherValue', 'func']);
            });
        });

        it('should recursively proxy objects', () => {
            const func = interpreter.createFunction(
                'myFunc',
                `
                let obj = {
                    other: {
                        nested: true,
                    },
                };
                return obj;
            `
            );

            const result = getInterpreterObject(
                unwind(interpreter.callFunction(func))
            ) as ObjectValue;

            let proxy = interpreter.reverseProxyObject(result);

            expect(typeof proxy).toBe('object');
            expect(typeof proxy.other).toBe('object');
            expect(proxy.other).toEqual({
                nested: true,
            });
            expect(proxy.other.nested).toBe(true);
        });

        it('should support functions that have additional properties', () => {
            const func = CreateBuiltinFunction(
                function () {
                    return 123;
                },
                0,
                new Value('func'),
                [],
                interpreter.realm
            );

            unwind(
                Set(func, new Value('test'), new Value('my string'), Value.true)
            );

            let proxy = interpreter.reverseProxyObject(func);

            expect(typeof proxy).toBe('function');
            expect(proxy.test).toBe('my string');
        });

        it('should return the original object if using proxyObject() on it', () => {
            const func = CreateBuiltinFunction(
                function () {
                    return 123;
                },
                0,
                new Value('func'),
                [],
                interpreter.realm
            );

            let proxy = interpreter.reverseProxyObject(func);

            expect(typeof proxy).toBe('function');

            const result = interpreter.proxyObject(proxy);

            expect(result.Type).toBe('normal');
            expect(result.Value === func).toBe(true);
        });
    });

    const primitiveCases = [
        ['string', new Value('abc'), 'abc'] as const,
        ['true', Value.true, true] as const,
        ['false', Value.false, false] as const,
        ['number', new Value(123), 123] as const,
        ['bigint', new Value(BigInt(12456)), BigInt(12456)] as const,
        ['null', Value.null, null as any] as const,
        ['undefined', Value.undefined, undefined as any] as const,
    ];

    const errorCases = [
        ['Error', Error] as const,
        ['ReferenceError', ReferenceError] as const,
        ['SyntaxError', SyntaxError] as const,
        ['EvalError', EvalError] as const,
        ['RangeError', RangeError] as const,
        ['SyntaxError', SyntaxError] as const,
        ['TypeError', TypeError] as const,
        ['URIError', URIError] as const,
    ];
    describe('copyFromValue()', () => {
        it.each(primitiveCases)(
            'should support %s values',
            (desc, given, expected) => {
                expect(interpreter.copyFromValue(given)).toBe(expected);
            }
        );

        it('should support regular objects', () => {
            const obj = OrdinaryObjectCreate(
                interpreter.realm.Intrinsics['%Object.prototype%']
            );

            CreateDataProperty(obj, new Value('abc'), new Value(123));
            CreateDataProperty(obj, new Value('other'), Value.true);

            const result = interpreter.copyFromValue(obj);

            expect(result).toEqual({
                abc: 123,
                other: true,
            });

            expect(INTERPRETER_OBJECT in result).toBe(true);
            expect(result[INTERPRETER_OBJECT] === obj).toBe(true);
            expect(getInterpreterObject(result) === obj).toBe(true);
        });

        it.each(errorCases)(
            'should support %s objects',
            (desc, constructor) => {
                const err = unwind(
                    Construct(
                        interpreter.realm.Intrinsics[
                            `%${desc}%`
                        ] as ObjectValue,
                        [new Value('error message')]
                    )
                );

                const result = interpreter.copyFromValue(err);

                expect(result).toEqual(new constructor('error message'));
                expect(result.stack).toBeTruthy();
            }
        );

        it('should support promises', async () => {
            let executer = CreateBuiltinFunction(
                (args: any[]) => {
                    let [resolve, reject] = args;
                    unwind(Call(resolve, Value.null, [new Value(123)]));
                },
                2,
                new Value('handler'),
                [],
                interpreter.realm
            );

            let result = EnsureCompletion(
                unwind(
                    Construct(
                        interpreter.realm.Intrinsics[
                            '%Promise%'
                        ] as ObjectValue,
                        [executer]
                    )
                )
            );

            expect(result.Type).toBe('normal');

            const value = interpreter.copyFromValue(result.Value);

            expect(value).toBeInstanceOf(Promise);

            let resolved: any;

            value.then((v: any) => {
                resolved = v;
            });

            await waitAsync();

            expect(resolved).toBeUndefined();

            unwind(runJobQueue());

            expect(resolved).toBeUndefined();

            await waitAsync();

            expect(resolved).toBe(123);

            expect(getInterpreterObject(value)).toBeInstanceOf(ObjectValue);
        });

        it('should support rejected promises', async () => {
            let executer = CreateBuiltinFunction(
                (args: any[]) => {
                    let [resolve, reject] = args;

                    const err = unwind(
                        Construct(
                            interpreter.realm.Intrinsics[
                                `%Error%`
                            ] as ObjectValue,
                            [new Value('error message')]
                        )
                    );

                    unwind(Call(reject, Value.null, [err]));
                },
                2,
                new Value('handler'),
                [],
                interpreter.realm
            );

            let result = EnsureCompletion(
                unwind(
                    Construct(
                        interpreter.realm.Intrinsics[
                            '%Promise%'
                        ] as ObjectValue,
                        [executer]
                    )
                )
            );

            expect(result.Type).toBe('normal');

            const value = interpreter.copyFromValue(result.Value);

            expect(value).toBeInstanceOf(Promise);

            let resolved: any;

            value.catch((v: any) => {
                resolved = v;
            });

            await waitAsync();

            expect(resolved).toBeUndefined();

            unwind(runJobQueue());

            expect(resolved).toBeUndefined();

            await waitAsync();

            expect(resolved).toEqual(new Error('error message'));
        });

        it('should support functions', async () => {
            const func = interpreter.createFunction('myFunc', 'return 1 + 2;');

            const converted = interpreter.copyFromValue(func.func);
            expect(typeof converted).toBe('function');

            const result = unwind<any>(converted());

            expect(result).toEqual(3);

            expect(INTERPRETER_OBJECT in converted).toBe(true);
            expect(converted[INTERPRETER_OBJECT] === func.func).toBe(true);
            expect(getInterpreterObject(converted) === func.func).toBe(true);
        });

        it('should support binding this to functions', async () => {
            const func = interpreter.createFunction(
                'myFunc',
                'return this + 2;'
            );

            const converted = interpreter.copyFromValue(func.func);
            expect(typeof converted).toBe('function');

            const result = unwind<any>(converted.apply(1));

            expect(result).toEqual(3);

            expect(INTERPRETER_OBJECT in converted).toBe(true);
            expect(converted[INTERPRETER_OBJECT] === func.func).toBe(true);
            expect(getInterpreterObject(converted) === func.func).toBe(true);
        });
        it('should be able to pass symbols back and forth', () => {
            const symbol = new SymbolValue('test');

            const result = interpreter.copyFromValue(symbol);
            const final = interpreter.copyToValue(result);

            expect(final.Type).toBe('normal');
            expect(final.Value === symbol).toBe(true);
        });
    });

    describe('copyToValue()', () => {
        it.each(primitiveCases)(
            'should support %s values',
            (desc, expected, given) => {
                const result = interpreter.copyToValue(given);
                expect(result.Type).toBe('normal');
                expect(result.Value).toEqual(expected);
            }
        );

        it('should return the given value if it is a value', () => {
            const val = new Value(123);
            const result = interpreter.copyToValue(val);
            expect(result).toEqual(NormalCompletion(val));
        });

        it('should support regular objects', () => {
            const obj = OrdinaryObjectCreate(
                interpreter.realm.Intrinsics['%Object.prototype%']
            );

            CreateDataProperty(obj, new Value('abc'), new Value(123));
            CreateDataProperty(obj, new Value('other'), Value.true);

            const valueToCopy = {
                abc: 123,
                other: true,
            };
            const result = interpreter.copyToValue(valueToCopy);

            expect(result.Type).toBe('normal');

            expect(interpreter.copyFromValue(result.Value)).toEqual({
                abc: 123,
                other: true,
            });

            expect(getRegularObject(result.Value)).toBe(valueToCopy);
        });

        it.each(errorCases)(
            'should support %s objects',
            (desc, constructor) => {
                const err = new constructor('error message');
                const expected = unwind(
                    Construct(
                        interpreter.realm.Intrinsics[
                            `%${desc}%`
                        ] as ObjectValue,
                        [new Value('error message')]
                    )
                );

                const result = interpreter.copyToValue(err);

                expect(result.Type).toBe('normal');
                expect(Type(result.Value)).toBe('Object');

                const value = interpreter.copyFromValue(result.Value);
                expect(value).toEqual(err);
            }
        );

        it('should support promises', async () => {
            const promise = new Promise<number>((resolve, reject) => {
                resolve(123);
            });

            let result = interpreter.copyToValue(promise);

            expect(result.Type).toBe('normal');

            const obj = result.Value;

            expect(obj).toBeInstanceOf(ObjectValue);
            expect(IsPromise(obj)).toBe(Value.true);

            const thenProp = unwind(Get(obj, new Value('then')));
            expect(thenProp.Type).toBe('normal');
            expect(IsCallable(thenProp.Value)).toBe(Value.true);

            let resolved: any;

            const onResolve = CreateBuiltinFunction(
                (args: any[]) => {
                    resolved = args[0];
                    return Value.undefined;
                },
                1,
                new Value('resolve'),
                [],
                interpreter.realm
            );

            const thenResult = EnsureCompletion(
                unwind(
                    Invoke(obj as ObjectValue, new Value('then'), [onResolve])
                )
            );

            expect(thenResult.Type).toBe('normal');
            expect(thenResult.Value).toBeInstanceOf(ObjectValue);
            expect(IsPromise(thenResult.Value)).toBe(Value.true);

            expect(resolved).toBeUndefined();

            await waitAsync();

            expect(resolved).toBeUndefined();

            unwind(runJobQueue());

            expect(resolved).toBeInstanceOf(NumberValue);
            expect((resolved as NumberValue).numberValue()).toBe(123);

            expect(getRegularObject(obj)).toBe(promise);
        });

        it('should support rejected promises', async () => {
            const promise = new Promise<number>((resolve, reject) => {
                reject(new Error('my error'));
            });

            let result = interpreter.copyToValue(promise);

            expect(result.Type).toBe('normal');

            const obj = result.Value;

            expect(obj).toBeInstanceOf(ObjectValue);
            expect(IsPromise(obj)).toBe(Value.true);

            const thenProp = unwind(Get(obj, new Value('then')));
            expect(thenProp.Type).toBe('normal');
            expect(IsCallable(thenProp.Value)).toBe(Value.true);

            let resolved: any;

            const onError = CreateBuiltinFunction(
                (args: any[]) => {
                    resolved = args[0];
                    return Value.undefined;
                },
                1,
                new Value('resolve'),
                [],
                interpreter.realm
            );

            const thenResult = EnsureCompletion(
                unwind(
                    Invoke(obj as ObjectValue, new Value('catch'), [onError])
                )
            );

            expect(thenResult.Type).toBe('normal');
            expect(thenResult.Value).toBeInstanceOf(ObjectValue);
            expect(IsPromise(thenResult.Value)).toBe(Value.true);

            expect(resolved).toBeUndefined();

            await waitAsync();

            expect(resolved).toBeUndefined();

            unwind(runJobQueue());

            expect(resolved).toBeInstanceOf(ObjectValue);
            expect(
                InstanceofOperator(
                    resolved,
                    interpreter.realm.Intrinsics['%Error%']
                )
            ).toBe(Value.true);

            let messageResult = unwind(Get(resolved, new Value('message')));
            expect(messageResult.Type).toBe('normal');
            expect(messageResult.Value).toBeInstanceOf(JSStringValue);
            expect((messageResult.Value as JSStringValue).stringValue()).toBe(
                'my error'
            );
        });

        it('should support functions', async () => {
            const func = () => 123;

            const converted = interpreter.copyToValue(func);
            expect(converted.Type).toBe('normal');
            expect(IsCallable(converted.Value) == Value.true).toBe(true);

            const result = unwind(
                Call(converted.Value as ObjectValue, Value.null, [])
            );
            expect(result).toEqual(NormalCompletion(new Value(123)));

            expect(REGULAR_OBJECT in converted.Value).toBe(true);
            expect((converted.Value as any)[REGULAR_OBJECT] === func).toBe(
                true
            );
            expect(getRegularObject(converted.Value) === func).toBe(true);
        });

        it('should support binding this to functions', async () => {
            const func = function () {
                return this + 2;
            };

            const converted = interpreter.copyToValue(func);
            expect(converted.Type).toBe('normal');
            expect(IsCallable(converted.Value) == Value.true).toBe(true);

            const result = unwind(
                Call(converted.Value as ObjectValue, new Value(1), [])
            );
            expect(result).toEqual(NormalCompletion(new Value(3)));

            expect(REGULAR_OBJECT in converted.Value).toBe(true);
            expect((converted.Value as any)[REGULAR_OBJECT] === func).toBe(
                true
            );
            expect(getRegularObject(converted.Value) === func).toBe(true);
        });

        it('should be able to pass symbols back and forth', () => {
            const symbol = Symbol('test');

            const result = interpreter.copyToValue(symbol);
            expect(result.Type).toBe('normal');

            const final = interpreter.copyFromValue(result.Value);
            expect(final === symbol).toBe(true);
        });
    });
});

describe('traverse()', () => {
    it('should be able to iterate over a program', () => {
        let interpreter = new Interpreter();
        let script = interpreter.realm.parseScript(`
            let abc = 123;
            const fun = true;

            var myVar = 0;
            this.test = true;

            if (true) {
                callFunction(argument1);
            }

            switch('hello') {
                case '1':
                    abc = 333;
                break;
                case '2':
                    abc = 555;
                break;
                default:
                    throw new Error()
            }

            for(var i = 0; i < 99; i++) {
                test();
            }

            for(let val of otherval) {
                test();
            }

            for(let key in obj) {
                test();
            }

            while(myVar > 0) {
                test();
            }

            do {
                test();
            } while(abc === 123);

            try {
                test();
            } catch(err) {
                otherTest()
            } finally {
                cool = true;
            }

            try {
                test();
            } catch(e) {

            }

            function myFunc(arg1, arg2) {
                return arg1 + arg2;
            }

            let myOtherFunc = (arg1, arg2) => arg1 + arg2;
            let myOtherFuncWithABody = (arg1, arg2) => {
                return arg1 + arg2;
            };

            let myFunc2 = ({arg1, arg2}, {arg3, arg4} = { test: true }) => {
                return arg1 + arg2;
            };

            let { test1: t, test2: y } = obj;

            let newObj = {
                prop1: true,
                ...obj,
                prop2: 'abc'
            };

            let arr = [
                myArray,
                ...myOtherArray,
                'value',
            ];
            let [{val1, val3}, val2] = [1, 2, 3];

            let myString = \`formatted: \${ohYeah * otherValue}\`;

            let condition = true ? 123 : 456;

            let value = null ?? undefined ?? 0;

            async function asyncFunc() {
                await other;
            }

            function* generatorFunc() {
                yield 1;
                yield* other;
                return 'abc';
            }

            async function* asyncGeneratorFunc() {
                yield 1;
                await other;
                yield* final;
                return 'abc';
            }

            let a1 = (async () => {});
            let a2 = (async () => await other);

            class myClass {
                prop = 123;
                #p = 9;

                constructor() {
                    this.prop = 333;
                }

                method(abc, def) {
                }

                async method2(arg1, arg2) {}
                *method3(arg1, arg2) {}
                async *method4(arg1, arg2) {}
            }

            class childClass extends myClass {
                constructor() {
                    super();
                }

                method() {
                    super.method(1, 2);
                }
            }

            a & b;
            a | b;
            a ^ b;

            a instanceof b;
        `);

        let gen = traverse(script.ECMAScriptCode);
        let types = [] as string[];
        while (true) {
            let res = gen.next();
            if (res.done) {
                break;
            }

            const visited = res.value as VisitedNode;

            let t = '';
            for (let i = 0; i < visited.depth; i++) {
                t += '  ';
            }

            t += visited.node.type;

            types.push(t);
        }

        expect(types).toMatchSnapshot();
    });
});

function trimFunctionCode(code: string): string {
    let lines = code.trim().split(/\r?\n/g);

    return lines.map((l) => l.trim()).join('\n');
}
