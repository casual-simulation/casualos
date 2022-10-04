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
} from '@casual-simulation/engine262';

describe('Interpreter', () => {
    it('should work', () => {
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
});

function unwind<T>(generator: Generator<any, T, any>): T {
    while (true) {
        let { done, value } = generator.next();
        if (done) {
            return value;
        }
    }
}

// function ScriptEvaluation(scriptRecord: any) {
//     if ((surroundingAgent as any).hostDefinedOptions.boost?.evaluateScript) {
//         return (
//             surroundingAgent as any
//         ).hostDefinedOptions.boost.evaluateScript(scriptRecord);
//     }

//     const globalEnv = scriptRecord.Realm.GlobalEnv;
//     const scriptContext = new ExecutionContext() as any;
//     scriptContext.Function = Value.null;
//     scriptContext.Realm = scriptRecord.Realm;
//     scriptContext.ScriptOrModule = scriptRecord;
//     scriptContext.VariableEnvironment = globalEnv;
//     scriptContext.LexicalEnvironment = globalEnv;
//     scriptContext.PrivateEnvironment = Value.null;
//     scriptContext.HostDefined = scriptRecord.HostDefined;
//     // Suspend runningExecutionContext
//     (surroundingAgent as any).executionContextStack.push(scriptContext);
//     const scriptBody = scriptRecord.ECMAScriptCode;
//     let result = EnsureCompletion(
//         GlobalDeclarationInstantiation(scriptBody, globalEnv)
//     );

//     if (result.Type === 'normal') {
//         let iterator = Evaluate(scriptBody);
//         while (true) {
//             const { done, value } = iterator.next();

//             if (done) {
//                 result = EnsureCompletion(value);
//                 break;
//             }
//         }

//         //   result = EnsureCompletion(unwind(Evaluate(scriptBody)));
//     }

//     if (result.Type === 'normal' && !result.Value) {
//         result = NormalCompletion(Value.undefined);
//     }

//     // Suspend scriptCtx
//     (surroundingAgent as any).executionContextStack.pop(scriptContext);
//     // Resume(surroundingAgent.runningExecutionContext);

//     return result;
// }
