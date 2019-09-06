import { Weave } from '@casual-simulation/causal-trees/core2/Weave2';
import { AuxOp, file, tag, value, del, fileId } from './AuxOpTypes';
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

                expect(state).toEqual({
                    [fileId(file1A.id)]: {
                        id: fileId(file1A.id),
                        tags: {},
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
        });

        // TODO: Add support for inserts
    });
});
