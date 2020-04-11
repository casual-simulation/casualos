import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
} from './AuxGlobalContext';
import {
    createDummyRuntimeBot,
    TestScriptBotFactory,
} from './test/TestScriptBotFactory';
import { RanOutOfEnergyError, createBot, botAdded, botRemoved } from '../bots';
import { RealtimeEditMode } from './RuntimeBot';

describe('AuxGlobalContext', () => {
    let context: AuxGlobalContext;
    let factory: TestScriptBotFactory;

    beforeEach(() => {
        factory = new TestScriptBotFactory();
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
            factory
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

    describe('createBot()', () => {
        it('should add the new runtime bot to the context', () => {
            const bot = context.createBot(
                createBot('test1', {
                    value: 123,
                })
            );
            expect(bot).toMatchObject(
                createBot('test1', {
                    value: 123,
                })
            );
        });

        it('should enqueue a bot added action', () => {
            context.createBot(
                createBot('test1', {
                    value: 123,
                })
            );
            const actions = context.dequeueActions();
            expect(actions).toEqual([
                botAdded(
                    createBot('test1', {
                        value: 123,
                    })
                ),
            ]);
        });

        it('should return null if the runtime bot was unable to be created', () => {
            const mock = (factory.createRuntimeBot = jest.fn(() => null));

            const bot = context.createBot(
                createBot('test1', {
                    value: 123,
                })
            );
            expect(bot).toBe(null);

            // Should still enqueue a bot added action
            const actions = context.dequeueActions();
            expect(actions).toEqual([
                botAdded(
                    createBot('test1', {
                        value: 123,
                    })
                ),
            ]);
        });
    });

    describe('destroyBot()', () => {
        it('should not remove the bot from the context', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            addToContext(context, bot1, bot3, bot2);

            context.destroyBot(bot1);
            expect(context.bots).toEqual([bot2, bot3]);

            // Should still enqueue a bot removed action
            const actions = context.dequeueActions();
            expect(actions).toEqual([botRemoved('test1')]);
        });
        it('should not remove the bot from the context if the factory returns a delayed realtime edit mode', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            addToContext(context, bot1, bot3, bot2);

            const mock = (factory.destroyScriptBot = jest.fn(
                () => RealtimeEditMode.Delayed
            ));

            context.destroyBot(bot1);

            expect(context.bots).toEqual([bot1, bot2, bot3]);

            // Should still enqueue a bot removed action
            const actions = context.dequeueActions();
            expect(actions).toEqual([botRemoved('test1')]);
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
