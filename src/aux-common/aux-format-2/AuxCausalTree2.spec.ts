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
import {
    bot,
    tag,
    value,
    del,
    tagValueHash,
    CertificateOp,
    signedCert,
} from './AuxOpTypes';
import { createBot } from '../bots/BotCalculations';
import {
    newSite,
    atom,
    atomId,
    WeaveResult,
    addAtom,
    Atom,
} from '@casual-simulation/causal-trees/core2';
import {
    botAdded,
    botRemoved,
    botUpdated,
    createCertificate,
    asyncResult,
    asyncError,
    signTag,
    revokeCertificate,
} from '../bots';
import { BotStateUpdates } from './AuxStateHelpers';
import reducer, { CERTIFIED_SPACE, certificateId } from './AuxWeaveReducer';
import { Action } from '@casual-simulation/causal-trees';

const keypair1 =
    'vK1.X9EJQT0znVqXj7D0kRyLSF1+F5u2bT7xKunF/H/SUxU=.djEueE1FL0VkOU1VanNaZGEwUDZ3cnlicjF5bnExZFptVzcubkxrNjV4ckdOTlM3Si9STGQzbGUvbUUzUXVEdmlCMWQucWZocVJQT21KeEhMbXVUWThORGwvU0M0dGdOdUVmaDFlcFdzMndYUllHWWxRZWpJRWthb1dJNnVZdXdNMFJVUTFWamkyc3JwMUpFTWJobk5sZ2Y2d01WTzRyTktDaHpwcUZGbFFnTUg0ZVU9';
const keypair2 =
    'vK1.H6/kRocyRcAAjQzjjSLi5/toJiis9Sj1NYuoYIYPQdE=.djEubjVrRzV1SmIycjFaUmszTHNxaDNhZzIrYUk1WHExYkQuM3BwU2lCa1hiMnE5Slltai96UllMcUZWb1VBdDN4alkuM0Z6K29OcFZVaXRPN01xeDA3S1M2Z3YxbnFHc2NnV0JtUDg4ektmTUxndXlsOFVlR3I5MGM2bTI0WkdSRGhOUG1tMWxXRTJMaTkwbHdhY2h3MGszcmtXS25zOCtxa01Xd2ZSL1psMSsvRUE9';
const keypair3 =
    'vK1.Tn40JxRUdKePQWdeQ9H+wTIyDRqvgC07W4xXP9ppKQc=.djEuUUErTFcxaEpSaitvVDhJV0VvUnFiYUlkTTk5MVdQMGMucUxveUNKdjZ5aDRjY0kwd3NiK1FRUStTbFZUL1Y5ZngudkdNS2l2WXhHMXNvVGVvdWpvQm0vbUhkeXVrR0ppK0F6MzlQNXM0eXJQNW83NDQrQ1hXMGVid2tPSjNwaTBwd1dYVjJTYlhDb2hqczBJWndaRTU1RWxQZzI3akVvUVRBZGh6QzJpajVnTHM9';

describe('AuxCausalTree2', () => {
    describe('addAuxAtom()', () => {
        it('should return the state update', () => {
            const tree = auxTree('a');

            const result = addAuxAtom(tree, null, bot('test'));

            expect(result.update).toEqual({
                test: createBot('test'),
            });
        });

        it('should handle issue where the atom is not overwriting a previous value', () => {
            const tree = auxTree('a');

            const site1 = 'e4fc0a5b-1b58-46f9-ae3b-67769153903f';
            const root = atom(atomId(site1, 1989, null), null, {
                type: 1,
                id: '98b4f896-413d-4875-9ddc-dd394f16c034',
            });
            expect(root.hash).toEqual(
                'ccd9cea8f83001344e4be0202ad1116bbde20976c8b9dfa8953b1c9713860626'
            );

            const result1 = tree.weave.insert(root);
            expect(result1).toEqual({
                type: 'atom_added',
                atom: root,
            });
            const update1 = reducer(tree.weave, result1, {});
            expect(update1).toEqual({
                '98b4f896-413d-4875-9ddc-dd394f16c034': createBot(
                    '98b4f896-413d-4875-9ddc-dd394f16c034'
                ),
            });

            const auxColor = atom(atomId(site1, 1996, null), root, {
                type: 2,
                name: 'auxColor',
            });
            expect(auxColor.hash).toEqual(
                '5f02d0e3e44f1b4766eb5b31741c655edd025215d691f6b722e707e52eb19cee'
            );

            const result2 = tree.weave.insert(auxColor);
            expect(result2).toEqual({
                type: 'atom_added',
                atom: auxColor,
            });
            const update2 = reducer(tree.weave, result2, {});
            expect(update2).toEqual({});

            const site2 = '6999e06b-7a56-4ea8-9e94-b9b104ee9360';
            const first = atom(atomId(site2, 2091), auxColor, {
                type: 3,
                value: '#89ead4',
            });

            expect(first.hash).toEqual(
                '2cc72a94414a0f18419be38cf3e04f581d376afdb0c34e83bfcd104094ba3eed'
            );
            const result3 = tree.weave.insert(first);
            expect(result3).toEqual({
                type: 'atom_added',
                atom: first,
            });
            const update3 = reducer(tree.weave, result3, {});
            expect(update3).toEqual({
                '98b4f896-413d-4875-9ddc-dd394f16c034': {
                    tags: {
                        auxColor: '#89ead4',
                    },
                },
            });

            const site3 = '63b35cc1-b05e-4cbe-a25a-3e0262a36f6a';
            const second = atom(atomId(site3, 3431), auxColor, {
                type: 3,
                value: '#89e',
            });
            expect(second.hash).toEqual(
                '93955f3f854f4b0a9c315a7eda40afd2c0427fa342508a0eddedcfe4ec5fa583'
            );
            const result4 = tree.weave.insert(second);
            expect(result4).toEqual({
                type: 'atom_added',
                atom: second,
            });
            const update4 = reducer(tree.weave, result4, {});
            expect(update4).toEqual({
                '98b4f896-413d-4875-9ddc-dd394f16c034': {
                    tags: {
                        auxColor: '#89e',
                    },
                    signatures: {
                        [tagValueHash(
                            '98b4f896-413d-4875-9ddc-dd394f16c034',
                            'auxColor',
                            '#89ead4'
                        )]: null,
                    },
                },
            });

            expect(tree.weave.getAtoms()).toEqual([
                root,
                auxColor,
                second,
                first,
            ]);
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
        let actions: Action[];

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

            it('should use the given space', () => {
                ({ tree, updates } = applyEvents(
                    tree,
                    [
                        botAdded(
                            createBot('test', {
                                abc: 'def',
                            })
                        ),
                    ],
                    'test'
                ));

                expect(tree.state).toEqual({
                    test: createBot(
                        'test',
                        {
                            abc: 'def',
                        },
                        <any>'test'
                    ),
                });
                expect(updates).toEqual({
                    addedBots: [
                        createBot(
                            'test',
                            {
                                abc: 'def',
                            },
                            <any>'test'
                        ),
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

            it('should remove all bots with the given ID', () => {
                const bot1A = atom(atomId('b', 100), null, bot('test2'));
                const tag1A = atom(atomId('b', 101), bot1A, tag('tag1'));
                const val1A = atom(atomId('b', 102), tag1A, value('val1A'));
                const del1A = atom(atomId('b', 103), bot1A, del());

                const bot1B = atom(atomId('b', 110), null, bot('test2'));
                const tag1B = atom(atomId('b', 111), bot1B, tag('tag1'));
                const val1B = atom(atomId('b', 112), tag1B, value('val1B'));

                ({ tree } = applyAtoms(tree, [
                    bot1A,
                    tag1A,
                    val1A,
                    bot1B,
                    tag1B,
                    val1B,
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        tag1: 'val1B',
                    }),
                });

                ({ tree, updates } = applyEvents(tree, [botRemoved('test2')]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
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

            it('should handle weird trees that have multiple tags with the same value', () => {
                const test2 = atom(atomId('b', 100), null, bot('test2'));
                const tag1 = atom(atomId('b', 101), test2, tag('tag1'));
                const val1 = atom(atomId('b', 102), tag1, value('val1'));

                const dupTag1 = atom(atomId('b', 103), test2, tag('tag1'));
                const val2 = atom(atomId('b', 104), dupTag1, value('val2'));

                ({ tree } = applyAtoms(tree, [
                    test2,
                    tag1,
                    val1,
                    dupTag1,
                    val2,
                ]));

                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test2', {
                        tags: {
                            tag1: 'new',
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        tag1: 'new',
                    }),
                });
            });

            it('should handle weird trees that have duplicate bots but the first bot is deleted', () => {
                const bot1A = atom(atomId('b', 100), null, bot('test2'));
                const tag1A = atom(atomId('b', 101), bot1A, tag('tag1'));
                const val1A = atom(atomId('b', 102), tag1A, value('val1A'));
                const del1A = atom(atomId('b', 103), bot1A, del());

                const bot1B = atom(atomId('b', 110), null, bot('test2'));
                const tag1B = atom(atomId('b', 111), bot1B, tag('tag1'));
                const val1B = atom(atomId('b', 112), tag1B, value('val1B'));

                ({ tree } = applyAtoms(tree, [
                    bot1A,
                    tag1A,
                    val1A,
                    del1A,
                    bot1B,
                    tag1B,
                    val1B,
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        tag1: 'val1B',
                    }),
                });

                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test2', {
                        tags: {
                            tag1: 'new',
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        tag1: 'new',
                    }),
                });
            });

            it('should handle weird trees that have duplicate bots but the second bot is deleted', () => {
                const bot1A = atom(atomId('b', 100), null, bot('test2'));
                const tag1A = atom(atomId('b', 101), bot1A, tag('tag1'));
                const val1A = atom(atomId('b', 102), tag1A, value('val1A'));

                const bot1B = atom(atomId('b', 110), null, bot('test2'));
                const tag1B = atom(atomId('b', 111), bot1B, tag('tag1'));
                const val1B = atom(atomId('b', 112), tag1B, value('val1B'));
                const del1B = atom(atomId('b', 113), bot1B, del());

                ({ tree } = applyAtoms(tree, [
                    bot1A,
                    tag1A,
                    val1A,
                    bot1B,
                    tag1B,
                    val1B,
                    del1B,
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        tag1: 'val1A',
                    }),
                });

                ({ tree, updates } = applyEvents(tree, [
                    botUpdated('test2', {
                        tags: {
                            tag1: 'new',
                        },
                    }),
                ]));

                expect(tree.state).toEqual({
                    test: createBot('test', {
                        abc: 'def',
                    }),
                    test2: createBot('test2', {
                        tag1: 'new',
                    }),
                });
            });
        });

        describe('certificates', () => {
            describe('create_certificate', () => {
                beforeEach(() => {
                    ({ tree } = applyEvents(tree, [
                        botAdded(
                            createBot('test', {
                                abc: 'def',
                            })
                        ),
                    ]));
                });

                it('should create a certificate bot with the given keypair', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair1,
                                signingPassword: 'password',
                            },
                            'task1'
                        ),
                    ]));

                    expect(updates.addedBots).toEqual([
                        createBot(
                            expect.any(String),
                            {
                                keypair: keypair1,
                                signature: expect.any(String),
                                signingCertificate: expect.any(String),
                                atom: expect.any(Object),
                            },
                            CERTIFIED_SPACE
                        ),
                    ]);
                    expect(actions).toEqual([
                        asyncResult('task1', updates.addedBots[0], true),
                    ]);
                });

                it('should error when trying to create a second root certificate', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair1,
                                signingPassword: 'password',
                            },
                            'task1'
                        ),
                    ]));

                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair2,
                                signingPassword: 'password',
                            },
                            'task2'
                        ),
                    ]));

                    expect(updates.addedBots).toEqual([]);
                    expect(actions).toEqual([
                        asyncError(
                            'task2',
                            new Error('Unable to create certificate.')
                        ),
                    ]);
                });

                it('should create a certificate bot signed by the root cert', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair1,
                                signingPassword: 'password',
                            },
                            'task1'
                        ),
                    ]));

                    let rootCert = updates.addedBots[0];

                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair2,
                                signingBotId: rootCert.id,
                                signingPassword: 'password',
                            },
                            'task2'
                        ),
                    ]));

                    expect(updates.addedBots).toEqual([
                        createBot(
                            expect.any(String),
                            {
                                keypair: keypair2,
                                signature: expect.any(String),
                                signingCertificate: rootCert.id,
                                atom: expect.any(Object),
                            },
                            CERTIFIED_SPACE
                        ),
                    ]);
                    expect(actions).toEqual([
                        asyncResult('task2', updates.addedBots[0], true),
                    ]);
                });

                it('should error if given the wrong password', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair1,
                                signingPassword: 'password',
                            },
                            'task1'
                        ),
                    ]));

                    let rootCert = updates.addedBots[0];

                    ({ tree, updates, actions } = applyEvents(tree, [
                        createCertificate(
                            {
                                keypair: keypair2,
                                signingBotId: rootCert.id,
                                signingPassword: 'wrong',
                            },
                            'task2'
                        ),
                    ]));

                    expect(updates.addedBots).toEqual([]);
                    expect(actions).toEqual([
                        asyncError(
                            'task2',
                            new Error('Unable to create certificate.')
                        ),
                    ]);
                });
            });

            describe('sign_tag', () => {
                let c1: Atom<CertificateOp>;
                beforeAll(() => {
                    const cert = signedCert(null, 'password', keypair1);
                    c1 = atom(atomId('a', 0), null, cert);
                });

                beforeEach(() => {
                    ({ tree } = applyAtoms(tree, [c1]));
                    ({ tree } = applyEvents(tree, [
                        botAdded(
                            createBot('test', {
                                abc: {
                                    some: 'object',
                                },
                            })
                        ),
                    ]));
                });

                it('should create a signature for the given tag and value', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        signTag(
                            certificateId(c1),
                            'password',
                            'test',
                            'abc',
                            tree.state['test'].tags.abc,
                            'task1'
                        ),
                    ]));

                    expect(updates.updatedBots).toEqual([
                        {
                            bot: {
                                id: 'test',
                                tags: {
                                    abc: {
                                        some: 'object',
                                    },
                                },
                                signatures: {
                                    [tagValueHash('test', 'abc', {
                                        some: 'object',
                                    })]: 'abc',
                                },
                            },
                            tags: new Set(),
                            signatures: new Set([
                                tagValueHash('test', 'abc', {
                                    some: 'object',
                                }),
                            ]),
                        },
                    ]);
                    expect(actions).toEqual([asyncResult('task1', undefined)]);
                });

                it('should reject if the password for the certificate is wrong', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        signTag(
                            certificateId(c1),
                            'wrong',
                            'test',
                            'abc',
                            tree.state['test'].tags.abc,
                            'task1'
                        ),
                    ]));

                    expect(updates.updatedBots).toEqual([]);
                    expect(actions).toEqual([
                        asyncError(
                            'task1',
                            new Error('Unable to create signature.')
                        ),
                    ]);
                });

                it('should set the signature of a value to null if the value is changed', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        signTag(
                            certificateId(c1),
                            'password',
                            'test',
                            'abc',
                            tree.state['test'].tags.abc,
                            'task1'
                        ),
                    ]));

                    ({ tree, updates } = applyEvents(tree, [
                        botUpdated('test', {
                            tags: {
                                abc: 'def',
                            },
                        }),
                    ]));

                    expect(updates).toEqual({
                        addedBots: [],
                        removedBots: [],
                        updatedBots: [
                            {
                                bot: createBot('test', {
                                    abc: 'def',
                                }),
                                tags: new Set(['abc']),
                                signatures: new Set([
                                    tagValueHash('test', 'abc', {
                                        some: 'object',
                                    }),
                                ]),
                            },
                        ],
                    });
                });
            });

            describe('revoke_certificate', () => {
                let c1: Atom<CertificateOp>;
                beforeAll(() => {
                    const cert = signedCert(null, 'password', keypair1);
                    c1 = atom(atomId('a', 0), null, cert);
                });

                beforeEach(() => {
                    ({ tree } = applyAtoms(tree, [c1]));
                    ({ tree } = applyEvents(tree, [
                        botAdded(
                            createBot('test', {
                                abc: {
                                    some: 'object',
                                },
                            })
                        ),
                    ]));
                });

                it('should delete the certificate bot', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        revokeCertificate(
                            certificateId(c1),
                            'password',
                            certificateId(c1),
                            'task1'
                        ),
                    ]));

                    expect(updates.removedBots).toEqual([certificateId(c1)]);
                    expect(actions).toEqual([asyncResult('task1', undefined)]);
                });

                it('should reject if the password for the certificate is wrong', () => {
                    ({ tree, updates, actions } = applyEvents(tree, [
                        revokeCertificate(
                            certificateId(c1),
                            'wrong',
                            certificateId(c1),
                            'task1'
                        ),
                    ]));

                    expect(actions).toEqual([
                        asyncError(
                            'task1',
                            new Error('Unable to revoke certificate.')
                        ),
                    ]);
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

        it('should accept a space parameter for the space that the bots should have', () => {
            const bot1 = atom(atomId('a', 1), null, bot('bot1'));
            const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
            const value1 = atom(atomId('a', 3), tag1, value('abc'));

            ({ tree, updates, results } = applyAtoms(
                tree,
                [bot1, tag1, value1],
                undefined,
                'test'
            ));

            expect(tree).toEqual({
                site: {
                    id: 'a',
                    time: 3,
                },
                weave: expect.anything(),
                state: {
                    bot1: createBot(
                        'bot1',
                        {
                            tag1: 'abc',
                        },
                        <any>'test'
                    ),
                },
            });
            expect(updates).toEqual({
                addedBots: [
                    createBot(
                        'bot1',
                        {
                            tag1: 'abc',
                        },
                        <any>'test'
                    ),
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

        it('should preserve the state on an updated bot', () => {
            const bot1 = atom(atomId('a', 1), null, bot('bot1'));
            const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
            const value1 = atom(atomId('a', 3), tag1, value('abc'));

            ({ tree, updates, results } = applyAtoms(
                tree,
                [bot1, tag1, value1],
                undefined,
                'test'
            ));

            const value2 = atom(atomId('a', 4), tag1, value('def'));

            ({ tree, updates, results } = applyAtoms(
                tree,
                [value2],
                undefined,
                'test'
            ));

            expect(tree).toEqual({
                site: {
                    id: 'a',
                    time: 4,
                },
                weave: expect.anything(),
                state: {
                    bot1: createBot(
                        'bot1',
                        {
                            tag1: 'def',
                        },
                        <any>'test'
                    ),
                },
            });
            expect(updates).toEqual({
                addedBots: [],
                updatedBots: [
                    {
                        bot: createBot(
                            'bot1',
                            {
                                tag1: 'def',
                            },
                            <any>'test'
                        ),
                        tags: new Set(['tag1']),
                    },
                ],
                removedBots: [],
            });
            expect(results).toEqual([
                {
                    type: 'atom_added',
                    atom: value2,
                },
            ]);
        });
    });
});
