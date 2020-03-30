import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
} from './AuxGlobalContext';
import { createDummyScriptBot } from './DummyScriptBot';

describe('AuxGlobalContext', () => {
    let context: AuxGlobalContext;

    beforeEach(() => {
        context = new MemoryGlobalContext();
    });

    describe('addToContext()', () => {
        it('should insert the given bot in order by ID', () => {
            const bot1 = createDummyScriptBot('test1');
            const bot2 = createDummyScriptBot('test2');
            const bot3 = createDummyScriptBot('test3');
            addToContext(context, bot1, bot3, bot2);

            expect(context.bots).toEqual([bot1, bot2, bot3]);
        });
    });
});
