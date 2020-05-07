import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
} from './AuxGlobalContext';
import {
    createDummyRuntimeBot,
    TestScriptBotFactory,
} from './test/TestScriptBotFactory';
import { createBot, botAdded, botRemoved } from '../bots';
import { RealtimeEditMode } from './RuntimeBot';
import { waitAsync } from '../test/TestHelpers';
import { RanOutOfEnergyError } from './AuxResults';

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

    describe('createTask()', () => {
        it('should increment task IDs', () => {
            const t1 = context.createTask();
            const t2 = context.createTask();
            const t3 = context.createTask();

            expect(t1.taskId).toBe(1);
            expect(t2.taskId).toBe(2);
            expect(t3.taskId).toBe(3);
        });
    });

    describe('resolveTask()', () => {
        it('should be able to resolve a created task', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.then(fn);

            context.resolveTask(t1.taskId, 'abc');
            context.resolveTask(t1.taskId, 'def');

            await waitAsync();

            expect(fn).toBeCalledWith('abc');
            expect(fn).not.toBeCalledWith('def');
        });
    });

    describe('rejectTask()', () => {
        it('should be able to reject a created task', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.catch(fn);

            context.rejectTask(t1.taskId, 'abc');
            context.rejectTask(t1.taskId, 'def');

            await waitAsync();

            expect(fn).toBeCalledWith('abc');
            expect(fn).not.toBeCalledWith('def');
        });
    });
});
