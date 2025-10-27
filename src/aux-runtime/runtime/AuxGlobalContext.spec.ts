/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { AuxGlobalContext } from './AuxGlobalContext';
import {
    addToContext,
    MemoryGlobalContext,
    removeFromContext,
    DEBUG_STRING,
} from './AuxGlobalContext';
import {
    createDummyRuntimeBot,
    TestScriptBotFactory,
} from './test/TestScriptBotFactory';
import {
    createBot,
    botAdded,
    botRemoved,
    toast,
} from '@casual-simulation/aux-common/bots';
import type {
    RuntimeBatcher,
    RuntimeInterpreterGeneratorProcessor,
} from './RuntimeBot';
import { RealtimeEditMode } from './RuntimeBot';
import {
    waitAsync,
    allDataTypeCases,
} from '@casual-simulation/aux-common/test/TestHelpers';
import { RanOutOfEnergyError } from './AuxResults';
import { v4 as uuid } from 'uuid';
import { types } from 'util';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

describe('AuxGlobalContext', () => {
    let context: AuxGlobalContext;
    let factory: TestScriptBotFactory;
    let notifier: RuntimeBatcher;
    let processor: RuntimeInterpreterGeneratorProcessor;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;

    beforeEach(() => {
        realDateNow = Date.now;
        dateNowMock = Date.now = jest.fn();
        factory = new TestScriptBotFactory();
        notifier = {
            notifyChange: jest.fn(),
            notifyActionEnqueued: jest.fn(),
        };
        processor = {
            processGenerator: jest.fn(),
        };

        dateNowMock.mockReturnValue(123);

        context = new MemoryGlobalContext(
            {
                hash: 'hash',
                version: 'v1.2.3',
                major: 1,
                minor: 2,
                patch: 3,
                alpha: true,
                playerMode: 'builder',
            },
            {
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                isCollaborative: true,
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            },
            factory,
            notifier,
            processor
        );
    });

    afterEach(() => {
        Date.now = realDateNow;
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
                jest.useFakeTimers({});
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

                expect(fn).not.toHaveBeenCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([]);

                jest.advanceTimersByTime(500);

                expect(fn).not.toHaveBeenCalled();
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

                expect(fn).not.toHaveBeenCalled();
                expect(context.getBotTimers(bot1.id)).toEqual([]);

                jest.advanceTimersByTime(500);

                expect(fn).not.toHaveBeenCalled();
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

                expect(fn).not.toHaveBeenCalled();
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

                expect(fn).not.toHaveBeenCalled();
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

        it('should enqueue the same bot that it adds to the script factory', () => {
            const mock = (factory.createRuntimeBot = jest.fn(
                factory.createRuntimeBot
            ));
            context.createBot(
                createBot('test1', {
                    value: 123,
                })
            );

            const actions = context.dequeueActions();
            expect((actions[0] as any).bot === mock.mock.calls[0][0]).toBe(
                true
            );
        });

        it('should return null if the runtime bot was unable to be created', () => {
            const mock = (factory.createRuntimeBot = jest.fn(
                () => null as any
            ));

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

            expect(notifier.notifyChange).toHaveBeenCalledTimes(1);
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

        it.each(allDataTypeCases)(
            'should support creating a bot with a %s tag',
            (desc, given, expected) => {
                let result = context.createBot(
                    createBot('test1', {
                        value: given,
                    })
                );
                expect(result.tags.value).toEqual(expected);
                expect(result.raw.value).toEqual(expected);
                const actions = context.dequeueActions();
                expect(actions).toEqual([
                    botAdded(
                        createBot('test1', {
                            value: expected,
                        })
                    ),
                ]);
            }
        );
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

            expect(notifier.notifyChange).toHaveBeenCalledTimes(1);
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

    describe('unwrapBot()', () => {
        it('should return a regular object', () => {
            const bot1 = createDummyRuntimeBot('test1');
            addToContext(context, bot1);

            const unwrapped = context.unwrapBot(bot1);
            expect(unwrapped === bot1).toBe(false);
            expect(types.isProxy(unwrapped)).toBe(false);
        });

        it('should convert arrays to regular objects', () => {
            const bot1 = createDummyRuntimeBot('test1');
            addToContext(context, bot1);

            let array = ['abc'];
            bot1.tags.value = array;

            const unwrapped = context.unwrapBot(bot1);
            expect(unwrapped === bot1).toBe(false);
            expect(types.isProxy(unwrapped)).toBe(false);
            expect(unwrapped.tags.value === bot1.tags.value).toBe(false);
            expect(types.isProxy(unwrapped.tags.value)).toBe(false);
            expect(unwrapped.tags.value === array).toBe(true);
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

            expect(notifier.notifyChange).toHaveBeenCalledTimes(1);
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

        it('should use the context uuid function', () => {
            uuidMock
                .mockReturnValueOnce('task1')
                .mockReturnValueOnce('task2')
                .mockReturnValueOnce('task3');

            let count = 0;
            context.uuid = () => {
                count += 1;
                return count.toString();
            };

            const t1 = context.createTask(true);
            const t2 = context.createTask(true);
            const t3 = context.createTask(true);

            expect(t1.taskId).toBe('1');
            expect(t2.taskId).toBe('2');
            expect(t3.taskId).toBe('3');
        });

        it('should always use UUIDs if set to force unique task IDs', () => {
            uuidMock
                .mockReturnValueOnce('task1')
                .mockReturnValueOnce('task2')
                .mockReturnValueOnce('task3');

            context.forceUnguessableTaskIds = true;

            const t1 = context.createTask();
            const t2 = context.createTask();
            const t3 = context.createTask();

            expect(t1.taskId).toBe('task1');
            expect(t2.taskId).toBe('task2');
            expect(t3.taskId).toBe('task3');
        });

        it('should always use real UUIDs if set to force unique task IDs', () => {
            uuidMock
                .mockReturnValueOnce('task1')
                .mockReturnValueOnce('task2')
                .mockReturnValueOnce('task3');

            context.forceUnguessableTaskIds = true;
            let count = 0;
            context.uuid = () => {
                count += 1;
                return count.toString();
            };

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

            expect(fn).toHaveBeenCalledWith('abc');
            expect(fn).not.toHaveBeenCalledWith('def');
        });

        it('should do nothing by default when resolving from a remote', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.then(fn);

            context.resolveTask(t1.taskId, 'abc', true);
            context.resolveTask(t1.taskId, 'def', false);

            await waitAsync();

            expect(fn).not.toHaveBeenCalledWith('abc');
            expect(fn).toHaveBeenCalledWith('def');
        });

        it('should allow resolving from a remote when the task is expected to be resolved that way', async () => {
            const fn = jest.fn();
            const t1 = context.createTask(false, true);
            t1.promise.then(fn);

            context.resolveTask(t1.taskId, 'abc', true);

            await waitAsync();

            expect(fn).toHaveBeenCalledWith('abc');
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

            expect(fn).toHaveBeenCalledWith('abc');
            expect(fn).not.toHaveBeenCalledWith('def');
        });

        it('should do nothing by default when rejecting from a remote', async () => {
            const fn = jest.fn();
            const t1 = context.createTask();
            t1.promise.catch(fn);

            context.rejectTask(t1.taskId, 'abc', true);
            context.rejectTask(t1.taskId, 'def', false);

            await waitAsync();

            expect(fn).not.toHaveBeenCalledWith('abc');
            expect(fn).toHaveBeenCalledWith('def');
        });

        it('should allow rejecting from a remote when the task is expected to be resolved that way', async () => {
            const fn = jest.fn();
            const t1 = context.createTask(false, true);
            t1.promise.catch(fn);

            context.rejectTask(t1.taskId, 'abc', true);

            await waitAsync();

            expect(fn).toHaveBeenCalledWith('abc');
        });
    });

    describe('enqueueAction()', () => {
        it('should add the given action to the action batch', () => {
            context.enqueueAction(toast('hello!'));

            expect(context.actions).toEqual([toast('hello!')]);
        });

        it('should call the notifyActionEnqueued() function on the batcher', () => {
            context.enqueueAction(toast('hello!'));

            expect(notifier.notifyActionEnqueued).toHaveBeenCalledTimes(1);
            expect(notifier.notifyActionEnqueued).toHaveBeenCalledWith(
                toast('hello!')
            );

            context.enqueueAction(toast('abc'));

            expect(notifier.notifyActionEnqueued).toHaveBeenCalledTimes(2);
            expect(notifier.notifyActionEnqueued).toHaveBeenCalledWith(
                toast('abc')
            );
        });

        it('should call the notifyChange() function on the batcher', () => {
            context.enqueueAction(toast('hello!'));

            expect(notifier.notifyChange).toHaveBeenCalledTimes(1);

            context.enqueueAction(toast('abc'));

            expect(notifier.notifyChange).toHaveBeenCalledTimes(2);
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
            jest.useFakeTimers({});
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

            expect(fn1).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn1).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toHaveBeenCalled();
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

            expect(fn1).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn1).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot1.id)).toEqual([]);
            expect(fn2).not.toHaveBeenCalled();
            expect(context.getBotTimers(bot2.id)).toEqual([]);
        });
    });

    describe('getWatchersForBot()', () => {
        it('should return an empty set if there are no bots with listeners', () => {
            expect(context.getWatchersForBot('missing')).toEqual([]);
        });

        it('should return a set with the recorded bot IDs', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();
            const fn3 = jest.fn();
            const listener1 = {
                type: 'watch_bot' as const,
                botId: 'bot1',
                handler: fn1,
                tag: 'abc',
                timerId: 1,
            };
            const listener2 = {
                type: 'watch_bot' as const,
                botId: 'bot1',
                handler: fn2,
                tag: 'abc',
                timerId: 2,
            };
            const listener3 = {
                type: 'watch_bot' as const,
                botId: 'bot1',
                handler: fn3,
                tag: 'def',
                timerId: 3,
            };
            context.recordBotTimer('test1', listener1);
            context.recordBotTimer('test2', listener2);
            context.recordBotTimer('test3', listener3);

            expect(context.getWatchersForBot('bot1')).toEqual([
                listener1,
                listener2,
                listener3,
            ]);
        });

        it('should not include timers that were cleared because the bot that made them was destroyed', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();
            const fn3 = jest.fn();
            const listener1 = {
                type: 'watch_bot' as const,
                botId: 'bot1',
                handler: fn1,
                tag: 'abc',
                timerId: 1,
            };
            const listener2 = {
                type: 'watch_bot' as const,
                botId: 'bot1',
                handler: fn2,
                tag: 'abc',
                timerId: 2,
            };
            const listener3 = {
                type: 'watch_bot' as const,
                botId: 'bot1',
                handler: fn3,
                tag: 'def',
                timerId: 3,
            };
            context.recordBotTimer('test1', listener1);
            context.recordBotTimer('test2', listener2);
            context.recordBotTimer('test3', listener3);

            context.cancelBotTimers('test1');

            expect(context.getWatchersForBot('bot1')).toEqual([
                listener2,
                listener3,
            ]);
        });
    });

    describe('getWatchersForPortal()', () => {
        it('should return an empty set if there are no bots with listeners', () => {
            expect(context.getWatchersForPortal('missing')).toEqual([]);
        });

        it('should return a set with the recorded bot IDs', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();
            const fn3 = jest.fn();
            const listener1 = {
                type: 'watch_portal' as const,
                portalId: 'portal1',
                handler: fn1,
                tag: 'abc',
                timerId: 1,
            };
            const listener2 = {
                type: 'watch_portal' as const,
                portalId: 'portal1',
                handler: fn2,
                tag: 'abc',
                timerId: 2,
            };
            const listener3 = {
                type: 'watch_portal' as const,
                portalId: 'portal1',
                handler: fn3,
                tag: 'def',
                timerId: 3,
            };
            context.recordBotTimer('test1', listener1);
            context.recordBotTimer('test2', listener2);
            context.recordBotTimer('test3', listener3);

            expect(context.getWatchersForPortal('portal1')).toEqual([
                listener1,
                listener2,
                listener3,
            ]);
        });

        it('should not include timers that were cleared because the bot that made them was destroyed', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();
            const fn3 = jest.fn();
            const listener1 = {
                type: 'watch_portal' as const,
                portalId: 'portal1',
                handler: fn1,
                tag: 'abc',
                timerId: 1,
            };
            const listener2 = {
                type: 'watch_portal' as const,
                portalId: 'portal1',
                handler: fn2,
                tag: 'abc',
                timerId: 2,
            };
            const listener3 = {
                type: 'watch_portal' as const,
                portalId: 'portal1',
                handler: fn3,
                tag: 'def',
                timerId: 3,
            };
            context.recordBotTimer('test1', listener1);
            context.recordBotTimer('test2', listener2);
            context.recordBotTimer('test3', listener3);

            context.cancelBotTimers('test1');

            expect(context.getWatchersForPortal('portal1')).toEqual([
                listener2,
                listener3,
            ]);
        });
    });

    describe('mockAsyncActions', () => {
        it('should return true if the context is configured to use syncronous actions', () => {
            context.mockAsyncActions = true;
            expect(context.mockAsyncActions).toBe(true);
        });

        it('should return false if the context is configured to use asyncronous actions', () => {
            context.mockAsyncActions = false;
            expect(context.mockAsyncActions).toBe(false);
        });
    });

    describe('mocks', () => {
        it('should set the list of values that should be used to mock the given function', () => {
            let func = jest.fn();
            context.setMockReturns(func, [123, 'abc']);

            expect(context.getNextMockReturn(func, 'func', [])).toBe(123);
            expect(context.getNextMockReturn(func, 'func', [])).toBe('abc');
        });

        it('should be able to set a return value for a specific set of inputs', () => {
            let func = jest.fn();
            context.setMockReturn(func, [123, 'abc'], 'return value');

            expect(context.getNextMockReturn(func, 'func', [123, 'abc'])).toBe(
                'return value'
            );
            expect(() => {
                context.getNextMockReturn(func, 'func', [
                    'wrong',
                    'also wrong',
                ]);
            }).toThrow(
                'No mask data for function (no matching input): func("wrong", "also wrong")'
            );
        });

        it('should pretty print the argument list for missing functions', () => {
            let func = jest.fn();

            expect(() => {
                context.getNextMockReturn(func, 'func', [
                    'wrong',
                    { abc: 'def' },
                ]);
            }).toThrow(
                'No mask data for function: func("wrong", {\n  "abc": "def"\n})'
            );
        });

        it('should be able to use debug strings that are specified on arguments', () => {
            let func = jest.fn();

            expect(() => {
                context.getNextMockReturn(func, 'func', [
                    'wrong',
                    { abc: 'def', [DEBUG_STRING]: 'abc()' },
                ]);
            }).toThrow('No mask data for function: func("wrong", abc())');
        });

        it('should fail when getting mocks for a function that has nothing set', () => {
            let func = jest.fn();

            expect(() => {
                context.getNextMockReturn(func, 'func', []);
            }).toThrow('No mask data for function: func()');
        });

        it('should fail when the return value list has been exhausted', () => {
            let func = jest.fn();
            context.setMockReturns(func, [123, 'abc']);

            expect(context.getNextMockReturn(func, 'func', [])).toBe(123);
            expect(context.getNextMockReturn(func, 'func', [])).toBe('abc');
            expect(() => {
                context.getNextMockReturn(func, 'func', []);
            }).toThrow(
                'No mask data for function (out of return values): func()'
            );
        });
    });

    describe('processBotTimerResult()', () => {
        it('should do nothing if given undefined', () => {
            context.processBotTimerResult(undefined);
        });

        it('should pass the given generator to the processor', () => {
            function* gen() {
                yield 1;
                yield 2;
                yield 3;
                return 'hello';
            }

            const generator = gen();
            context.processBotTimerResult(generator as any);

            expect(processor.processGenerator).toHaveBeenCalledTimes(1);
            expect(
                (processor.processGenerator as any).mock.calls[0][0] ===
                    generator
            ).toBe(true);
        });
    });

    describe('startTime', () => {
        let realPerfNow: any;

        beforeEach(() => {
            jest.useFakeTimers({});
            realPerfNow = performance.now;
            const perfNowMock = (performance.now = jest.fn());
            perfNowMock.mockReturnValue(NaN); // performance.now() should not be used because it is based on the time origin and not absolute time.
        });

        afterEach(() => {
            performance.now = realPerfNow;
        });

        it('should return the time that the context was created', () => {
            expect(context.startTime).toBe(123);
        });
    });

    describe('localTime', () => {
        let realPerfNow: any;

        beforeEach(() => {
            realPerfNow = performance.now;
            const perfNowMock = (performance.now = jest.fn());
            perfNowMock.mockReturnValue(NaN); // performance.now() should not be used because it is based on the time origin and not absolute time.
        });

        afterEach(() => {
            performance.now = realPerfNow;
        });

        it('should return the number of miliseconds since the start time', () => {
            dateNowMock.mockReturnValueOnce(555);
            expect(context.localTime).toBe(555 - 123);
        });
    });
});
