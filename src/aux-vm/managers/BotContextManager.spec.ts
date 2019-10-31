import {
    BotIndex,
    createPrecalculatedBot,
    createPrecalculatedContext,
} from '@casual-simulation/aux-common';
import {
    BotContextManager,
    BotContextsUpdate,
    processIndexEvents,
} from './BotContextManager';
import { BotHelper } from '.';
import { TestAuxVM } from '../vm/test/TestAuxVM';

describe('BotContextManager', () => {
    let index: BotIndex;
    let helper: BotHelper;
    let vm: TestAuxVM;
    let contexts: BotContextManager;

    beforeEach(() => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
        helper.userId = 'user';
        index = new BotIndex();
        contexts = new BotContextManager(helper, index);
    });

    describe('processIndexEvents()', () => {
        it('should properly clone the previous state', () => {
            const calc = createPrecalculatedContext([]);
            const state = {
                contexts: new Map([['abc', new Set(['test'])]]),
                botsInContexts: new Map([['abc', new Set(['inContext'])]]),
            };
            const [_, newState] = processIndexEvents(state, calc, [], index, [
                'aux.context',
            ]);

            expect(newState).toEqual(state);
        });

        describe('context_added', () => {
            it('should emit a context_added event when a context is defined via a tag_added event', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const calc = createPrecalculatedContext([test]);
                const indexEvents = index.addBots([test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'context_added',
                            contextTag: 'aux.context',
                            contextBot: test,
                            context: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['aux.context']),
                        },
                    ],
                });
            });

            it('should emit a context_added event when a context is defined via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const final = createPrecalculatedBot('test', {
                    'aux.context': ['abc', 'def'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['aux.context']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'context_added',
                            contextTag: 'aux.context',
                            contextBot: final,
                            context: 'def',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['aux.context']),
                        },
                    ],
                });
            });

            it('should include all the bots that are already in the context', () => {
                const inContext = createPrecalculatedBot('inContext', {
                    abc: true,
                });
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const calc = createPrecalculatedContext([inContext, test]);
                const indexEvents = index.addBots([inContext, test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'context_added',
                            contextTag: 'aux.context',
                            contextBot: test,
                            context: 'abc',
                            existingBots: [inContext],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inContext,
                            tags: new Set(['abc']),
                        },
                        {
                            bot: test,
                            tags: new Set(['aux.context']),
                        },
                    ],
                });
            });

            it('should add all the bots that are already in the context to the state', () => {
                const inContext = createPrecalculatedBot('inContext', {
                    abc: true,
                });
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const calc = createPrecalculatedContext([inContext, test]);
                const indexEvents = index.addBots([inContext, test]);
                const [_, state] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(state).toEqual({
                    contexts: new Map([['abc', new Set(['test'])]]),
                    botsInContexts: new Map([['abc', new Set(['inContext'])]]),
                });
            });

            it('should include user bots with aux._userContext set to the context', () => {
                const user = createPrecalculatedBot('user', {
                    'aux._user': 'user',
                    'aux._userContext': 'abc',
                });
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const calc = createPrecalculatedContext([user, test]);
                const indexEvents = index.addBots([user, test]);
                const [result, state] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'context_added',
                            contextTag: 'aux.context',
                            contextBot: test,
                            context: 'abc',
                            existingBots: [user],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: user,
                            tags: new Set(['aux._user', 'aux._userContext']),
                        },
                        {
                            bot: test,
                            tags: new Set(['aux.context']),
                        },
                    ],
                });
            });
        });

        describe('context_removed', () => {
            it('should emit a context_removed event when a context is removed via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': ['abc', 'def'],
                });
                const final = createPrecalculatedBot('test', {
                    'aux.context': ['abc'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['aux.context']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'context_removed',
                            contextTag: 'aux.context',
                            contextBot: final,
                            context: 'def',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['aux.context']),
                        },
                    ],
                });
            });

            it('should emit a context_removed event when a context is removed via a tag_removed event', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': ['abc', 'def'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.removeBots(['test']);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'context_removed',
                            contextTag: 'aux.context',
                            contextBot: test,
                            context: 'abc',
                        },
                        {
                            type: 'context_removed',
                            contextTag: 'aux.context',
                            contextBot: test,
                            context: 'def',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['aux.context']),
                        },
                    ],
                });
            });

            it('should remove the bot from the context state', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': ['abc', 'def'],
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test]);
                const [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );
                calc = createPrecalculatedContext([]);
                indexEvents = index.removeBots(['test']);
                const [_, state2] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(state2).toEqual({
                    contexts: new Map(),
                    botsInContexts: new Map(),
                });
            });
        });

        describe('bot_added_to_context', () => {
            it('should emit a bot_added_to_context event when a bot is added to a context that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const inContext = createPrecalculatedBot('inContext', {
                    abc: true,
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );
                calc = createPrecalculatedContext([test, inContext]);
                indexEvents = index.addBots([inContext]);
                let [result] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'bot_added_to_context',
                            bot: inContext,
                            context: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inContext,
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should emit a bot_added_to_context event when a bot is updated into a context that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const inContext = createPrecalculatedBot('inContext', {});
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, inContext]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );
                calc = createPrecalculatedContext([test, inContext]);

                const inContextFinal = createPrecalculatedBot('inContext', {
                    abc: true,
                });
                indexEvents = index.updateBots([
                    {
                        bot: inContextFinal,
                        tags: new Set(['abc']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'bot_added_to_context',
                            bot: inContextFinal,
                            context: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inContextFinal,
                            tags: new Set(['abc']),
                        },
                    ],
                });

                expect(state).toEqual({
                    contexts: new Map([['abc', new Set(['test'])]]),
                    botsInContexts: new Map([['abc', new Set(['inContext'])]]),
                });
            });

            it('should emit a bot_added_to_context event when a user bot is updated into a context that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const user = createPrecalculatedBot('user', {
                    'aux._user': 'user',
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, user]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );
                calc = createPrecalculatedContext([test, user]);

                const userFinal = createPrecalculatedBot('user', {
                    'aux._user': 'user',
                    'aux._userContext': 'abc',
                });
                indexEvents = index.updateBots([
                    {
                        bot: userFinal,
                        tags: new Set(['aux._userContext']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'bot_added_to_context',
                            bot: userFinal,
                            context: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: userFinal,
                            tags: new Set(['aux._userContext']),
                        },
                    ],
                });

                expect(state).toEqual({
                    contexts: new Map([['abc', new Set(['test'])]]),
                    botsInContexts: new Map([['abc', new Set(['user'])]]),
                });
            });
        });

        describe('bot_removed_from_context', () => {
            it('should emit a bot_removed_from_context event when a bot is removed from a context that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const inContext = createPrecalculatedBot('inContext', {
                    abc: true,
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, inContext]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );
                calc = createPrecalculatedContext([test, inContext]);

                indexEvents = index.removeBots(['inContext']);
                let [result, state2] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'bot_removed_from_context',
                            bot: inContext,
                            context: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inContext,
                            tags: new Set(['abc']),
                        },
                    ],
                });

                expect(state2).toEqual({
                    contexts: new Map([['abc', new Set(['test'])]]),
                    botsInContexts: new Map([['abc', new Set([])]]),
                });
            });

            it('should emit a bot_removed_from_context event when a user bot is removed from a context that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    'aux.context': 'abc',
                });
                const user = createPrecalculatedBot('user', {
                    'aux._user': 'user',
                    'aux._userContext': 'abc',
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, user]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );
                calc = createPrecalculatedContext([test, user]);

                const userFinal = createPrecalculatedBot('user', {
                    'aux._user': 'user',
                    'aux._userContext': 'different',
                });
                indexEvents = index.updateBots([
                    {
                        bot: userFinal,
                        tags: new Set(['aux._userContext']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['aux.context']
                );

                expect(result).toEqual({
                    calc: calc,
                    contextEvents: [
                        {
                            type: 'bot_removed_from_context',
                            bot: userFinal,
                            context: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: userFinal,
                            tags: new Set(['aux._userContext']),
                        },
                    ],
                });

                expect(state).toEqual({
                    contexts: new Map([['abc', new Set(['test'])]]),
                    botsInContexts: new Map([['abc', new Set([])]]),
                });
            });
        });
    });

    describe('watchContexts()', () => {
        it('should emit a context_added event when a context is defined in the given tag', () => {
            let events = [] as BotContextsUpdate[];

            contexts
                .watchContexts('aux.context')
                .subscribe(e => events.push(e));

            const test = createPrecalculatedBot('test', {
                'aux.context': 'abc',
            });
            index.addBots([test]);

            expect(events).toEqual([
                {
                    calc: expect.anything(),
                    contextEvents: [
                        {
                            type: 'context_added',
                            contextTag: 'aux.context',
                            contextBot: test,
                            context: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['aux.context']),
                        },
                    ],
                },
            ]);
        });
    });
});
