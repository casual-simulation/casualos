import {
    auxTree,
    addAuxAtom,
    AuxResult,
    mergeAuxResults,
    AuxCausalTree,
    applyEvents,
    addAuxResults,
    applyAuxResult,
    applyAtoms,
} from './AuxCausalTree2';
import { bot, tag, value, del } from './AuxOpTypes';
import { createBot } from '../bots/BotCalculations';
import {
    newSite,
    atom,
    atomId,
    WeaveResult,
} from '@casual-simulation/causal-trees/core2';
import { botAdded, botRemoved, botUpdated } from '../bots';
import { BotStateUpdates } from './AuxStateHelpers';

describe('AuxCausalTree2', () => {
    describe('addAuxAtom()', () => {
        it('should return the state update', () => {
            const tree = auxTree('a');

            const result = addAuxAtom(tree, null, bot('test'));

            expect(result.update).toEqual({
                test: createBot('test'),
            });
        });
    });

    describe('mergeAuxResults()', () => {
        it('should merge the states', () => {
            const result1: AuxResult = {
                results: [],
                newSite: newSite('a', 1),
                update: {
                    test: createBot('test', {
                        num: 123,
                    }),
                    other: createBot('other', {
                        abc: 'def',
                    }),
                },
            };
            const result2: AuxResult = {
                results: [],
                newSite: newSite('a', 1),
                update: {
                    other: createBot('other', {
                        abc: 'ghi',
                    }),
                    new: createBot('new'),
                },
            };

            const final = mergeAuxResults(result1, result2);

            expect(final.update).toEqual({
                test: createBot('test', {
                    num: 123,
                }),
                other: createBot('other', {
                    abc: 'ghi',
                }),
                new: createBot('new'),
            });
        });
    });

    describe('addAuxResults()', () => {
        it('should add the new results to the given result', () => {
            const result1: AuxResult = {
                results: [],
                newSite: newSite('a', 1),
                update: {
                    test: createBot('test', {
                        num: 123,
                    }),
                    other: createBot('other', {
                        abc: 'def',
                    }),
                },
            };
            const result2: AuxResult = {
                results: [],
                newSite: newSite('a', 1),
                update: {
                    other: createBot('other', {
                        abc: 'ghi',
                    }),
                    new: createBot('new'),
                },
            };

            addAuxResults(result1, result2);

            expect(result1.update).toEqual({
                test: createBot('test', {
                    num: 123,
                }),
                other: createBot('other', {
                    abc: 'ghi',
                }),
                new: createBot('new'),
            });
        });
    });

    describe('applyEvents()', () => {
        let tree: AuxCausalTree;
        let updates: BotStateUpdates;
        let result: AuxResult;

        beforeEach(() => {
            tree = auxTree('a');
        });

        describe('add_bot', () => {
            it('should add a bot for the given ID', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });
                expect(updates).toEqual({
                    addedBots: [
                        createBot('test', {
                            abc: 'def',
                        }),
                    ],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });

        describe('remove_bot', () => {
            beforeEach(() => {
                ({ tree } = applyEvents(tree, [
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]));
            });

            it('should remove the bot with the given ID', () => {
                ({ tree, updates } = applyEvents(tree, [botRemoved('test')]));

                expect(tree.state).toEqual({});
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: ['test'],
                    updatedBots: [],
                });
            });

            it('should do nothing if the bot does not exist', () => {
                ({ tree } = applyEvents(tree, [botRemoved('test')]));

                ({ tree, updates } = applyEvents(tree, [botRemoved('test')]));

                expect(tree.state).toEqual({});
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should garbage collect the bot tags when removing a bot', () => {
                ({ tree, updates, result } = applyEvents(tree, [
                    botRemoved('test'),
                ]));

                const b1 = atom(atomId('a', 1), null, bot('test'));
                const t1 = atom(atomId('a', 2), b1, tag('abc'));
                const v1 = atom(atomId('a', 3), t1, value('def'));
                const d1 = atom(atomId('a', 4, 1), b1, del());

                expect(tree.weave.getAtoms()).toEqual([b1, d1]);

                expect(result.results.length).toBe(2);
                expect(result.results[0]).toEqual({
                    type: 'atom_added',
                    atom: d1,
                });
                expect(result.results[1]).toEqual({
                    type: 'atom_removed',
                    ref: {
                        atom: t1,
                        prev: null,
                        next: {
                            atom: v1,
                            prev: expect.anything(),
                            next: null,
                        },
                    },
                });
            });
        });

        describe('update_bot', () => {
            beforeEach(() => {
                ({ tree } = applyEvents(tree, [
                    botAdded(
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]));
            });

            it('should add new tags to the bot', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            newTag: true,
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                        newTag: true,
                    }),
                });
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                                newTag: true,
                            }),
                            tags: new Set(['newTag']),
                        },
                    ],
                });
            });

            it('should update existing tag values', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            abc: 123,
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 123,
                    }),
                });
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 123,
                            }),
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should merge multiple updates to the same bot', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            abc: 123,
                        },
                    }),
                    botUpdated('test', {
                        tags: {
                            newTag: true,
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 123,
                        newTag: true,
                    }),
                });
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 123,
                                newTag: true,
                            }),
                            tags: new Set(['abc', 'newTag']),
                        },
                    ],
                });
            });

            it('should merge multiple updates to the same tag', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            abc: 123,
                        },
                    }),
                    botUpdated('test', {
                        tags: {
                            abc: 'ghi',
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'ghi',
                    }),
                });
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'ghi',
                            }),
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should remove tags which are set to null', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            abc: null,
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test'),
                });
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test'),
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should ignore updates which dont change the tag value', () => {
                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            abc: 'def',
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                });
                expect(updates).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should garbage collect old value atoms from the weave', () => {
                ({ tree, updates, result } = applyEvents(tree, [
                    botUpdated('test', {
                        tags: {
                            abc: 123,
                        },
                    }),
                ]));

                const b1 = atom(atomId('a', 1), null, bot('test'));
                const t1 = atom(atomId('a', 2), b1, tag('abc'));
                const v1 = atom(atomId('a', 3), t1, value('def'));
                const v2 = atom(atomId('a', 4), t1, value(123));
                expect(tree.weave.getAtoms()).toEqual([b1, t1, v2]);

                expect(result.results.length).toBe(2);
                expect(result.results[0]).toEqual({
                    type: 'atom_added',
                    atom: v2,
                });
                expect(result.results[1]).toEqual({
                    type: 'atom_removed',
                    ref: {
                        prev: null,
                        next: null,
                        atom: v1,
                    },
                });
            });
        });
    });

    describe('applyAtoms()', () => {
        let tree: AuxCausalTree;
        let updates: BotStateUpdates;
        let results: WeaveResult[];

        beforeEach(() => {
            tree = auxTree('a');
        });

        it('should add the given atoms to the weave', () => {
            const bot1 = atom(atomId('a', 1), null, bot('bot1'));
            const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
            const value1 = atom(atomId('a', 3), tag1, value('abc'));

            ({ tree, updates, results } = applyAtoms(tree, [
                bot1,
                tag1,
                value1,
            ]));

            expect(tree).toEqual({
                site: {
                    id: 'a',
                    time: 3,
                },
                weave: expect.anything(),
                state: {
                    bot1: createBot('bot1', {
                        tag1: 'abc',
                    }),
                },
            });
            expect(updates).toEqual({
                addedBots: [
                    createBot('bot1', {
                        tag1: 'abc',
                    }),
                ],
                updatedBots: [],
                removedBots: [],
            });
            expect(results).toEqual([
                {
                    type: 'atom_added',
                    atom: bot1,
                },
                {
                    type: 'atom_added',
                    atom: tag1,
                },
                {
                    type: 'atom_added',
                    atom: value1,
                },
            ]);
        });

        it('should treat all the atoms as a single update batch', () => {
            const bot1 = atom(atomId('a', 1), null, bot('bot1'));
            const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
            const value1 = atom(atomId('a', 3), tag1, value('abc'));
            const value2 = atom(atomId('a', 4), tag1, value('def'));
            const tag2 = atom(atomId('a', 5), bot1, tag('tag2'));
            const value3 = atom(atomId('a', 6), tag2, value('abc'));

            const bot2 = atom(atomId('b', 1), null, bot('bot2'));
            const tag3 = atom(atomId('b', 2), bot2, tag('tag3'));
            const value4 = atom(atomId('b', 3), tag3, value(4));
            const value5 = atom(atomId('b', 4), tag3, value(5));
            const tag4 = atom(atomId('b', 5), bot2, tag('tag4'));
            const value6 = atom(atomId('b', 6), tag4, value(6));

            ({ tree, updates, results } = applyAtoms(tree, [
                bot1,
                tag1,
                value1,
                value2,
                tag2,
                value3,
                bot2,
                tag3,
                value4,
                value5,
                tag4,
                value6,
            ]));

            expect(updates).toEqual({
                addedBots: [
                    createBot('bot1', {
                        tag1: 'def',
                        tag2: 'abc',
                    }),
                    createBot('bot2', {
                        tag3: 5,
                        tag4: 6,
                    }),
                ],
                removedBots: [],
                updatedBots: [],
            });
            expect(tree.site).toEqual({
                id: 'a',
                time: 12,
            });
        });

        it('should be able to remove atoms by hash', () => {
            const bot1 = atom(atomId('a', 1), null, bot('bot1'));
            const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
            const value1 = atom(atomId('a', 3), tag1, value('abc'));
            const value2 = atom(atomId('a', 4), tag1, value('def'));
            const tag2 = atom(atomId('a', 5), bot1, tag('tag2'));
            const value3 = atom(atomId('a', 6), tag2, value('abc'));

            const bot2 = atom(atomId('b', 1), null, bot('bot2'));
            const tag3 = atom(atomId('b', 2), bot2, tag('tag3'));
            const value4 = atom(atomId('b', 3), tag3, value(4));
            const value5 = atom(atomId('b', 4), tag3, value(5));
            const tag4 = atom(atomId('b', 5), bot2, tag('tag4'));
            const value6 = atom(atomId('b', 6), tag4, value(6));

            ({ tree, updates, results } = applyAtoms(tree, [
                bot1,
                tag1,
                value1,
                value2,
                tag2,
                value3,
                bot2,
                tag3,
                value4,
                value5,
                tag4,
                value6,
            ]));

            ({ tree, updates, results } = applyAtoms(tree, null, [bot1.hash]));

            expect(updates).toEqual({
                addedBots: [],
                removedBots: ['bot1'],
                updatedBots: [],
            });
            expect(tree.state).toEqual({
                bot2: createBot('bot2', {
                    tag3: 5,
                    tag4: 6,
                }),
            });
        });
    });
});
