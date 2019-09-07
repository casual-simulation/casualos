import { Weave } from '@casual-simulation/causal-trees/core2/Weave2';
import { AuxOp, file, tag, value, del, fileId, AuxOpType } from './AuxOpTypes';
import {
    Atom,
    atom,
    atomId,
} from '@casual-simulation/causal-trees/core2/Atom2';
import reduce from './AuxWeaveReducer';
import { FilesState } from '../Files/File';
import uuidv5 from 'uuid/v5';

describe('AuxWeaveReducer', () => {
    let weave: Weave<AuxOp>;
    let state: FilesState;

    beforeEach(() => {
        weave = new Weave();
        state = {};
    });

    function add(...atoms: Atom<AuxOp>[]): FilesState {
        for (let atom of atoms) {
            state = reduce(weave, weave.insert(atom), state);
        }
        return state;
    }

    describe('atom_added', () => {
        describe('file', () => {
            it('should calculate the File ID from the Atom ID', () => {
                const file1 = atom(atomId('a', 1), null, file());
                state = add(file1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {},
                    },
                });
            });

            it('should do nothing for file atoms with a non-null cause', () => {
                const b1 = atom(atomId('b', 1), null, file());
                const file1 = atom(atomId('a', 2), b1, file());

                state = add(b1, file1);
                expect(state).toEqual({
                    [fileId(b1.id)]: {
                        id: fileId(b1.id),
                        tags: {},
                    },
                });
            });

            it('should preserve the existing file if a duplicate is added', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const file1B = atom(atomId('a', 1), null, file());
                const tag1B = atom(atomId('a', 5), file1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(file1A, tag1A, value1A);
                state = add(file1B, tag1B, value1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            abc: 'def',
                            num: 1,
                        },
                    },
                });
            });
        });

        describe('delete', () => {
            it('should remove the file from the state', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const delete1 = atom(atomId('a', 2), file1, del());
                state = add(file1, delete1);

                expect(state).toEqual({});
            });

            it('should ignore deletes whose cause is null', () => {
                const delete1 = atom(atomId('a', 2), null, del());
                state = add(delete1);

                expect(state).toEqual({});
            });

            it('should ignore deletes that are not the first child of the file', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const delete1 = atom(atomId('a', 2), file1, del());
                const tag1 = atom(atomId('a', 3), file1, tag('test'));
                state = add(file1, tag1, delete1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {},
                    },
                });
            });

            it('should not touch other files', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const file2 = atom(atomId('a', 2), null, file());
                const delete1 = atom(atomId('a', 3), file1, del());

                state = add(file1, file2, delete1);

                expect(state).toEqual({
                    [fileId(file2.id)]: {
                        id: fileId(file2.id),
                        tags: {},
                    },
                });
            });

            // TODO: Add support for deleting spans of text from values/inserts.
            it.skip('should remove the span of text from the tag value', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('tag'));
                const value1 = atom(atomId('a', 3), tag1, value('abcdef'));
                const delete1 = atom(atomId('a', 2), value1, del(0, 2));
                state = add(file1, tag1, value1, delete1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {
                            tag: 'def',
                        },
                    },
                });
            });
        });

        describe('tag', () => {
            it('should do nothing', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('abc'));

                state = add(file1, tag1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {},
                    },
                });
            });
        });

        describe('value', () => {
            it('should set the tag value', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));

                state = add(file1, tag1, value1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should preserve values with timestamps after the new atom', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('haha'));

                state = add(file1, tag1, value2, value1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {
                            abc: 'haha',
                        },
                    },
                });
            });

            it('should use last write wins for new tag values', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 4), tag1, value('haha'));

                state = add(file1, tag1, value1, value2);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {
                            abc: 'haha',
                        },
                    },
                });
            });

            let deleteValueCases = [
                ['null', null],
                ['undefined', undefined],
                ['empty string', ''],
            ];

            it.each(deleteValueCases)(
                'should delete tags with %s values',
                (desc, val) => {
                    const file1 = atom(atomId('a', 1), null, file());
                    const tag1 = atom(atomId('a', 2), file1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value(val));

                    state = add(file1, tag1, value1, value2);

                    expect(state).toEqual({
                        [fileId(file1.id)]: {
                            id: fileId(file1.id),
                            tags: {},
                        },
                    });
                }
            );

            let preserveValueCases = [
                ['0', 0],
                ['false', false],
                ['whitespace', ' '],
            ];

            it.each(preserveValueCases)(
                'should preserve tags with %s values',
                (desc, val) => {
                    const file1 = atom(atomId('a', 1), null, file());
                    const tag1 = atom(atomId('a', 2), file1, tag('abc'));
                    const value1 = atom(atomId('a', 3), tag1, value('def'));
                    const value2 = atom(atomId('a', 4), tag1, value(val));

                    state = add(file1, tag1, value1, value2);

                    expect(state).toEqual({
                        [fileId(file1.id)]: {
                            id: fileId(file1.id),
                            tags: {
                                abc: val,
                            },
                        },
                    });
                }
            );

            let invalidTagNameCases = [
                ['empty', ''],
                ['null', null],
                ['undefined', undefined],
            ];
            it.each(invalidTagNameCases)(
                'should ignore tags with %s names',
                (desc, name) => {
                    const file1 = atom(atomId('a', 1), null, file());
                    const tag1 = atom(atomId('a', 2), file1, tag(name));
                    const value1 = atom(atomId('a', 3), tag1, value('haha'));

                    state = add(file1, tag1, value1);

                    expect(state).toEqual({
                        [fileId(file1.id)]: {
                            id: fileId(file1.id),
                            tags: {},
                        },
                    });
                }
            );

            it('should preserve other tag values when deleting a tag', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('def'));
                const value2 = atom(atomId('a', 6), tag1, value(null));

                const otherTag1 = atom(atomId('a', 4), file1, tag('test'));
                const otherValue1 = atom(
                    atomId('a', 5),
                    otherTag1,
                    value(true)
                );

                state = add(
                    file1,
                    tag1,
                    value1,
                    otherTag1,
                    otherValue1,
                    value2
                );

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {
                            test: true,
                        },
                    },
                });
            });

            it('should ignore values whose direct cause is nonexistent', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const value1 = atom(atomId('a', 3), file1, value('haha'));

                state = add(file1, value1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {},
                    },
                });
            });

            it('should ignore values whose grantgause is nonexistent', () => {
                const tag1 = atom(atomId('a', 1), null, tag('abc'));
                const value1 = atom(atomId('a', 3), tag1, value('haha'));

                state = add(tag1, value1);

                expect(state).toEqual({});
            });

            it('should ignore values whose cause is not a tag', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, file());
                const value1 = atom(atomId('a', 3), tag1, value('haha'));

                state = add(file1, tag1, value1);

                expect(state).toEqual({
                    [fileId(file1.id)]: {
                        id: fileId(file1.id),
                        tags: {},
                    },
                });
            });

            it('should ignore values whose grandcause is not a file', () => {
                const file1 = atom(atomId('a', 1), null, tag('test1'));
                const tag1 = atom(atomId('a', 2), file1, tag('test2'));
                const value1 = atom(atomId('a', 3), tag1, value('haha'));

                state = add(file1, tag1, value1);

                expect(state).toEqual({});
            });

            it('should ignore values when the file is deleted', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const tag1 = atom(atomId('a', 2), file1, tag('test'));
                const delete1 = atom(atomId('a', 3), file1, del());
                const value1 = atom(atomId('a', 4), tag1, value('haha'));

                state = add(file1, tag1, delete1, value1);

                expect(state).toEqual({});
            });
        });

        // TODO: Add support for inserts
    });

    describe('conflict', () => {
        describe('file', () => {
            it('should replace the old file with the updated file in a conflict', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                // Produces a conflict where file1B is chosen over file1A
                const file1B = atom(atomId('a', 1), null, {
                    type: 1,
                    extra: 'abcde',
                });
                const tag1B = atom(atomId('a', 5), file1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(file1A, tag1A, value1A);
                state = add(file1B, tag1B, value1B);

                // The IDs are the same
                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            num: 1,
                        },
                    },
                });
            });

            it('should keep the existing file if it was chosen', () => {
                // Produces a conflict where file1A is chosen over file1B
                const file1A = atom(atomId('a', 1), null, {
                    type: 1,
                    extra: 'abcde',
                });
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const file1B = atom(atomId('a', 1), null, file());
                const tag1B = atom(atomId('a', 5), file1B, tag('num'));
                const value1B = atom(atomId('a', 6), tag1B, value(1));

                state = add(file1A, tag1A, value1A);
                state = add(file1B, tag1B, value1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });
        });

        describe('tag', () => {
            it('should remove the old tag and value', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), file1A, tag('test'));

                state = add(file1A, tag1A, value1A, tag1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {},
                    },
                });
            });

            it('should add the new tag value', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), file1A, tag('test'));
                const value1B = atom(atomId('a', 3), tag1B, value(123));

                state = add(file1A, tag1A, value1A, tag1B, value1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            test: 123,
                        },
                    },
                });
            });

            it('should keep the old tag if it wasnt replaced', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('test'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), file1A, tag('abc'));

                state = add(file1A, tag1A, value1A, tag1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            test: 'def',
                        },
                    },
                });
            });

            it('should not touch other tags', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const tag1B = atom(atomId('a', 2), file1A, tag('test'));

                const tag2 = atom(atomId('a', 4), file1A, tag('hehe'));
                const value2 = atom(atomId('a', 5), tag2, value(false));

                state = add(file1A, tag1A, value1A, tag2, value2, tag1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            hehe: false,
                        },
                    },
                });
            });
        });

        describe('value', () => {
            it('should replace the old value with the new one', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));

                const value1B = atom(atomId('a', 3), tag1A, value('123'));

                state = add(file1A, tag1A, value1A, value1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            abc: '123',
                        },
                    },
                });
            });

            it('should ignore the conflict when the replaced value is not the newest', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('def'));
                const value2A = atom(atomId('a', 4), tag1A, value('real'));

                const value1B = atom(atomId('a', 3), tag1A, value('123'));

                state = add(file1A, tag1A, value1A, value2A, value1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            abc: 'real',
                        },
                    },
                });
            });

            it('should keep the existing value if it was not replaced', () => {
                const file1A = atom(atomId('a', 1), null, file());
                const tag1A = atom(atomId('a', 2), file1A, tag('abc'));
                const value1A = atom(atomId('a', 3), tag1A, value('123'));

                const value1B = atom(atomId('a', 3), tag1A, value('def'));

                state = add(file1A, tag1A, value1A, value1B);

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {
                            abc: '123',
                        },
                    },
                });
            });
        });

        describe('delete', () => {
            it('should keep the file deleted', () => {
                const file1 = atom(atomId('a', 1), null, file());
                const delete1A = atom(atomId('a', 2), file1, {
                    type: 4,
                    extra: 'haha',
                });
                const delete1B = atom(atomId('a', 2), file1, del());
                state = add(file1, delete1A, delete1B);

                expect(state).toEqual({});
            });
        });
    });
});
