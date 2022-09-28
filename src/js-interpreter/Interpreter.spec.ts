import {
    Agent,
    ManagedRealm,
    setSurroundingAgent,
    Value,
    inspect,
    CreateDataProperty,
} from '@engine262/engine262';

describe('Interpreter', () => {
    it('should work', () => {
        const agent = new Agent({});
        setSurroundingAgent(agent);
        const realm = new ManagedRealm({});

        realm.scope(() => {
            const print = new Value((args: any[]) => {
                console.log(...args.map((tmp) => inspect(tmp)));
                return Value.undefined;
            });

            CreateDataProperty(realm.GlobalObject, new Value('print'), print);
        });

        realm.evaluateScript(`
            for(let i = 0; i < 10; i++) {
                print(i);
            }
        `);
    });
});
