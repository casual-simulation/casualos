import type { StateUpdatedEvent } from './StateUpdatedEvent';
import {
    applyUpdates,
    stateUpdatedEvent,
    updatedBot,
} from './StateUpdatedEvent';
import type { PrecalculatedBotsState, PrecalculatedBot } from './Bot';
import { createBot, createPrecalculatedBot } from './BotCalculations';

describe('StateUpdatedEvent', () => {
    describe('applyUpdates()', () => {
        it('should merge the new state with the current state', () => {
            let currentState = null as PrecalculatedBotsState;
            const update1 = {
                state: {
                    user: createPrecalculatedBot('user'),
                    bot: createPrecalculatedBot('bot'),
                },
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            const update2 = {
                state: {
                    test: createPrecalculatedBot('test'),
                    user: <PrecalculatedBot>(<Partial<PrecalculatedBot>>{
                        tags: {
                            abc: 'def',
                        },
                        values: {
                            abc: 'def',
                        },
                    }),
                    bot: null,
                },
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            currentState = applyUpdates(currentState, update1);
            currentState = applyUpdates(currentState, update2);

            expect(currentState).toEqual({
                user: createPrecalculatedBot('user', {
                    abc: 'def',
                }),
                test: createPrecalculatedBot('test'),
            });
        });

        it('should delete tags that are set to null', () => {
            let currentState = null as PrecalculatedBotsState;
            const update1 = {
                state: {
                    bot: createPrecalculatedBot('bot', {
                        abc: 'def',
                    }),
                },
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            const update2 = {
                state: {
                    bot: <any>{
                        values: {
                            abc: null,
                        },
                        tags: {
                            abc: null,
                        },
                    },
                },
                addedBots: [],
                updatedBots: ['bot'],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            currentState = applyUpdates(currentState, update1);
            currentState = applyUpdates(currentState, update2);

            expect(currentState).toEqual({
                bot: createPrecalculatedBot('bot'),
            });
        });

        it('should delete signatures that are set to null', () => {
            let currentState = null as PrecalculatedBotsState;
            const update1 = {
                state: {
                    bot: {
                        id: 'bot',
                        precalculated: true,
                        tags: {
                            abc: 'def',
                        },
                        values: {
                            abc: 'def',
                        },
                        signatures: {
                            sig: 'abc',
                        },
                    },
                },
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            const update2 = {
                state: {
                    bot: <any>{
                        signatures: {
                            sig: null,
                        },
                    },
                },
                addedBots: [],
                updatedBots: ['bot'],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            currentState = applyUpdates(currentState, update1);
            currentState = applyUpdates(currentState, update2);

            expect(currentState).toEqual({
                bot: createPrecalculatedBot('bot', {
                    abc: 'def',
                }),
            });
        });

        it('should add signatures that are set', () => {
            let currentState = null as PrecalculatedBotsState;
            const update1 = {
                state: {
                    bot: {
                        id: 'bot',
                        precalculated: true,
                        tags: {
                            abc: 'def',
                        },
                        values: {
                            abc: 'def',
                        },
                    },
                },
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            const update2 = {
                state: {
                    bot: <any>{
                        signatures: {
                            sig: 'abc',
                        },
                    },
                },
                addedBots: [],
                updatedBots: ['bot'],
                removedBots: [],
                version: null,
            } as StateUpdatedEvent;

            currentState = applyUpdates(currentState, update1);
            currentState = applyUpdates(currentState, update2);

            expect(currentState).toEqual({
                bot: {
                    id: 'bot',
                    precalculated: true,
                    tags: {
                        abc: 'def',
                    },
                    values: {
                        abc: 'def',
                    },
                    signatures: {
                        sig: 'abc',
                    },
                },
            });
        });
    });

    describe('stateUpdatedEvent()', () => {
        it('should include bots with an ID property as added bots', () => {
            const update = stateUpdatedEvent({
                test: createBot('test'),
            });

            expect(update).toEqual({
                state: {
                    test: createBot('test'),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
                version: null,
            });
        });

        it('should include bots set to null as removed bots', () => {
            const update = stateUpdatedEvent({
                test: null,
            });

            expect(update).toEqual({
                state: {
                    test: null,
                },
                addedBots: [],
                removedBots: ['test'],
                updatedBots: [],
                version: null,
            });
        });

        it('should include bots without an ID property as updated bots', () => {
            const update = stateUpdatedEvent({
                test: {
                    tags: {
                        abc: 'def',
                    },
                },
            });

            expect(update).toEqual({
                state: {
                    test: {
                        tags: {
                            abc: 'def',
                        },
                    },
                },
                addedBots: [],
                removedBots: [],
                updatedBots: ['test'],
                version: null,
            });
        });

        it('should ignore bots set to undefined', () => {
            const update = stateUpdatedEvent({
                test: undefined,
            });

            expect(update).toEqual({
                state: {
                    test: undefined,
                },
                addedBots: [],
                removedBots: [],
                updatedBots: [],
                version: null,
            });
        });

        it('should use the given version', () => {
            const update = stateUpdatedEvent(
                {
                    test: undefined,
                },
                {
                    currentSite: 'abc',
                    remoteSite: 'def',
                    vector: {
                        abc: 123,
                        def: 345,
                    },
                }
            );

            expect(update).toEqual({
                state: {
                    test: undefined,
                },
                addedBots: [],
                removedBots: [],
                updatedBots: [],
                version: {
                    currentSite: 'abc',
                    remoteSite: 'def',
                    vector: {
                        abc: 123,
                        def: 345,
                    },
                },
            });
        });
    });

    describe('updatedBot()', () => {
        it('should return the bot with the list of tags that have been changed', () => {
            const updated = updatedBot(
                {
                    tags: {
                        num: 456,
                        newTag: true,
                        abc: null,
                    },
                },
                createBot('test', {
                    abc: 'def',
                    num: 123,
                })
            );

            expect(updated).toEqual({
                bot: createBot('test', {
                    abc: 'def',
                    num: 123,
                }),
                tags: ['num', 'newTag', 'abc'],
            });
        });

        it('should return the bot with the list of tags that have been changed', () => {
            const updated = updatedBot(
                {
                    masks: {
                        first: {
                            abc: null,
                            num: 456,
                            newTag: true,
                        },
                        second: {
                            abc: null,
                            num: 456,
                            newTag: true,
                        },
                    },
                },
                {
                    id: 'test',
                    tags: {},
                    masks: {
                        first: {
                            abc: 'def',
                        },
                        second: {
                            num: 123,
                        },
                    },
                }
            );

            expect(updated).toEqual({
                bot: {
                    id: 'test',
                    tags: {},
                    masks: {
                        first: {
                            abc: 'def',
                        },
                        second: {
                            num: 123,
                        },
                    },
                },
                tags: ['abc', 'num', 'newTag'],
            });
        });

        it('should the bot with the list of signatures that have been updated', () => {
            const updated = updatedBot(
                {
                    signatures: {
                        abc: null,
                        num: 'c',
                        newTag: 'd',
                    },
                },
                {
                    id: 'test',
                    tags: {},
                    signatures: {
                        abc: 'a',
                        num: 'b',
                    },
                }
            );

            expect(updated).toEqual({
                bot: {
                    id: 'test',
                    tags: {},
                    signatures: {
                        abc: 'a',
                        num: 'b',
                    },
                },
                tags: [],
                signatures: ['abc', 'num', 'newTag'],
            });
        });
    });
});
