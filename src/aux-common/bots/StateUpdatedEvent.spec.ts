import { StateUpdatedEvent, applyUpdates } from './StateUpdatedEvent';
import { PrecalculatedBotsState, PrecalculatedBot } from './Bot';
import { createPrecalculatedBot } from './BotCalculations';

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
});
