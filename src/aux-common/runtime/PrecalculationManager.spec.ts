import { PrecalculationManager } from './PrecalculationManager';
import values from 'lodash/values';
import { MemoryPartition, createMemoryPartition } from '../partitions';
import {
    createCalculationContext,
    botAdded,
    createBot,
    createPrecalculatedBot,
    botRemoved,
    botUpdated,
} from '../bots';

const errorMock = (console.error = jest.fn());

describe('PrecalculationManager', () => {
    let memory: MemoryPartition;
    let precalc: PrecalculationManager;

    beforeEach(async () => {
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        precalc = new PrecalculationManager(
            () => memory.state,
            () => createCalculationContext(values(memory.state), 'user')
        );

        await memory.applyEvents([botAdded(createBot('user'))]);
    });

    describe('botAdded()', () => {
        it('should calculate all the tags for the new bot', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        abc: 'def',
                        formula: '=getTag(this, "#abc")',
                    })
                ),
            ]);

            const update = precalc.botsAdded([memory.state['test']]);

            expect(update).toEqual({
                state: {
                    test: {
                        id: 'test',
                        precalculated: true,
                        tags: {
                            abc: 'def',
                            formula: '=getTag(this, "#abc")',
                        },
                        values: {
                            abc: 'def',
                            formula: 'def',
                        },
                    },
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should preserve the bot space', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot(
                        'test',
                        {
                            abc: 'def',
                        },
                        <any>'abc'
                    )
                ),
            ]);

            const update = precalc.botsAdded([memory.state['test']]);

            expect(update).toEqual({
                state: {
                    test: {
                        id: 'test',
                        precalculated: true,
                        space: 'abc',
                        tags: {
                            abc: 'def',
                        },
                        values: {
                            abc: 'def',
                        },
                    },
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should update tags affected by the new bot', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            const update = precalc.botsAdded([memory.state['test2']]);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 1,
                        },
                    },
                    test2: {
                        id: 'test2',
                        precalculated: true,
                        tags: {
                            name: 'bob',
                        },
                        values: {
                            name: 'bob',
                        },
                    },
                },
                addedBots: ['test2'],
                removedBots: [],
                updatedBots: ['test'],
            });
        });

        it('should replace non-copiable values with copiable ones', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots',
                    })
                ),
            ]);

            const state = precalc.botsAdded([memory.state['test']]);

            expect(state).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: '[Function getBots]',
                        },
                        {
                            formula: '=getBots',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should handle formulas which throw errors', async () => {
            precalc.logFormulaErrors = true;

            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=throw new Error("Test Error")',
                    })
                ),
            ]);

            const state = precalc.botsAdded([memory.state['test']]);

            expect(state).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: 'Error: Test Error',
                        },
                        {
                            formula: '=throw new Error("Test Error")',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should return only the state that was updated', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            const update = precalc.botsAdded([memory.state['test2']]);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 1,
                        },
                    },
                    test2: {
                        id: 'test2',
                        precalculated: true,
                        tags: {
                            name: 'bob',
                        },
                        values: {
                            name: 'bob',
                        },
                    },
                },
                addedBots: ['test2'],
                removedBots: [],
                updatedBots: ['test'],
            });
        });

        it('should be able to get the full state', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test2']]);

            expect(precalc.botsState).toEqual({
                test: {
                    id: 'test',
                    precalculated: true,
                    tags: {
                        formula: '=getBots("#name", "bob").length',
                    },
                    values: {
                        formula: 1,
                    },
                },
                test2: {
                    id: 'test2',
                    precalculated: true,
                    tags: {
                        name: 'bob',
                    },
                    values: {
                        name: 'bob',
                    },
                },
            });
        });
    });

    describe('botRemoved()', () => {
        it('should remove the given bot from the list', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        abc: 'def',
                        formula: '=getTag(this, "#abc")',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([botRemoved('test')]);

            const update = precalc.botsRemoved(['test']);

            expect(update).toEqual({
                state: {
                    test: null,
                },
                addedBots: [],
                removedBots: ['test'],
                updatedBots: [],
            });
        });

        it('should update tags affected by the removed bot', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test2']]);

            await memory.applyEvents([botRemoved('test2')]);

            const update = precalc.botsRemoved(['test2']);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 0,
                        },
                    },
                    test2: null,
                },
                addedBots: [],
                removedBots: ['test2'],
                updatedBots: ['test'],
            });
        });

        it('should update the bots state', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test2']]);

            await memory.applyEvents([botRemoved('test2')]);

            precalc.botsRemoved(['test2']);

            expect(precalc.botsState).toEqual({
                test: {
                    id: 'test',
                    precalculated: true,
                    tags: {
                        formula: '=getBots("#name", "bob").length',
                    },
                    values: {
                        formula: 0,
                    },
                },
            });
        });

        it('should handle removing two bots that are dependent on each other', async () => {
            // degrades to a "all" dependency
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        abc: 'def',
                        def: true,
                        formula: '=getBots(getTag(this, "abc"))',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            // degrades to a "all" dependency
            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        abc: 'def',
                        def: true,
                        formula: '=getBots(getTag(this, "abc"))',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test2']]);

            await memory.applyEvents([botRemoved('test'), botRemoved('test2')]);

            let update = precalc.botsRemoved(['test', 'test2']);

            expect(update).toEqual({
                state: {
                    test: null,
                    test2: null,
                },
                addedBots: [],
                removedBots: ['test', 'test2'],
                updatedBots: [],
            });

            expect(precalc.botsState).toEqual({});
        });
    });

    describe('botUpdated()', () => {
        it('should update the affected tags on the given bot', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        abc: 'def',
                        formula: '=getTag(this, "#abc")',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botUpdated('test', {
                    tags: {
                        abc: 'ghi',
                    },
                }),
            ]);

            const update = precalc.botsUpdated([
                {
                    bot: memory.state['test'],
                    tags: ['abc'],
                },
            ]);

            expect(update).toEqual({
                state: {
                    test: {
                        tags: {
                            abc: 'ghi',
                        },
                        values: {
                            abc: 'ghi',
                            formula: 'ghi',
                        },
                    },
                },
                addedBots: [],
                removedBots: [],
                updatedBots: ['test'],
            });
        });

        it('should update tags affected by the updated bot', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test2']]);

            await memory.applyEvents([
                botUpdated('test2', {
                    tags: {
                        name: 'alice',
                    },
                }),
            ]);
            // await tree.updateBot(memory.state['test2'], {
            //     tags: {
            //         name: 'alice',
            //     },
            // });

            const update = precalc.botsUpdated([
                {
                    bot: memory.state['test2'],
                    tags: ['name'],
                },
            ]);

            expect(update).toEqual({
                state: {
                    test: {
                        values: {
                            formula: 0,
                        },
                    },
                    test2: {
                        tags: {
                            name: 'alice',
                        },
                        values: {
                            name: 'alice',
                        },
                    },
                },
                addedBots: [],
                removedBots: [],
                updatedBots: ['test2', 'test'],
            });
        });

        it('should update the bots state', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '=getBots("#name", "bob").length',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botAdded(
                    createBot('test2', {
                        name: 'bob',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test2']]);

            await memory.applyEvents([
                botUpdated('test2', {
                    tags: {
                        name: 'alice',
                    },
                }),
            ]);

            precalc.botsUpdated([
                {
                    bot: memory.state['test2'],
                    tags: ['name'],
                },
            ]);

            expect(precalc.botsState).toEqual({
                test: {
                    id: 'test',
                    precalculated: true,
                    tags: {
                        formula: '=getBots("#name", "bob").length',
                    },
                    values: {
                        formula: 0,
                    },
                },
                test2: {
                    id: 'test2',
                    precalculated: true,
                    tags: {
                        name: 'alice',
                    },
                    values: {
                        name: 'alice',
                    },
                },
            });
        });

        it('should replace non-copiable values with copiable ones', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '="test"',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botUpdated('test', {
                    tags: {
                        formula: '=getBots',
                    },
                }),
            ]);

            const state = precalc.botsUpdated([
                {
                    bot: memory.state['test'],
                    tags: ['formula'],
                },
            ]);

            expect(state).toEqual({
                state: {
                    test: {
                        tags: {
                            formula: '=getBots',
                        },
                        values: {
                            formula: '[Function getBots]',
                        },
                    },
                },
                addedBots: [],
                removedBots: [],
                updatedBots: ['test'],
            });
        });

        it('should log errors from formulas if set to do so', async () => {
            precalc.logFormulaErrors = true;

            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        formula: '="test"',
                    })
                ),
            ]);

            precalc.botsAdded([memory.state['test']]);

            await memory.applyEvents([
                botUpdated('test', {
                    tags: {
                        formula: '=getBots(',
                    },
                }),
            ]);

            const state = precalc.botsUpdated([
                {
                    bot: memory.state['test'],
                    tags: ['formula'],
                },
            ]);

            expect(errorMock).toBeCalledWith(
                expect.any(String),
                expect.any(SyntaxError)
            );
        });

        const nullTagCases = [[''], [null], [undefined]];

        it.each(nullTagCases)(
            'should mark tags set to %s as null',
            async val => {
                await memory.applyEvents([
                    botAdded(
                        createBot('test', {
                            formula: '="test"',
                        })
                    ),
                ]);

                precalc.botsAdded([memory.state['test']]);

                await memory.applyEvents([
                    botUpdated('test', {
                        tags: {
                            formula: val,
                        },
                    }),
                ]);

                const state = precalc.botsUpdated([
                    {
                        bot: memory.state['test'],
                        tags: ['formula'],
                    },
                ]);

                expect(state).toEqual({
                    state: {
                        test: {
                            tags: {
                                formula: null,
                            },
                            values: {
                                formula: null,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            }
        );
    });
});
