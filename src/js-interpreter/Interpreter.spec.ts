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
} from '@casual-simulation/engine262';
import { Interpreter } from './Interpreter';
import { unwind } from './InterpreterUtils';

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

    describe('copyFromValue()', () => {
        const primitiveCases = [
            ['string', new Value('abc'), 'abc'] as const,
            ['true', Value.true, true] as const,
            ['false', Value.false, false] as const,
            ['number', new Value(123), 123] as const,
            ['bigint', new Value(BigInt(12456)), BigInt(12456)] as const,
            ['null', Value.null, null as any] as const,
            ['undefined', Value.undefined, undefined as any] as const,
        ];

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
});
