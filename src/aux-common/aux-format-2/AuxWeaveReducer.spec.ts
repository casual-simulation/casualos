import {
    AuxOp,
    bot,
    tag,
    value,
    deleteOp,
    AuxOpType,
    CertificateOp,
    signedCert,
    RevocationOp,
    signedRevocation,
    SignatureOp,
    signedValue,
    tagValueHash,
    ValueOp,
    TagOp,
    BotOp,
    tagMask,
    insertOp,
} from './AuxOpTypes';
import {
    Atom,
    atom,
    atomId,
    Weave,
} from '@casual-simulation/causal-trees/core2';
import reduce, { CERT_ID_NAMESPACE, CERTIFIED_SPACE } from './AuxWeaveReducer';
import { BotsState, PartialBotsState } from '../bots/Bot';
import { apply, del, edit, edits, insert, preserve } from './AuxStateHelpers';
import { isBot } from '../bots';
import uuidv5 from 'uuid/v5';
import { merge } from 'lodash';
import { getHash } from '@casual-simulation/crypto';
import reducer from './AuxWeaveReducer';

const keypair1 =
    'vK1.X9EJQT0znVqXj7D0kRyLSF1+F5u2bT7xKunF/H/SUxU=.djEueE1FL0VkOU1VanNaZGEwUDZ3cnlicjF5bnExZFptVzcubkxrNjV4ckdOTlM3Si9STGQzbGUvbUUzUXVEdmlCMWQucWZocVJQT21KeEhMbXVUWThORGwvU0M0dGdOdUVmaDFlcFdzMndYUllHWWxRZWpJRWthb1dJNnVZdXdNMFJVUTFWamkyc3JwMUpFTWJobk5sZ2Y2d01WTzRyTktDaHpwcUZGbFFnTUg0ZVU9';
const keypair2 =
    'vK1.H6/kRocyRcAAjQzjjSLi5/toJiis9Sj1NYuoYIYPQdE=.djEubjVrRzV1SmIycjFaUmszTHNxaDNhZzIrYUk1WHExYkQuM3BwU2lCa1hiMnE5Slltai96UllMcUZWb1VBdDN4alkuM0Z6K29OcFZVaXRPN01xeDA3S1M2Z3YxbnFHc2NnV0JtUDg4ektmTUxndXlsOFVlR3I5MGM2bTI0WkdSRGhOUG1tMWxXRTJMaTkwbHdhY2h3MGszcmtXS25zOCtxa01Xd2ZSL1psMSsvRUE9';
const keypair3 =
    'vK1.Tn40JxRUdKePQWdeQ9H+wTIyDRqvgC07W4xXP9ppKQc=.djEuUUErTFcxaEpSaitvVDhJV0VvUnFiYUlkTTk5MVdQMGMucUxveUNKdjZ5aDRjY0kwd3NiK1FRUStTbFZUL1Y5ZngudkdNS2l2WXhHMXNvVGVvdWpvQm0vbUhkeXVrR0ppK0F6MzlQNXM0eXJQNW83NDQrQ1hXMGVid2tPSjNwaTBwd1dYVjJTYlhDb2hqczBJWndaRTU1RWxQZzI3akVvUVRBZGh6QzJpajVnTHM9';

describe('AuxWeaveReducer', () => {
    let weave: Weave<AuxOp>;
    let state: BotsState;
    let space: string;

    beforeEach(() => {
        weave = new Weave();
        state = {};
        space = undefined;
    });

    function add(...atoms: Atom<AuxOp>[]): BotsState {
        for (let atom of atoms) {
            let update = reduce(weave, weave.insert(atom), undefined, space);
            state = apply(state, update);
        }
        return state;
    }

    function remove(...atoms: Atom<AuxOp>[]): BotsState {
        for (let atom of atoms) {
            let update = reduce(weave, weave.remove(atom));
            state = apply(state, update);
        }
        return state;
    }

    describe('atom_added', () => {
        describe('bot', () => {
            it('should calculate the File ID from the Atom ID', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                state = add(bot1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should do nothing for bot atoms with a non-null cause', () => {
                const b1 = atom(atomId('b', 1), null, bot('test1'));
                const bot1 = atom(atomId('a', 2), b1, bot('test2'));

                state = add(b1, bot1);
                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {},
                    },
                });
            });

            it('should preserve the existing bot if a duplicate is added', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const bot1B = atom(atomId('a', 4), null, bot('test1'));
                const tag1B = atom(atomId('a', 5), bot1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            abc: 'def',
                            num: 1,
                        },
                    },
                });
            });

            it('should gracefully handle duplicate bots with duplicate tags', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const bot1B = atom(atomId('a', 4), null, bot('test1'));
                const tag1B = atom(atomId('a', 5), bot1B, tag('abc'));
                const value1B = atom(atomId('a', 6), tag1B, value('different'));

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            abc: 'different',
                        },
                    },
                });
            });

            it('should gracefully handle duplicate bots when the first bot is deleted', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));
                const del1A = atom(atomId('a', 4), bot1A, deleteOp());

                const bot1B = atom(atomId('a', 5), null, bot('test1'));
                const tag1B = atom(atomId('a', 6), bot1B, tag('abc'));
                const value1B = atom(atomId('a', 7), tag1B, value('different'));

                state = add(bot1A, tag1A, value1A, del1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            abc: 'different',
                        },
                    },
                });
            });
        });

        describe('delete', () => {
            it('should remove the bot from the state', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const delete1 = atom(atomId('a', 2), bot1, deleteOp());
                state = add(bot1, delete1);

                expect(state).toEqual({});
            });

            it('should ignore deletes whose cause is null', () => {
                const delete1 = atom(atomId('a', 2), null, deleteOp());
                state = add(delete1);

                expect(state).toEqual({});
            });

            it('should ignore deletes that are not the first child of the bot', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const delete1 = atom(atomId('a', 2), bot1, deleteOp());
                const tag1 = atom(atomId('a', 3), bot1, tag('test'));
                state = add(bot1, tag1, delete1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should not touch other bots', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test1'));
                const bot2 = atom(atomId('a', 2), null, bot('test2'));
                const delete1 = atom(atomId('a', 3), bot1, deleteOp());

                state = add(bot1, bot2, delete1);

                expect(state).toEqual({
                    ['test2']: {
                        id: 'test2',
                        tags: {},
                    },
                });
            });

            it('should only delete a bot if a bot atom is deleted', () => {
                const bot1A = atom(atomId('b', 100), null, bot('test2'));
                const tag1A = atom(atomId('b', 101), bot1A, tag('tag1'));
                const val1A = atom(atomId('b', 102), tag1A, value('val1A'));

                const bot1B = atom(atomId('b', 110), null, bot('test2'));
                const tag1B = atom(atomId('b', 111), bot1B, tag('tag1'));
                const val1B = atom(atomId('b', 112), tag1B, value('val1B'));
                const del1B = atom(atomId('b', 113), bot1B, deleteOp());

                state = add(bot1A, tag1A, val1A);
                state = add(bot1B, tag1B, val1B);

                expect(state).toEqual({
                    ['test2']: {
                        id: 'test2',
                        tags: {
                            tag1: 'val1B',
                        },
                    },
                });

                state = add(del1B);

                expect(state).toEqual({});
            });

            // TODO: Add support for deleting spans of text from values/inserts.
            it.skip('should remove the span of text from the tag value', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag'));
                const value1 = atom(atomId('a', 3), tag1, value('abcdef'));
                const delete1 = atom(atomId('a', 2), value1, deleteOp(0, 2));
                state = add(bot1, tag1, value1, delete1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            tag: 'def',
                        },
                    },
                });
            });
        });

        describe('tag', () => {
            it('should do nothing', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));

                state = add(bot1, tag1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });
        });

        describe('value', () => {
            let deleteValueCases = [
                ['null', null],
                ['undefined', undefined],
                ['empty string', ''],
            ];

            let preserveValueCases = [
                ['0', 0],
                ['false', false],
                ['whitespace', ' '],
            ];

            let invalidTagNameCases = [
                ['empty', ''],
                ['null', null],
                ['undefined', undefined],
            ];

            describe('tag', () => {
                it('should set the tag value', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));

                    state = add(bot1, tag1, value1);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'def',
                            },
                        },
                    });
                });

                it('should preserve values with timestamps after the new atom', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value('haha'));

                    state = add(bot1, tag1, value2, value1);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'haha',
                            },
                        },
                    });
                });

                it('should use last write wins for new tag values', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value('haha'));

                    state = add(bot1, tag1, value1, value2);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'haha',
                            },
                        },
                    });
                });

                it.each(deleteValueCases)(
                    'should delete tags with %s values',
                    (desc, val) => {
                        const bot1 = atom(atomId('a', 1), null, bot('test'));
                        const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                        const value1 = atom(atomId('a', 3), tag1, value('def'));
                        const value2 = atom(atomId('a', 4), tag1, value(val));

                        state = add(bot1, tag1, value1, value2);

                        expect(state).toEqual({
                            ['test']: {
                                id: 'test',
                                tags: {},
                            },
                        });
                    }
                );

                it.each(preserveValueCases)(
                    'should preserve tags with %s values',
                    (desc, val) => {
                        const bot1 = atom(atomId('a', 1), null, bot('test'));
                        const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                        const value1 = atom(atomId('a', 3), tag1, value('def'));
                        const value2 = atom(atomId('a', 4), tag1, value(val));

                        state = add(bot1, tag1, value1, value2);

                        expect(state).toEqual({
                            ['test']: {
                                id: 'test',
                                tags: {
                                    abc: val,
                                },
                            },
                        });
                    }
                );

                it.each(invalidTagNameCases)(
                    'should ignore tags with %s names',
                    (desc, name) => {
                        const bot1 = atom(atomId('a', 1), null, bot('test'));
                        const tag1 = atom(atomId('a', 2), bot1, tag(name));
                        const value1 = atom(
                            atomId('a', 3),
                            tag1,
                            value('haha')
                        );

                        state = add(bot1, tag1, value1);

                        expect(state).toEqual({
                            ['test']: {
                                id: 'test',
                                tags: {},
                            },
                        });
                    }
                );

                it('should preserve other tag values when deleting a tag', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 6), tag1, value(null));

                    const otherTag1 = atom(atomId('a', 4), bot1, tag('test'));
                    const otherValue1 = atom(
                        atomId('a', 5),
                        otherTag1,
                        value(true)
                    );

                    state = add(
                        bot1,
                        tag1,
                        value1,
                        otherTag1,
                        otherValue1,
                        value2
                    );

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                test: true,
                            },
                        },
                    });
                });

                it('should ignore values whose direct cause is nonexistent', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const value1 = atom(atomId('a', 3), bot1, value('haha'));

                    state = add(bot1, value1);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {},
                        },
                    });
                });

                it('should ignore values whose grandparent cause is nonexistent', () => {
                    const tag1 = atom(atomId('a', 1), null, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('haha'));

                    state = add(tag1, value1);

                    expect(state).toEqual({});
                });

                it('should ignore values whose cause is not a tag', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test1'));
                    const tag1 = atom(atomId('a', 2), bot1, bot('test2'));
                    const value1 = atom(atomId('a', 3), tag1, value('haha'));

                    state = add(bot1, tag1, value1);

                    expect(state).toEqual({
                        ['test1']: {
                            id: 'test1',
                            tags: {},
                        },
                    });
                });

                it('should ignore values whose grandcause is not a bot', () => {
                    const bot1 = atom(atomId('a', 1), null, tag('test1'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('test2'));
                    const value1 = atom(atomId('a', 3), tag1, value('haha'));

                    state = add(bot1, tag1, value1);

                    expect(state).toEqual({});
                });

                it('should ignore values when the bot is deleted', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('bot'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('test'));
                    const delete1 = atom(atomId('a', 3), bot1, deleteOp());
                    const value1 = atom(atomId('a', 4), tag1, value('haha'));

                    state = add(bot1, tag1, delete1, value1);

                    expect(state).toEqual({});
                });
            });

            describe('TagMask', () => {
                beforeEach(() => {
                    space = 'space';
                });

                it('should set the mask value', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));

                    state = add(tag1, value1);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'def',
                                },
                            },
                        },
                    });
                });

                it('should preserve values with timestamps after the new atom', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value('haha'));

                    state = add(tag1, value2, value1);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'haha',
                                },
                            },
                        },
                    });
                });

                it('should use last write wins for new tag values', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value('haha'));

                    state = add(tag1, value1, value2);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'haha',
                                },
                            },
                        },
                    });
                });

                it.each(deleteValueCases)(
                    'should delete tags with %s values',
                    (desc, val) => {
                        const tag1 = atom(
                            atomId('a', 2),
                            null,
                            tagMask('test', 'abc')
                        );
                        const value1 = atom(atomId('a', 3), tag1, value('def'));
                        const value2 = atom(atomId('a', 4), tag1, value(val));

                        state = add(tag1, value1, value2);

                        expect(state).toEqual({
                            ['test']: {},
                        });
                    }
                );

                it.each(preserveValueCases)(
                    'should preserve tags with %s values',
                    (desc, val) => {
                        const tag1 = atom(
                            atomId('a', 2),
                            null,
                            tagMask('test', 'abc')
                        );
                        const value1 = atom(atomId('a', 3), tag1, value('def'));
                        const value2 = atom(atomId('a', 4), tag1, value(val));

                        state = add(tag1, value1, value2);

                        expect(state).toEqual({
                            ['test']: {
                                masks: {
                                    [space]: {
                                        abc: val,
                                    },
                                },
                            },
                        });
                    }
                );

                it.each(invalidTagNameCases)(
                    'should ignore tags with %s names',
                    (desc, name) => {
                        const tag1 = atom(
                            atomId('a', 2),
                            null,
                            tagMask('test', name)
                        );
                        const value1 = atom(
                            atomId('a', 3),
                            tag1,
                            value('haha')
                        );

                        state = add(tag1, value1);

                        expect(state).toEqual({});
                    }
                );

                it('should preserve other tag values when deleting a tag', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 6), tag1, value(null));

                    const otherTag1 = atom(
                        atomId('a', 4),
                        null,
                        tagMask('test', 'test')
                    );
                    const otherValue1 = atom(
                        atomId('a', 5),
                        otherTag1,
                        value(true)
                    );

                    state = add(tag1, value1, otherTag1, otherValue1, value2);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    test: true,
                                },
                            },
                        },
                    });
                });

                it('should ignore values whose direct cause is nonexistent', () => {
                    const value1 = atom(atomId('a', 3), null, value('haha'));

                    state = add(value1);

                    expect(state).toEqual({});
                });

                it('should ignore values whose cause is not a tag mask', () => {
                    const tag1 = atom(atomId('a', 2), null, tag('test2'));
                    const value1 = atom(atomId('a', 3), tag1, value('haha'));

                    state = add(tag1, value1);

                    expect(state).toEqual({});
                });
            });
        });

        describe('certificate', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c1);
                r1 = atom(atomId('a', 4), c1, revoke1);
            });

            it('should add a bot for the self signed certificate', () => {
                state = add(c1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                });
            });

            it('should add a bot for the certificates', () => {
                state = add(c1, c2, c3);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    [uuidv5(c2.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c2.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair2,
                            signature: c2.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c2,
                        },
                    },
                    [uuidv5(c3.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c3.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair3,
                            signature: c3.value.signature,
                            signingCertificate: uuidv5(
                                c2.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c3,
                        },
                    },
                });
            });

            it('should not add a bot for the certificate if the signature is invalid', () => {
                const c3Copy = merge({}, c3, {
                    value: {
                        signature: 'wrong',
                    },
                });
                state = add(c1, c2, c3Copy);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    [uuidv5(c2.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c2.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair2,
                            signature: c2.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c2,
                        },
                    },
                });
            });

            it('should not add a bot for the certificate if the parent certificate is revoked', () => {
                state = add(c1, r1, c2);

                expect(state).toEqual({});
            });

            it('should not add a bot for the certificate if the grandparent certificate is revoked', () => {
                state = add(c1, c2, r1, c3);

                expect(state).toEqual({});
            });
        });

        describe('revocation', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            let r2: Atom<RevocationOp>;
            let r3: Atom<RevocationOp>;
            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c1);
                r1 = atom(atomId('a', 4), c1, revoke1);
            });

            it('should remove the certificate bot from the state', () => {
                state = add(c1, r1);

                expect(state).toEqual({});
            });

            it('should remove all child certificate bots from the state', () => {
                state = add(c1, c2, c3, r1);

                expect(state).toEqual({});
            });

            it('should remove the signature from the state', () => {
                let bot1 = atom(atomId('b', 1), null, bot('test'));
                let tag1 = atom(atomId('b', 2), bot1, tag('abc'));
                let value1 = atom(atomId('b', 3), tag1, value('def'));
                const signature1 = signedValue(c1, 'password', value1);
                const s1 = atom(atomId('a', 6), c1, signature1);
                const revoke2 = signedRevocation(c1, 'password', s1);
                const r2 = atom(atomId('a', 7), s1, revoke2);

                weave.insert(c1);
                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);
                weave.insert(s1);
                const result = reducer(weave, weave.insert(r2));

                expect(result).toEqual({
                    ['test']: {
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: null,
                        },
                    },
                });
            });
        });

        describe('signature', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            let s1: Atom<SignatureOp>;

            let bot1: Atom<BotOp>;
            let tag1: Atom<TagOp>;
            let value1: Atom<ValueOp>;
            let value2: Atom<ValueOp>;
            let value3: Atom<ValueOp>;

            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c1);
                r1 = atom(atomId('a', 4), c1, revoke1);

                bot1 = atom(atomId('b', 1), null, bot('test'));
                tag1 = atom(atomId('b', 2), bot1, tag('abc'));
                value1 = atom(atomId('b', 3), tag1, value('def'));
                value2 = atom(atomId('b', 4), tag1, value('def'));
                value3 = atom(atomId('b', 5), tag1, value('different'));

                const signature1 = signedValue(c1, 'password', value1);
                s1 = atom(atomId('a', 6), c1, signature1);
            });

            it('should add a signature value for the tag', () => {
                state = add(c1, bot1, tag1, value1, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: 'abc',
                        },
                    },
                });
            });

            it('should not add a signature value for the tag if the certificate is revoked', () => {
                state = add(c1, bot1, tag1, value1, r1, s1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should not add a signature value for the tag if the value atom does not exist', () => {
                state = add(c1, bot1, tag1, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should remove the signatures when revoking a certificate', () => {
                state = add(c1, bot1, tag1, value1, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: 'abc',
                        },
                    },
                });

                state = add(r1);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should not add a signature value for the tag if the bot is destroyed', () => {
                const del1 = atom(atomId('b', 4), bot1, deleteOp());

                state = add(c1, bot1, tag1, value1, del1, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                });
            });

            it('should remove the signature if a new value atom with the same actual value is added', () => {
                state = add(c1, bot1, tag1, value1, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: 'abc',
                        },
                    },
                });

                state = add(value2);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should remove the previous value signature if a new value atom is added', () => {
                state = add(c1, bot1, tag1, value1, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: 'abc',
                        },
                    },
                });

                state = add(value3);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'different',
                        },
                    },
                });
            });

            it('should not set the signature to null if there was no signature for the value', () => {
                state = add(c1, bot1, tag1, value1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });

                let update = reduce(
                    weave,
                    weave.insert(value3),
                    undefined,
                    space
                );
                expect(update).toEqual({
                    test: {
                        tags: {
                            abc: 'different',
                        },
                    },
                });
            });
        });

        describe('TagMask', () => {
            it('should do nothing', () => {
                const tag1 = atom(atomId('a', 2), null, tagMask('bot1', 'abc'));

                state = add(tag1);

                expect(state).toEqual({});
            });
        });

        describe('edits', () => {
            describe('tag', () => {
                it('should insert the given text into the tag value', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, 'ghi')
                    );

                    state = add(bot1, tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 4 }, preserve(1), insert('ghi')),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'dghief',
                            },
                        },
                    });
                });

                it('should correctly handle inserts on inserts', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        insert1,
                        insertOp(1, '222')
                    );

                    state = add(bot1, tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 5 }, preserve(2), insert('222')),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd122211ef',
                            },
                        },
                    });
                });

                it('should handle inserts next to inserts', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(bot1, tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd222111ef',
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 5 }, preserve(1), insert('222')),
                            },
                        },
                    });
                });

                it('should handle sibling inserts added to the weave in reverse order', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(bot1, tag1, value1, insert2);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd222111ef',
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 4 }, preserve(4), insert('111')),
                            },
                        },
                    });
                });

                it('should handle inserts after a delete', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const insert1 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '111111')
                    );

                    state = add(bot1, tag1, value1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit(
                                    { a: 5 },
                                    preserve(1),
                                    insert('111111')
                                ),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd111111f',
                            },
                        },
                    });
                });

                it('should handle inserts inside a delete', () => {
                    const b1 = atom(atomId('a', 1), null, bot('test'));
                    const t1 = atom(atomId('a', 2), b1, tag('abc'));

                    const v1 = atom(atomId('a', 3), t1, value('111'));
                    // 111
                    const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));
                    // 11
                    const i1 = atom(atomId('a', 5), v1, insertOp(0, '222'));
                    // 22211
                    const d1 = atom(atomId('a', 6, 1), i1, deleteOp(2, 3));
                    // 2211
                    const i2 = atom(atomId('a', 7), v1, insertOp(2, '333'));
                    // 2213331 - insert is in the middle of v1 because it should apply to "111" and not "11"
                    const i3 = atom(atomId('a', 9), i1, insertOp(2, '444'));
                    // 2244413331
                    const d3 = atom(atomId('a', 10, 1), i3, deleteOp(2, 3));
                    // 224413331

                    state = add(b1, t1, v1, d0, i1, d1, i3, d3);

                    let update = reduce(
                        weave,
                        weave.insert(i2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: '224413331',
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 7 }, preserve(5), insert('333')),
                            },
                        },
                    });
                });

                it('should handle deletes on inserts', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );

                    state = add(bot1, tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 5 }, preserve(2), del(2)),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd1ef',
                            },
                        },
                    });
                });

                it('should handle deletes next to inserts', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(1, 3)
                    );

                    state = add(bot1, tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 5 }, preserve(4), del(2)),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd111',
                            },
                        },
                    });
                });

                it('should handle deletes next to deletes', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const delete2 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(2, 3)
                    );

                    state = add(bot1, tag1, value1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(delete2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 5 }, preserve(1), del(1)),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd',
                            },
                        },
                    });
                });

                it('should handle sibling deletes added to the weave in reverse order', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const delete2 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(2, 3)
                    );

                    state = add(bot1, tag1, value1, delete2);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 4 }, preserve(1), del(1)),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd',
                            },
                        },
                    });
                });

                it('should handle deleting the same text twice', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const delete2 = atom(
                        atomId('a', 6, 1),
                        insert1,
                        deleteOp(1, 3)
                    );

                    state = add(bot1, tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(delete2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({});

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd1ef',
                            },
                        },
                    });
                });

                it('should handle deleting the overlapping portions of text', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '11111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(0, 3)
                    );
                    const delete2 = atom(
                        atomId('a', 6, 1),
                        insert1,
                        deleteOp(2, 4)
                    );

                    state = add(bot1, tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(delete2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 6 }, preserve(1), del(1)),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd1ef',
                            },
                        },
                    });
                });

                it('should handle inserts midway in deletes', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        insert1,
                        insertOp(2, '22222')
                    );

                    state = add(bot1, tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit(
                                    { a: 6 },
                                    preserve(2),
                                    insert('22222')
                                ),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd122222ef',
                            },
                        },
                    });
                });

                it('should handle inserts that share an ending point with a delete', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 2)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        insert1,
                        insertOp(2, '22222')
                    );

                    state = add(bot1, tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd1222221ef',
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit(
                                    { a: 6 },
                                    preserve(2),
                                    insert('22222')
                                ),
                            },
                        },
                    });
                });

                it('should handle inserts before deletes', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        insert1,
                        insertOp(0, '222')
                    );

                    state = add(bot1, tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 6 }, preserve(1), insert('222')),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd2221ef',
                            },
                        },
                    });
                });

                it('should handle inserts when sibling inserts have deletions', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(0, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(bot1, tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: '1d222ef',
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            tags: {
                                abc: edit({ a: 6 }, preserve(2), insert('222')),
                            },
                        },
                    });
                });

                it('should handle multiple inserts in the same update', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(bot1, tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(insert2),
                        update,
                        space
                    );

                    state = apply(state, update2);

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd222111ef',
                            },
                        },
                    });

                    expect(update2).toEqual({
                        ['test']: {
                            tags: {
                                abc: edits(
                                    { a: 5 },
                                    [preserve(1), insert('111')],
                                    [preserve(1), insert('222')]
                                ),
                            },
                        },
                    });
                });

                it('should handle multiple deletes in the same update', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const delete2 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(2, 3)
                    );

                    state = add(bot1, tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(delete2),
                        update,
                        space
                    );

                    state = apply(state, update2);

                    expect(update2).toEqual({
                        ['test']: {
                            tags: {
                                abc: edits(
                                    { a: 5 },
                                    [preserve(1), del(1)],
                                    [preserve(1), del(1)]
                                ),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd',
                            },
                        },
                    });
                });

                it('should handle inserts and deletes in the same update', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const insert1 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '111')
                    );

                    state = add(bot1, tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(insert1),
                        update,
                        space
                    );

                    state = apply(state, update2);

                    expect(update2).toEqual({
                        ['test']: {
                            tags: {
                                abc: edits(
                                    { a: 5 },
                                    [preserve(1), del(1)],
                                    [preserve(1), insert('111')]
                                ),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'd111f',
                            },
                        },
                    });
                });

                it('should handle multiple overlapping inserts in the same update', () => {
                    const bot1 = atom(atomId('b', 100), null, bot('test'));
                    const tag1 = atom(atomId('b', 101), bot1, tag('tag1'));
                    const val1 = atom(atomId('b', 102), tag1, value('val1A'));

                    const insert1 = atom(
                        atomId('b', 103),
                        val1,
                        insertOp(1, '!!!')
                    );
                    // After: v!!!al1A

                    const insert2 = atom(
                        atomId('b', 104),
                        insert1,
                        insertOp(1, '@@@')
                    );
                    // After: v!@@@!!al1A

                    const insert3 = atom(
                        atomId('b', 105),
                        val1,
                        insertOp(0, '###')
                    );
                    // After: ###v!@@@!!al1A

                    state = add(bot1, tag1, val1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(insert2),
                        update,
                        space
                    );

                    let update3 = reduce(
                        weave,
                        weave.insert(insert3),
                        update,
                        space
                    );

                    state = apply(state, update3);

                    expect(update3).toEqual({
                        ['test']: {
                            tags: {
                                tag1: edits(
                                    { b: 105 },
                                    [preserve(1), insert('!!!')],
                                    [preserve(2), insert('@@@')],
                                    [insert('###')]
                                ),
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                tag1: '###v!@@@!!al1A',
                            },
                        },
                    });
                });

                it('should handle inserts in the same update as when the bot is created', () => {
                    const bot1 = atom(atomId('b', 100), null, bot('test'));
                    const tag1 = atom(atomId('b', 101), bot1, tag('tag1'));
                    const val1 = atom(atomId('b', 102), tag1, value('val1A'));

                    const insert1 = atom(
                        atomId('b', 103),
                        val1,
                        insertOp(1, '!!!')
                    );
                    // After: v!!!al1A

                    let update = {} as PartialBotsState;
                    for (let atom of [bot1, tag1, val1, insert1]) {
                        let u = reduce(
                            weave,
                            weave.insert(atom),
                            update,
                            space
                        );
                        state = apply(state, u);
                    }

                    expect(update).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                tag1: 'v!!!al1A',
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                tag1: 'v!!!al1A',
                            },
                        },
                    });
                });

                it('should handle deletes in the same update as when the bot is created', () => {
                    const bot1 = atom(atomId('a', 1), null, bot('test'));
                    const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );

                    let update = {} as PartialBotsState;
                    for (let atom of [bot1, tag1, value1, delete1]) {
                        let u = reduce(
                            weave,
                            weave.insert(atom),
                            update,
                            space
                        );
                        state = apply(state, u);
                    }

                    expect(update).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'df',
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            id: 'test',
                            tags: {
                                abc: 'df',
                            },
                        },
                    });
                });
            });

            describe('TagMask', () => {
                beforeEach(() => {
                    space = 'space';
                });

                it('should insert the given text into the tag value', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, 'ghi')
                    );

                    state = add(tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 4 },
                                        preserve(1),
                                        insert('ghi')
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'dghief',
                                },
                            },
                        },
                    });
                });

                it('should correctly handle inserts on inserts', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        insert1,
                        insertOp(1, '222')
                    );

                    state = add(tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 5 },
                                        preserve(2),
                                        insert('222')
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd122211ef',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts next to inserts', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd222111ef',
                                },
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 5 },
                                        preserve(1),
                                        insert('222')
                                    ),
                                },
                            },
                        },
                    });
                });

                it('should handle sibling inserts added to the weave in reverse order', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(tag1, value1, insert2);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd222111ef',
                                },
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 4 },
                                        preserve(4),
                                        insert('111')
                                    ),
                                },
                            },
                        },
                    });
                });

                it('should handle inserts after a delete', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const insert1 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '111111')
                    );

                    state = add(tag1, value1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 5 },
                                        preserve(1),
                                        insert('111111')
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd111111f',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts inside a delete', () => {
                    const t1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );

                    const v1 = atom(atomId('a', 3), t1, value('111'));
                    // 111
                    const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));
                    // 11
                    const i1 = atom(atomId('a', 5), v1, insertOp(0, '222'));
                    // 22211
                    const d1 = atom(atomId('a', 6, 1), i1, deleteOp(2, 3));
                    // 2211
                    const i2 = atom(atomId('a', 7), v1, insertOp(2, '333'));
                    // 2213331 - insert is in the middle of v1 because it should apply to "111" and not "11"
                    const i3 = atom(atomId('a', 9), i1, insertOp(2, '444'));
                    // 2244413331
                    const d3 = atom(atomId('a', 10, 1), i3, deleteOp(2, 3));
                    // 224413331

                    state = add(t1, v1, d0, i1, d1, i3, d3);

                    let update = reduce(
                        weave,
                        weave.insert(i2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: '224413331',
                                },
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 7 },
                                        preserve(5),
                                        insert('333')
                                    ),
                                },
                            },
                        },
                    });
                });

                it('should handle deletes on inserts', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );

                    state = add(tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit({ a: 5 }, preserve(2), del(2)),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd1ef',
                                },
                            },
                        },
                    });
                });

                it('should handle deletes next to inserts', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(1, 3)
                    );

                    state = add(tag1, value1, insert1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit({ a: 5 }, preserve(4), del(2)),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd111',
                                },
                            },
                        },
                    });
                });

                it('should handle deletes next to deletes', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const delete2 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(2, 3)
                    );

                    state = add(tag1, value1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(delete2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit({ a: 5 }, preserve(1), del(1)),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd',
                                },
                            },
                        },
                    });
                });

                it('should handle sibling deletes added to the weave in reverse order', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const delete2 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(2, 3)
                    );

                    state = add(tag1, value1, delete2);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit({ a: 4 }, preserve(1), del(1)),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd',
                                },
                            },
                        },
                    });
                });

                it('should handle deleting the same text twice', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const delete2 = atom(
                        atomId('a', 6, 1),
                        insert1,
                        deleteOp(1, 3)
                    );

                    state = add(tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(delete2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({});

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd1ef',
                                },
                            },
                        },
                    });
                });

                it('should handle deleting the overlapping portions of text', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '11111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(0, 3)
                    );
                    const delete2 = atom(
                        atomId('a', 6, 1),
                        insert1,
                        deleteOp(2, 4)
                    );

                    state = add(tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(delete2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit({ a: 6 }, preserve(1), del(1)),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd1ef',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts midway in deletes', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        insert1,
                        insertOp(2, '22222')
                    );

                    state = add(tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 6 },
                                        preserve(2),
                                        insert('22222')
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd122222ef',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts that share an ending point with a delete', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 2)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        insert1,
                        insertOp(2, '22222')
                    );

                    state = add(tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd1222221ef',
                                },
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 6 },
                                        preserve(2),
                                        insert('22222')
                                    ),
                                },
                            },
                        },
                    });
                });

                it('should handle inserts before deletes', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        insert1,
                        insertOp(0, '222')
                    );

                    state = add(tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 6 },
                                        preserve(1),
                                        insert('222')
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd2221ef',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts when sibling inserts have deletions', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(0, '111')
                    );
                    const delete1 = atom(
                        atomId('a', 5, 1),
                        insert1,
                        deleteOp(1, 3)
                    );
                    const insert2 = atom(
                        atomId('a', 6),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(tag1, value1, insert1, delete1);

                    let update = reduce(
                        weave,
                        weave.insert(insert2),
                        undefined,
                        space
                    );

                    state = apply(state, update);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: '1d222ef',
                                },
                            },
                        },
                    });

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edit(
                                        { a: 6 },
                                        preserve(2),
                                        insert('222')
                                    ),
                                },
                            },
                        },
                    });
                });

                it('should handle multiple inserts in the same update', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const insert1 = atom(
                        atomId('a', 4),
                        value1,
                        insertOp(1, '111')
                    );
                    const insert2 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '222')
                    );

                    state = add(tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(insert2),
                        update,
                        space
                    );

                    state = apply(state, update2);

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd222111ef',
                                },
                            },
                        },
                    });

                    expect(update2).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edits(
                                        { a: 5 },
                                        [preserve(1), insert('111')],
                                        [preserve(1), insert('222')]
                                    ),
                                },
                            },
                        },
                    });
                });

                it('should handle multiple deletes in the same update', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const delete2 = atom(
                        atomId('a', 5, 1),
                        value1,
                        deleteOp(2, 3)
                    );

                    state = add(tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(delete2),
                        update,
                        space
                    );

                    state = apply(state, update2);

                    expect(update2).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edits(
                                        { a: 5 },
                                        [preserve(1), del(1)],
                                        [preserve(1), del(1)]
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts and deletes in the same update', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );
                    const insert1 = atom(
                        atomId('a', 5),
                        value1,
                        insertOp(1, '111')
                    );

                    state = add(tag1, value1);

                    let update = reduce(
                        weave,
                        weave.insert(delete1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(insert1),
                        update,
                        space
                    );

                    state = apply(state, update2);

                    expect(update2).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: edits(
                                        { a: 5 },
                                        [preserve(1), del(1)],
                                        [preserve(1), insert('111')]
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'd111f',
                                },
                            },
                        },
                    });
                });

                it('should handle multiple overlapping inserts in the same update', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'tag1')
                    );
                    const val1 = atom(atomId('b', 102), tag1, value('val1A'));

                    const insert1 = atom(
                        atomId('b', 103),
                        val1,
                        insertOp(1, '!!!')
                    );
                    // After: v!!!al1A

                    const insert2 = atom(
                        atomId('b', 104),
                        insert1,
                        insertOp(1, '@@@')
                    );
                    // After: v!@@@!!al1A

                    const insert3 = atom(
                        atomId('b', 105),
                        val1,
                        insertOp(0, '###')
                    );
                    // After: ###v!@@@!!al1A

                    state = add(tag1, val1);

                    let update = reduce(
                        weave,
                        weave.insert(insert1),
                        undefined,
                        space
                    );

                    let update2 = reduce(
                        weave,
                        weave.insert(insert2),
                        update,
                        space
                    );

                    let update3 = reduce(
                        weave,
                        weave.insert(insert3),
                        update,
                        space
                    );

                    state = apply(state, update3);

                    expect(update3).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    tag1: edits(
                                        { b: 105 },
                                        [preserve(1), insert('!!!')],
                                        [preserve(2), insert('@@@')],
                                        [insert('###')]
                                    ),
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    tag1: '###v!@@@!!al1A',
                                },
                            },
                        },
                    });
                });

                it('should handle inserts in the same update as when the bot is created', () => {
                    const tag1 = atom(
                        atomId('b', 101),
                        null,
                        tagMask('test', 'tag1')
                    );
                    const val1 = atom(atomId('b', 102), tag1, value('val1A'));

                    const insert1 = atom(
                        atomId('b', 103),
                        val1,
                        insertOp(1, '!!!')
                    );
                    // After: v!!!al1A

                    let update = {} as PartialBotsState;
                    for (let atom of [tag1, val1, insert1]) {
                        let u = reduce(
                            weave,
                            weave.insert(atom),
                            update,
                            space
                        );
                        state = apply(state, u);
                    }

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    tag1: 'v!!!al1A',
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    tag1: 'v!!!al1A',
                                },
                            },
                        },
                    });
                });

                it('should handle deletes in the same update as when the bot is created', () => {
                    const tag1 = atom(
                        atomId('a', 2),
                        null,
                        tagMask('test', 'abc')
                    );
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const delete1 = atom(
                        atomId('a', 4, 1),
                        value1,
                        deleteOp(1, 2)
                    );

                    let update = {} as PartialBotsState;
                    for (let atom of [tag1, value1, delete1]) {
                        let u = reduce(
                            weave,
                            weave.insert(atom),
                            update,
                            space
                        );
                        state = apply(state, u);
                    }

                    expect(update).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'df',
                                },
                            },
                        },
                    });

                    expect(state).toEqual({
                        ['test']: {
                            masks: {
                                [space]: {
                                    abc: 'df',
                                },
                            },
                        },
                    });
                });
            });
        });
    });

    describe('atom_removed', () => {
        describe('bot', () => {
            it('should remove the bot from the state', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                weave.insert(bot1);
                const update = reduce(weave, weave.remove(bot1));

                expect(update).toEqual({
                    ['test']: null,
                });
            });
        });

        describe('value', () => {
            it('should remove the value from the state', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));

                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);

                const update = reduce(weave, weave.remove(value1));

                expect(update).toEqual({
                    ['test']: {
                        tags: {
                            abc: null,
                        },
                    },
                });
            });

            it('should use the remaining value as the new value for the tag', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('removed'));

                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);
                weave.insert(value2);

                const update = reduce(weave, weave.remove(value2));

                expect(update).toEqual({
                    ['test']: {
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should support removing multiple value atoms at a time', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const tag1 = atom(atomId('a', 2), bot1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('removed'));
                const value3 = atom(atomId('a', 5), tag1, value('removed2'));

                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);
                weave.insert(value2);
                weave.insert(value3);

                const update = reduce(
                    weave,
                    weave.removeSiblingsBefore(value3)
                );

                expect(update).toEqual({});
            });
        });

        describe('certificate', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);
            });

            it('should remove the certificate bot from the state', () => {
                weave.insert(c1);
                const update = reduce(weave, weave.remove(c1));

                expect(update).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: null,
                });
            });

            it('should remove the certificate bot and all its child certs from the state', () => {
                weave.insert(c1);
                weave.insert(c2);
                weave.insert(c3);
                const update = reduce(weave, weave.remove(c1));

                expect(update).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: null,
                    [uuidv5(c2.hash, CERT_ID_NAMESPACE)]: null,
                    [uuidv5(c3.hash, CERT_ID_NAMESPACE)]: null,
                });
            });
        });

        describe('revocation', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            let r2: Atom<RevocationOp>;
            let r3: Atom<RevocationOp>;
            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c1);
                r1 = atom(atomId('a', 4), c1, revoke1);
            });

            it('should re-add the certificate to the state', () => {
                weave.insert(c1);
                weave.insert(r1);

                const update = reduce(weave, weave.remove(r1));

                expect(update).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                });
            });
        });

        describe('signature', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            let s1: Atom<SignatureOp>;

            let bot1 = atom(atomId('b', 1), null, bot('test'));
            let tag1 = atom(atomId('b', 2), bot1, tag('abc'));
            let value1 = atom(atomId('b', 3), tag1, value('def'));

            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c1);
                r1 = atom(atomId('a', 4), c1, revoke1);

                bot1 = atom(atomId('b', 1), null, bot('test'));
                tag1 = atom(atomId('b', 2), bot1, tag('abc'));
                value1 = atom(atomId('b', 3), tag1, value('def'));

                const signature1 = signedValue(c1, 'password', value1);
                s1 = atom(atomId('a', 6), c1, signature1);
            });

            it('should remove the signature value from the tag', () => {
                weave.insert(c1);
                weave.insert(bot1);
                weave.insert(tag1);
                weave.insert(value1);
                weave.insert(s1);
                const result = reducer(weave, weave.remove(s1));

                expect(result).toEqual({
                    ['test']: {
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: null,
                        },
                    },
                });
            });
        });
    });

    describe('conflict', () => {
        describe('bot', () => {
            it('should replace the old bot with the updated bot in a conflict', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test1'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                // Produces a conflict where bot1B is chosen over bot1A
                const bot1B = atom(atomId('a', 1), null, {
                    type: 1,
                    id: 'test1',
                    extra: 'abcdefghij',
                });

                const hashes = [bot1B.hash, bot1A.hash].sort();
                expect(hashes).toEqual([bot1B.hash, bot1A.hash]);

                const tag1B = atom(atomId('a', 5), bot1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                // The IDs are the same
                expect(state).toEqual({
                    ['test1']: {
                        id: 'test1',
                        tags: {
                            num: 1,
                        },
                    },
                });
            });

            it('should keep the existing bot if it was chosen', () => {
                // Produces a conflict where bot1A is chosen over bot1B
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const bot1B = atom(atomId('a', 1), null, {
                    type: 1,
                    id: 'test',
                    extra: 'abcde',
                });
                const tag1B = atom(atomId('a', 5), bot1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                const hashes = [bot1B.hash, bot1A.hash].sort();
                expect(hashes).toEqual([bot1A.hash, bot1B.hash]);

                state = add(bot1A, tag1A, value1A);
                state = add(bot1B, tag1B, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });
        });

        describe('tag', () => {
            it('should remove the old tag and value', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('test'));

                const hashes = [tag1B.hash, tag1A.hash].sort();
                expect(hashes).toEqual([tag1B.hash, tag1A.hash]);

                state = add(bot1A, tag1A, value1A, tag1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            it('should add the new tag value', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('test'));
                const value1B = atom(atomId('a', 3), tag1B, value(123));

                state = add(bot1A, tag1A, value1A, tag1B, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            test: 123,
                        },
                    },
                });
            });

            it('should keep the old tag if it wasnt replaced', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('test'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('abc'));

                state = add(bot1A, tag1A, value1A, tag1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            test: 'def',
                        },
                    },
                });
            });

            it('should not touch other tags', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), bot1A, tag('test'));

                const tag2 = atom(atomId('a', 4), bot1A, tag('hehe'));
                const value2 = atom(atomId('a', 5), tag2, value(false));

                state = add(bot1A, tag1A, value1A, tag2, value2, tag1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            hehe: false,
                        },
                    },
                });
            });
        });

        describe('value', () => {
            it('should replace the old value with the new one', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const value1B = atom(atomId('a', 3), tag1A, value('1234'));

                const hashes = [value1A.hash, value1B.hash].sort();
                expect(hashes).toEqual([value1B.hash, value1A.hash]);

                state = add(bot1A, tag1A, value1A, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: '1234',
                        },
                    },
                });
            });

            it('should ignore the conflict when the replaced value is not the newest', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));
                const value2A = atom(atomId('a', 4), tag1A, value('real'));

                const value1B = atom(atomId('a', 3), tag1A, value('123'));

                state = add(bot1A, tag1A, value1A, value2A, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'real',
                        },
                    },
                });
            });

            it('should keep the existing value if it was not replaced', () => {
                const bot1A = atom(atomId('a', 1), null, bot('test'));
                const tag1A = atom(atomId('a', 2), bot1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('1234'));

                const value1B = atom(atomId('a', 3), tag1A, value('def'));

                const hashes = [value1A.hash, value1B.hash].sort();
                expect(hashes).toEqual([value1A.hash, value1B.hash]);

                state = add(bot1A, tag1A, value1A, value1B);

                expect(state).toEqual({
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: '1234',
                        },
                    },
                });
            });
        });

        describe('delete', () => {
            it('should keep the bot deleted', () => {
                const bot1 = atom(atomId('a', 1), null, bot('test'));
                const delete1A = atom(atomId('a', 2), bot1, {
                    type: 4,
                    extra: 'haha',
                });
                const delete1B = atom(atomId('a', 2), bot1, deleteOp());
                state = add(bot1, delete1A, delete1B);

                expect(state).toEqual({});
            });
        });

        describe('certificate', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c1, 'password', keypair3);
                c3 = atom(atomId('a', 2), c1, cert3);
            });

            it('should remove the certificate bot if it is the loser', () => {
                const hashes = [c2.hash, c3.hash].sort();
                expect(hashes).toEqual([c2.hash, c3.hash]);

                state = add(c1, c3);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    [uuidv5(c3.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c3.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair3,
                            signature: c3.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c3,
                        },
                    },
                });

                state = add(c2);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    [uuidv5(c2.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c2.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair2,
                            signature: c2.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c2,
                        },
                    },
                });
            });
        });

        describe('revocation', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            let r2: Atom<RevocationOp>;

            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c2);
                r1 = atom(atomId('a', 4), c2, revoke1);

                const revoke2 = signedRevocation(c2, 'password', c3);
                r2 = atom(atomId('a', 4), c3, revoke2);
            });

            it('should remove the revocation and restore previous certificates if it is the loser', () => {
                const hashes = [r1.hash, r2.hash].sort();
                expect(hashes).toEqual([r2.hash, r1.hash]);

                state = add(c1, c2, c3, r1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                });

                state = add(r2);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    [uuidv5(c2.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c2.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair2,
                            signature: c2.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c2,
                        },
                    },
                });
            });
        });

        describe('signature', () => {
            let c1: Atom<CertificateOp>;
            let c2: Atom<CertificateOp>;
            let c3: Atom<CertificateOp>;
            let r1: Atom<RevocationOp>;
            let s1: Atom<SignatureOp>;
            let s2: Atom<SignatureOp>;

            let bot1: Atom<BotOp>;
            let tag1: Atom<TagOp>;
            let value1: Atom<ValueOp>;
            let value2: Atom<ValueOp>;

            beforeAll(() => {
                const cert = signedCert(null, 'password', keypair1);
                c1 = atom(atomId('a', 1), null, cert);
                const cert2 = signedCert(c1, 'password', keypair2);
                c2 = atom(atomId('a', 2), c1, cert2);
                const cert3 = signedCert(c2, 'password', keypair3);
                c3 = atom(atomId('a', 3), c2, cert3);

                const revoke1 = signedRevocation(c1, 'password', c1);
                r1 = atom(atomId('a', 4), c1, revoke1);

                bot1 = atom(atomId('b', 1), null, bot('test'));
                tag1 = atom(atomId('b', 2), bot1, tag('abc'));
                value1 = atom(atomId('b', 3), tag1, value('def'));
                value2 = atom(atomId('b', 4), tag1, value('different'));

                const signature1 = signedValue(c1, 'password', value2);
                s1 = atom(atomId('a', 6), c1, signature1);

                const signature2 = signedValue(c1, 'password', value1);
                s2 = atom(atomId('a', 6), c1, signature2);
            });

            it('should remove the losing signature', () => {
                const hashes = [s1.hash, s2.hash].sort();
                expect(hashes).toEqual([s2.hash, s1.hash]);

                state = add(c1, bot1, tag1, value1, value2, s1);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'different',
                        },
                        signatures: {
                            [tagValueHash('test', 'abc', 'different')]: 'abc',
                        },
                    },
                });

                state = add(s2);

                expect(state).toEqual({
                    [uuidv5(c1.hash, CERT_ID_NAMESPACE)]: {
                        id: uuidv5(c1.hash, CERT_ID_NAMESPACE),
                        space: CERTIFIED_SPACE,
                        tags: {
                            keypair: keypair1,
                            signature: c1.value.signature,
                            signingCertificate: uuidv5(
                                c1.hash,
                                CERT_ID_NAMESPACE
                            ),
                            atom: c1,
                        },
                    },
                    ['test']: {
                        id: 'test',
                        tags: {
                            abc: 'different',
                        },
                        signatures: {
                            [tagValueHash('test', 'abc', 'def')]: 'abc',
                        },
                    },
                });
            });
        });
    });
});
