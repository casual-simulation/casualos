import { MemoryPartition, createMemoryPartition } from '../partitions';
import { AuxRuntime } from './AuxRuntime';
import { BotAction, createBot, createPrecalculatedBot } from '../bots';
import { botActionsTests } from '../bots/test/BotActionsTests';
import uuid from 'uuid/v4';
import { PrecalculationManager } from '.';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AuxRuntime', () => {
    let memory: MemoryPartition;
    let runtime: AuxRuntime;
    let events: BotAction[][];

    beforeEach(() => {
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        runtime = new AuxRuntime();

        events = [];

        // runtime.onActions.subscribe(a => events.push(a));
    });

    describe('botsAdded()', () => {
        it('should return a state update for the new bot', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
                createBot('test2', {
                    num: 123,
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                    test2: createPrecalculatedBot('test2', {
                        num: 123,
                    }),
                },
                addedBots: ['test', 'test2'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should return a state update that bots added in a previous update', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
            ]);

            const update2 = runtime.botsAdded([
                createBot('test2', {
                    num: 123,
                }),
            ]);

            expect(update2).toEqual({
                state: {
                    test2: createPrecalculatedBot('test2', {
                        num: 123,
                    }),
                },
                addedBots: ['test2'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should overwrite bots with the same ID', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
            ]);

            const update2 = runtime.botsAdded([
                createBot('test', {
                    abc: 123,
                }),
            ]);

            expect(update2).toEqual({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 123,
                    }),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should include the space the bot was in', () => {
            const update = runtime.botsAdded([
                createBot(
                    'test',
                    {
                        abc: 'def',
                    },
                    'history'
                ),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            abc: 'def',
                        },
                        undefined,
                        'history'
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should pre-calculate simple formulas', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    abc: '=123',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            abc: 123,
                        },
                        {
                            abc: '=123',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });
    });

    // botActionsTests(uuidMock, (state, action, library) => {
    //     const runtime = new AuxRuntime();
    //     const memory = createMemoryPartition({
    //         type: 'memory',
    //         initialState: {}
    //     });
    //     const precalc = new PrecalculationManager(() => memory.state, )
    //     // runtime.update({
    //     //     state: state,
    //     //     addedBots: [],
    //     //     removedBots: [],
    //     //     updatedBots: []
    //     // });
    //     return runtime.shout(action.eventName, action.botIds, action.argument);
    // });
});
