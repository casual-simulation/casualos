import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
} from './AuxGlobalContext';
import { createDummyScriptBot } from './ScriptBot';

describe('AuxGlobalContext', () => {
    let context: AuxGlobalContext;

    beforeEach(() => {
        context = new MemoryGlobalContext(
            {
                hash: 'hash',
                version: 'v1.2.3',
                major: 1,
                minor: 2,
                patch: 3,
            },
            {
                supportsAR: false,
                supportsVR: false,
            }
        );
    });

    describe('addToContext()', () => {
        it('should insert the given bot in order by ID', () => {
            const bot1 = createDummyScriptBot(context, 'test1');
            const bot2 = createDummyScriptBot(context, 'test2');
            const bot3 = createDummyScriptBot(context, 'test3');
            addToContext(context, bot1, bot3, bot2);

            expect(context.bots).toEqual([bot1, bot2, bot3]);
        });
    });
});
