import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
} from './AuxGlobalContext';
import {
    createDummyRuntimeBot,
    TestScriptBotFactory,
} from './test/TestScriptBotFactory';
import { createBot, botAdded, botRemoved } from '../bots';
import { RealtimeEditMode, RuntimeBatcher } from './RuntimeBot';
import { waitAsync } from '../test/TestHelpers';
import { RanOutOfEnergyError } from './AuxResults';
import { v4 as uuid } from 'uuid';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

describe('AuxGlobalContext', () => {
    let context: AuxGlobalContext;
    let factory: TestScriptBotFactory;
    let notifier: RuntimeBatcher;

    beforeEach(() => {
        factory = new TestScriptBotFactory();
        notifier = {
            notifyChange: jest.fn(),
        };
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
            factory,
            notifier
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

    describe('removeFromContext()', () => {
        it('should remove the given bot', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            addToContext(context, bot1, bot3, bot2);

            removeFromContext(context, [bot2]);

            expect(context.bots).toEqual([bot1, bot3]);
        });

        it('should not remove a bot if given a bot that is not in the context', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            addToContext(context, bot1, bot3);

            removeFromContext(context, [bot2]);

            expect(context.bots).toEqual([bot1, bot3]);
        });

        describe('timers', () => {
            beforeEach(() => {
                jest.useFakeTimers('modern');
            });
            afterEach(() => {
                jest.clearAllTimers();
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            it('should keep track of the total number of timers', () => {
                const bot1 = createDummyRuntimeBot('test1');
                const bot2 = createDummyRuntimeBot('test2');
                addToContext(context, bot1, bot2);

                const fn = jest.fn();
                const timer = <any>setTimeout(fn, 500);

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'timeout',
                });

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'timeout',
                });

                expect(context.getNumberOfActiveTimers()).toBe(2);

                context.cancelAllBotTimers();

                expect(context.getNumberOfActiveTimers()).toBe(0);

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'timeout',
                });

                context.recordBotTimer(bot2.id, {
                    timerId: timer,
                    type: 'timeout',
                });

                expect(context.getNumberOfActiveTimers()).toBe(2);

                context.cancelBotTimers(bot1.id);

                expect(context.getNumberOfActiveTimers()).toBe(1);
            });

            it('should cancel setTimeout() timers', () => {
                const bot1 = createDummyRuntimeBot('test1');
                addToContext(context, bot1);

                const fn = jest.fn();
                const timer = <any>setTimeout(fn, 500);

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'timeout',
                });

                removeFromContext(context, [bot1]);

                expect(fn).not.toBeCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([]);

                jest.advanceTimersByTime(500);

                expect(fn).not.toBeCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([]);
            });

            it('should cancel setInterval() timers', () => {
                const bot1 = createDummyRuntimeBot('test1');
                addToContext(context, bot1);

                const fn = jest.fn();
                const timer = <any>setInterval(fn, 500);

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'interval',
                });

                removeFromContext(context, [bot1]);

                expect(fn).not.toBeCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([]);

                jest.advanceTimersByTime(500);

                expect(fn).not.toBeCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([]);
            });

            it('should not cancel setInterval() timers if specified', () => {
                const bot1 = createDummyRuntimeBot('test1');
                addToContext(context, bot1);

                const fn = jest.fn();
                const timer = <any>setInterval(fn, 500);

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'interval',
                });

                removeFromContext(context, [bot1], false);

                expect(fn).not.toBeCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([
                    {
                        timerId: timer,
                        type: 'interval',
                    },
                ]);
            });

            it('should not cancel setTimeout() timers if specified', () => {
                const bot1 = createDummyRuntimeBot('test1');
                addToContext(context, bot1);

                const fn = jest.fn();
                const timer = <any>setTimeout(fn, 500);

                context.recordBotTimer(bot1.id, {
                    timerId: timer,
                    type: 'timeout',
                });

                removeFromContext(context, [bot1], false);

                expect(fn).not.toBeCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([
                    {
                        timerId: timer,
                        type: 'timeout',
                    },
                ]);
            });
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

        it('should notify of a change', () => {
            context.createBot(
                createBot('test1', {
                    value: 123,
                })
            );

            expect(notifier.notifyChange).toBeCalledTimes(1);
        });

        it('should record listeners for new bots', () => {
            context.createBot(
                createBot('test1', {
                    value: 123,
                    func1: jest.fn(),
                    func2: jest.fn(),
                })
            );

            expect(context.getBotIdsWithListener('func1')).toEqual(['test1']);
            expect(context.getBotIdsWithListener('func2')).toEqual(['test1']);
        });
    });

    describe('destroyBot()', () => {
        it('should remove the bot from the context', () => {
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

        it('should not remove the bot from the context if the given bot is not in the context', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            addToContext(context, bot1, bot3);

            context.destroyBot(bot2);

            expect(context.bots).toEqual([bot1, bot3]);

            // Should still enqueue a bot removed action
            const actions = context.dequeueActions();
            expect(actions).toEqual([]);
        });

        it('should notify of a change', () => {
            const bot1 = createDummyRuntimeBot('test1');
            addToContext(context, bot1);

            context.destroyBot(bot1);

            expect(notifier.notifyChange).toBeCalledTimes(1);
        });

        it('should remove listeners for the bot', () => {
            const bot1 = createDummyRuntimeBot('test1');
            bot1.listeners.func1 = jest.fn();
            bot1.listeners.func2 = jest.fn();

            addToContext(context, bot1);

            context.recordListenerPresense('test1', 'func1', true);
            context.recordListenerPresense('test1', 'func2', true);

            context.destroyBot(bot1);

            expect(context.getBotIdsWithListener('func1')).toEqual([]);
            expect(context.getBotIdsWithListener('func2')).toEqual([]);
        });
    });

    describe('enqueueError()', () => {
        it('should throw if the given error is a RanOutOfEnergyError', () => {
            const err = new RanOutOfEnergyError();
            expect(() => {
                context.enqueueError(err);
            }).toThrow(err);
        });

        it('should notify of a change', () => {
            const err = new Error();
            context.enqueueError(err);

            expect(notifier.notifyChange).toBeCalledTimes(1);
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

        it('should create the task ID using UUIDs', () => {
            uuidMock
                .mockReturnValueOnce('task1')
                .mockReturnValueOnce('task2')
                .mockReturnValueOnce('task3');

            const t1 = context.createTask(true);
            const t2 = context.createTask(true);
            const t3 = context.createTask(true);

            expect(t1.taskId).toBe('task1');
            expect(t2.taskId).toBe('task2');
            expect(t3.taskId).toBe('task3');
        });
    });

    describe('resolveTask()', () => {
        it('should be able to resolve a created task', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.then(fn);

            context.resolveTask(t1.taskId, 'abc', false);
            context.resolveTask(t1.taskId, 'def', false);

            await waitAsync();

            expect(fn).toBeCalledWith('abc');
            expect(fn).not.toBeCalledWith('def');
        });

        it('should do nothing by default when resolving from a remote', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.then(fn);

            context.resolveTask(t1.taskId, 'abc', true);
            context.resolveTask(t1.taskId, 'def', false);

            await waitAsync();

            expect(fn).not.toBeCalledWith('abc');
            expect(fn).toBeCalledWith('def');
        });

        it('should allow resolving from a remote when the task is expected to be resolved that way', async () => {
            const fn = jest.fn();
            const t1 = context.createTask(false, true);
            t1.promise.then(fn);

            context.resolveTask(t1.taskId, 'abc', true);

            await waitAsync();

            expect(fn).toBeCalledWith('abc');
        });
    });

    describe('rejectTask()', () => {
        it('should be able to reject a created task', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.catch(fn);

            context.rejectTask(t1.taskId, 'abc', false);
            context.rejectTask(t1.taskId, 'def', false);

            await waitAsync();

            expect(fn).toBeCalledWith('abc');
            expect(fn).not.toBeCalledWith('def');
        });

        it('should do nothing by default when rejecting from a remote', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.catch(fn);

            context.rejectTask(t1.taskId, 'abc', true);
            context.rejectTask(t1.taskId, 'def', false);

            await waitAsync();

            expect(fn).not.toBeCalledWith('abc');
            expect(fn).toBeCalledWith('def');
        });

        it('should allow rejecting from a remote when the task is expected to be resolved that way', async () => {
            const fn = jest.fn();
            const t1 = context.createTask(false, true);
            t1.promise.catch(fn);

            context.rejectTask(t1.taskId, 'abc', true);

            await waitAsync();

            expect(fn).toBeCalledWith('abc');
        });
    });

    describe('getBotIdsWithListener()', () => {
        it('should return an empty set if there are no bots with listeners', () => {
            expect(context.getBotIdsWithListener('missing')).toEqual([]);
        });

        it('should return a set with the recorded bot IDs', () => {
            context.recordListenerPresense('test1', 'abc', true);
            context.recordListenerPresense('test2', 'abc', true);
            context.recordListenerPresense('test3', 'def', true);

            expect(context.getBotIdsWithListener('abc')).toEqual([
                'test1',
                'test2',
            ]);
        });

        it('should return the IDs in alphabetical order', () => {
            context.recordListenerPresense('test3', 'abc', true);
            context.recordListenerPresense('test1', 'abc', true);
            context.recordListenerPresense('test2', 'abc', true);

            expect(context.getBotIdsWithListener('abc')).toEqual([
                'test1',
                'test2',
                'test3',
            ]);
        });

        it('should only include IDs that have a listener', () => {
            context.recordListenerPresense('test1', 'abc', true);
            context.recordListenerPresense('test2', 'abc', true);
            context.recordListenerPresense('test3', 'abc', true);
            context.recordListenerPresense('test3', 'abc', false);

            expect(context.getBotIdsWithListener('abc')).toEqual([
                'test1',
                'test2',
            ]);
        });

        it('should return a copy of the array', () => {
            context.recordListenerPresense('test1', 'abc', true);
            context.recordListenerPresense('test2', 'abc', true);
            context.recordListenerPresense('test3', 'abc', true);
            context.recordListenerPresense('test3', 'abc', false);

            const arr = context.getBotIdsWithListener('abc');

            arr.push('wrong');

            expect(context.getBotIdsWithListener('abc')).not.toEqual(arr);
        });
    });

    describe('cancelAllBotTimers', () => {
        beforeEach(() => {
            jest.useFakeTimers('modern');
        });
        afterEach(() => {
            jest.clearAllTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('should cancel setTimeout() timers', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            addToContext(context, bot1, bot2);

            const fn1 = jest.fn();
            const fn2 = jest.fn();
            const timer1 = <any>setTimeout(fn1, 500);
            const timer2 = <any>setTimeout(fn2, 500);

            context.recordBotTimer(bot1.id, {
                timerId: timer1,
                type: 'timeout',
            });

            context.recordBotTimer(bot2.id, {
                timerId: timer2,
                type: 'timeout',
            });

            context.cancelAllBotTimers();

            expect(fn1).not.toBeCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toBeCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn1).not.toBeCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toBeCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);
        });

        it('should cancel setInterval() timers', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            addToContext(context, bot1, bot2);

            const fn1 = jest.fn();
            const fn2 = jest.fn();
            const timer1 = <any>setInterval(fn1, 500);
            const timer2 = <any>setInterval(fn2, 500);

            context.recordBotTimer(bot1.id, {
                timerId: timer1,
                type: 'interval',
            });

            context.recordBotTimer(bot2.id, {
                timerId: timer2,
                type: 'interval',
            });

            context.cancelAllBotTimers();

            expect(fn1).not.toBeCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toBeCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn1).not.toBeCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toBeCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);
        });
    });
});
