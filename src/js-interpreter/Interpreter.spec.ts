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
} from '@casual-simulation/engine262';
import { Interpreter } from './Interpreter';
import { unwind } from './InterpreterUtils';

describe('Interpreter', () => {
    it.skip('should work', () => {
        const agent = new Agent({
            yieldEachNode: true,
        });
        setSurroundingAgent(agent);
        function resolveModule(module: [any] | SourceTextModuleRecord) {
            if (Array.isArray(module)) {
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

        if (Array.isArray(record)) {
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
        it('should define a global console object', () => {
            expect(
                interpreter.realm.GlobalObject.HasProperty(new Value('console'))
            ).toBe(Value.true);
        });

        it('should define console.log function', () => {
            expect(
                interpreter.realm.GlobalObject.HasProperty(new Value('console'))
            ).toBe(Value.true);

            let result = unwind(
                Get(interpreter.realm.GlobalObject, new Value('console'))
            );

            expect(result.Type).toBe('normal');

            expect(Type(result.Value)).toBe('Object');
            expect(IsCallable(result.Value)).toBe(Value.true);
        });
    });
});
