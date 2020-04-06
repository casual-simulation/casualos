import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
} from './AuxGlobalContext';
import {
    createDummyRuntimeBot,
    TestScriptBotFactory,
} from './test/TestScriptBotFactory';
import { RanOutOfEnergyError } from '../bots';

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
            },
            new TestScriptBotFactory()
        );
    });

    describe('addToContext()', () => {
        it('should insert the given bot in order by ID', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            addToContext(context, bot1, bot3, bot2);

            expect(context.bots).toEqual([bot1, bot2, bot3]);
        });
    });

    describe('enqueueError()', () => {
        it('should throw if the given error is a RanOutOfEnergyError', () => {
            const err = new RanOutOfEnergyError();
            expect(() => {
                context.enqueueError(err);
            }).toThrow(err);
        });
    });
});
