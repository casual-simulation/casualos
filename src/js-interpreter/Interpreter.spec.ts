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
    unwind,
    Evaluate,
} from '@casual-simulation/engine262';

describe('Interpreter', () => {
    it('should work', () => {
        const agent = new Agent({
            yieldEachNode: true,
        });
        setSurroundingAgent(agent);
        const realm = new ManagedRealm({});

        realm.scope(() => {
            const print = new Value((args: any[]) => {
                console.log(...args.map((tmp) => inspect(tmp)));
                return Value.undefined;
            });

            CreateDataProperty(realm.GlobalObject, new Value('print'), print);
        });

        const script = `
            for(let i = 0; i < 10; i++) {
                print(i);
            }
        `;

        realm.scope(() => {
            const realm = agent.currentRealmRecord;
            const s = ParseScript(script, realm, {
                specifier: undefined,
                public: { specifier: undefined },
            });

            if (Array.isArray(s)) {
                return ThrowCompletion(s[0]);
            }

            return EnsureCompletion(ScriptEvaluation(s));
        });
    });
});

function ScriptEvaluation(scriptRecord: any) {
    if ((surroundingAgent as any).hostDefinedOptions.boost?.evaluateScript) {
        return (
            surroundingAgent as any
        ).hostDefinedOptions.boost.evaluateScript(scriptRecord);
    }

    const globalEnv = scriptRecord.Realm.GlobalEnv;
    const scriptContext = new ExecutionContext() as any;
    scriptContext.Function = Value.null;
    scriptContext.Realm = scriptRecord.Realm;
    scriptContext.ScriptOrModule = scriptRecord;
    scriptContext.VariableEnvironment = globalEnv;
    scriptContext.LexicalEnvironment = globalEnv;
    scriptContext.PrivateEnvironment = Value.null;
    scriptContext.HostDefined = scriptRecord.HostDefined;
    // Suspend runningExecutionContext
    (surroundingAgent as any).executionContextStack.push(scriptContext);
    const scriptBody = scriptRecord.ECMAScriptCode;
    let result = EnsureCompletion(
        GlobalDeclarationInstantiation(scriptBody, globalEnv)
    );

    if (result.Type === 'normal') {
        let iterator = Evaluate(scriptBody);
        while (true) {
            const { done, value } = iterator.next();

            if (done) {
                result = EnsureCompletion(value);
                break;
            }
        }

        //   result = EnsureCompletion(unwind(Evaluate(scriptBody)));
    }

    if (result.Type === 'normal' && !result.Value) {
        result = NormalCompletion(Value.undefined);
    }

    // Suspend scriptCtx
    (surroundingAgent as any).executionContextStack.pop(scriptContext);
    // Resume(surroundingAgent.runningExecutionContext);

    return result;
}
