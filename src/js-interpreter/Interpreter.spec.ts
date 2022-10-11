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
} from '@casual-simulation/engine262';
import {
    Interpreter,
    InterpreterBreakpointLocation,
    traverse,
    VisitedNode,
} from './Interpreter';
import { unwind, unwindAndCapture } from './InterpreterUtils';

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
    });

    // describe('setBreakpoint()', () => {
    //     it('should be able to stop script execution at the given')
    // });

    describe('listPossibleBreakpoints()', () => {
        const locationCases: [
            string,
            string,
            InterpreterBreakpointLocation[]
        ][] = [
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

        it('should support regular objects', () => {
            const obj = OrdinaryObjectCreate(
                interpreter.realm.Intrinsics['%Object.prototype%']
            );

            CreateDataProperty(obj, new Value('abc'), new Value(123));
            CreateDataProperty(obj, new Value('other'), Value.true);

            const result = interpreter.copyToValue({
                abc: 123,
                other: true,
            });

            expect(result.Type).toBe('normal');

            expect(interpreter.copyFromValue(result.Value)).toEqual({
                abc: 123,
                other: true,
            });
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
