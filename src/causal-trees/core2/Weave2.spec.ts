import {
    Weave,
    lastInCausalGroup,
    iterateCausalGroup,
    AtomConflictResult,
    iterateFrom,
} from './Weave2';
import { atom, atomId } from './Atom2';

describe('Weave2', () => {
    describe('insert()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should add the first atom as the root', () => {
            const root = atom(atomId('a', 0), null, {});
            const result = weave.insert(root);

            expect(result).toEqual({
                type: 'atom_added',
                atom: root,
            });
            expect(weave.getAtoms()).toEqual([root]);
        });

        it('should allow adding a second root', () => {
            const root = atom(atomId('a', 0), null, {});
            const root2 = atom(atomId('b', 0), null, {});
            weave.insert(root);
            const result = weave.insert(root2);

            expect(result).toEqual({
                type: 'atom_added',
                atom: root2,
            });
            expect(weave.getAtoms()).toEqual([root, root2]);
        });

        it('should reject the root atom if it doesnt match its own hash', () => {
            const root = atom(atomId('a', 0), null, {});
            root.hash = 'bad';
            const result = weave.insert(root);

            expect(result).toEqual({
                type: 'hash_failed',
                atom: root,
            });
            expect(weave.getAtoms()).toEqual([]);
        });

        it('should reject the atom if the cause was not found', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const result = weave.insert(atom1);

            expect(result).toEqual({
                type: 'cause_not_found',
                atom: atom1,
            });
            expect(weave.getAtoms()).toEqual([]);
        });

        it('should reject the atom if it doesnt match its own hash', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            atom1.hash = 'bad';
            weave.insert(cause);
            const result = weave.insert(atom1);

            expect(result).toEqual({
                type: 'hash_failed',
                atom: atom1,
            });
            expect(weave.getAtoms()).toEqual([cause]);
        });

        it('should reject the atom if the timestamp is before the cause timestamp', () => {
            const cause = atom(atomId('a', 5), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            weave.insert(cause);
            const result = weave.insert(atom1);

            expect(result).toEqual({
                type: 'invalid_timestamp',
                atom: atom1,
            });
            expect(weave.getAtoms()).toEqual([cause]);
        });

        it('should treat a duplicate atom as if it was added', () => {
            const cause = atom(atomId('a', 5), null, {});
            const atom1 = atom(atomId('a', 6), cause, {});
            weave.insert(cause);
            weave.insert(atom1);
            const result = weave.insert(atom1);

            expect(result).toEqual({
                type: 'atom_added',
                atom: atom1,
            });
            expect(weave.getAtoms()).toEqual([cause, atom1]);
        });

        it('should treat atoms with different priorities as different atoms', () => {
            const cause = atom(atomId('a', 5), null, {});
            const atom1 = atom(atomId('a', 6), cause, {});
            const atom2 = atom(atomId('a', 6, 5), cause, {});
            weave.insert(cause);
            weave.insert(atom1);
            const result = weave.insert(atom2);

            expect(result).toEqual({
                type: 'atom_added',
                atom: atom2,
            });
            expect(weave.getAtoms()).toEqual([cause, atom2, atom1]);
        });

        describe('conflicts', () => {
            it('should treat atoms with the same ID but different causes as a conflict', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('2', 0), null, {});
                const atom1 = atom(atomId('a', 6), cause1, {});
                const atom2 = atom(atomId('a', 6), cause2, {});
                weave.insert(cause1);
                weave.insert(cause2);
                weave.insert(atom1);
                const result = weave.insert(atom2);

                // atom1 should have the lowest hash
                expect(result).toEqual({
                    type: 'conflict',
                    winner: atom1,
                    loser: atom2,
                });
                expect(weave.getAtoms()).toEqual([cause1, atom1, cause2]);
            });

            it('should choose the atom with the lowest hash as the winner of the conflict', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('2', 0), null, {});
                const atom1 = atom(atomId('a', 6), cause1, {
                    data: 'def',
                });
                const atom2 = atom(atomId('a', 6), cause2, {
                    data: 'ghi',
                });
                weave.insert(cause1);
                weave.insert(cause2);
                weave.insert(atom1);
                const result = weave.insert(atom2);

                // atom2 should have the lowest hash
                expect(result).toEqual({
                    type: 'conflict',
                    winner: atom2,
                    loser: atom1,
                });
                expect(weave.getAtoms()).toEqual([cause1, cause2, atom2]);
            });

            it('should insert the new atom in the correct spot in the weave', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('2', 0), null, {});
                const atom1 = atom(atomId('a', 1), cause2, {});
                const atom2 = atom(atomId('a', 6), cause1, {
                    data: 'def',
                });
                const atom3 = atom(atomId('a', 6), cause2, {
                    data: 'ghi',
                });
                const atom4 = atom(atomId('a', 7), cause2, {});
                weave.insert(cause1);
                weave.insert(cause2);
                weave.insert(atom1);
                weave.insert(atom4);
                weave.insert(atom2);
                const result = weave.insert(atom3);

                // atom2 should have the lowest hash
                expect(result).toEqual({
                    type: 'conflict',
                    winner: atom3,
                    loser: atom2,
                });
                expect(weave.getAtoms()).toEqual([
                    cause1,
                    cause2,
                    atom4,
                    atom3,
                    atom1,
                ]);
            });

            it('should remove the children of the loser', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('2', 0), null, {});
                const atom2 = atom(atomId('a', 6), cause1, {
                    data: 'def',
                });

                const atom2a = atom(atomId('a', 7), atom2, {});
                const atom2b = atom(atomId('a', 8), atom2, {});

                const atom3 = atom(atomId('a', 6), cause2, {
                    data: 'ghi',
                });
                weave.insert(cause1);
                weave.insert(cause2);
                weave.insert(atom2);
                weave.insert(atom2a);
                weave.insert(atom2b);
                const result = weave.insert(atom3);

                // atom2 should have the lowest hash
                expect(result).toEqual({
                    type: 'conflict',
                    winner: atom3,
                    loser: atom2,
                });
                expect(weave.getAtoms()).toEqual([cause1, cause2, atom3]);
            });

            describe('getConflictInfo()', () => {
                it('should return a ref to the loser nodes if they were removed from the weave', () => {
                    const root = atom(atomId('1', 0), null, {});
                    const cause1 = atom(atomId('1', 1), root, {});
                    const cause2 = atom(atomId('2', 1), root, {});
                    const atom2 = atom(atomId('a', 6), cause1, {
                        data: 'def',
                    });

                    const atom2a = atom(atomId('a', 7), atom2, {});
                    const atom2b = atom(atomId('a', 8), atom2, {});

                    const atom3 = atom(atomId('a', 6), cause2, {
                        data: 'ghi',
                    });
                    weave.insert(root);
                    weave.insert(cause1);
                    weave.insert(cause2);
                    weave.insert(atom2);
                    weave.insert(atom2a);
                    weave.insert(atom2b);
                    const result = weave.insert(atom3) as AtomConflictResult;

                    expect(result.type).toBe('conflict');

                    const info = weave.getConflictInfo(result);
                    const nodes = [...iterateFrom(info.loserRef)];

                    expect(info.loserRef.prev).toBe(null);
                    expect(nodes.map(n => n.atom)).toEqual([
                        atom2,
                        atom2b,
                        atom2a,
                    ]);
                });
            });
        });

        it('should add the atom after its cause', () => {
            const cause = atom(atomId('a', 5), null, {});
            const atom1 = atom(atomId('a', 6), cause, {});
            weave.insert(cause);
            const result = weave.insert(atom1);

            expect(result).toEqual({
                type: 'atom_added',
                atom: atom1,
            });
            expect(weave.getAtoms()).toEqual([cause, atom1]);
        });

        it('should order atoms by their timestamp', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('a', 2), cause, {});
            const atom3 = atom(atomId('a', 3), cause, {});
            weave.insert(cause);
            weave.insert(atom1);
            weave.insert(atom3);
            weave.insert(atom2);

            expect(weave.getAtoms()).toEqual([cause, atom3, atom2, atom1]);
        });

        it('should order atoms by site if timestamp is the same', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('b', 1), cause, {});
            const atom3 = atom(atomId('c', 1), cause, {});
            weave.insert(cause);
            weave.insert(atom1);
            weave.insert(atom3);
            weave.insert(atom2);

            expect(weave.getAtoms()).toEqual([cause, atom1, atom2, atom3]);
        });

        it('should order atoms by priority first', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1, 3), cause, {});
            const atom2 = atom(atomId('b', 2, 2), cause, {});
            const atom3 = atom(atomId('c', 3, 1), cause, {});
            weave.insert(cause);
            weave.insert(atom1);
            weave.insert(atom3);
            weave.insert(atom2);

            expect(weave.getAtoms()).toEqual([cause, atom1, atom2, atom3]);
        });

        it('should be able to insert atoms after the last atom', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('a', 2), cause, {});
            const atom3 = atom(atomId('a', 3), cause, {});
            weave.insert(cause);
            weave.insert(atom2);
            weave.insert(atom3);
            weave.insert(atom1);

            expect(weave.getAtoms()).toEqual([cause, atom3, atom2, atom1]);
        });

        it('should be able to insert atoms before the next causal group', () => {
            const root = atom(atomId('a', 0), null, {});
            const cause = atom(atomId('a', 1), root, {});
            const cause2 = atom(atomId('a', 2), root, {});
            const atom1 = atom(atomId('a', 3), cause2, {});
            weave.insert(root);
            weave.insert(cause);
            weave.insert(cause2);
            weave.insert(atom1);

            expect(weave.getAtoms()).toEqual([root, cause2, atom1, cause]);
        });

        it('should be able to insert atoms after a causal group', () => {
            const root = atom(atomId('a', 0), null, {});
            const cause = atom(atomId('a', 1), root, {});
            const cause3 = atom(atomId('a', 4), root, {});
            const cause2 = atom(atomId('a', 5), root, {});
            const atom1 = atom(atomId('a', 6), cause2, {});
            const atom2 = atom(atomId('a', 7), cause2, {});

            weave.insert(root);
            weave.insert(cause);
            weave.insert(cause2);
            weave.insert(atom1);
            weave.insert(atom2);
            weave.insert(cause3);

            expect(weave.getAtoms()).toEqual([
                root,
                cause2,
                atom2,
                atom1,
                cause3,
                cause,
            ]);
        });

        it('should be able to insert atoms before the next root', () => {
            const root1 = atom(atomId('a', 0), null, {});
            const root2 = atom(atomId('b', 0), null, {});

            const atom1 = atom(atomId('a', 1), root1, {});

            weave.insert(root1);
            weave.insert(root2);
            weave.insert(atom1);

            expect(weave.getAtoms()).toEqual([root1, atom1, root2]);
        });
    });

    describe('lastInCausalGroup()', () => {
        let weave: Weave<any>;
        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the last child of the given node', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);

            const last = lastInCausalGroup(weave.roots[0]);

            expect(last.atom).toBe(a1);
            expect(weave.getAtoms()).toEqual([root, a2, a1]);
        });

        it('should return the last deeply nested child of the given node', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});
            const a5 = atom(atomId('a', 5), root, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);

            const last = lastInCausalGroup(weave.roots[0]);

            expect(last.atom).toBe(a3);
            expect(weave.getAtoms()).toEqual([root, a5, a1, a4, a2, a3]);
        });

        it('should return the given node if it has no children', () => {
            const root = atom(atomId('a', 0), null, {});

            weave.insert(root);

            const last = lastInCausalGroup(weave.roots[0]);

            expect(last.atom).toBe(root);
            expect(weave.getAtoms()).toEqual([root]);
        });
    });

    describe('iterateCausalGroup()', () => {
        let weave: Weave<any>;
        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the children of the given node', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);

            const nodes = [...iterateCausalGroup(weave.roots[0])];

            expect(nodes.map(n => n.atom)).toEqual([a2, a1]);
        });

        it('should return the nested children of the given node', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), root, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);

            const nodes = [...iterateCausalGroup(weave.roots[0])];

            expect(nodes.map(n => n.atom)).toEqual([a5, a2, a4, a1, a3]);
        });

        it('should exclude non-children of the given node', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const a5 = atom(atomId('a', 5), root, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);

            const nodes = [...iterateCausalGroup(weave.getNode(a2.id))];

            expect(nodes.map(n => n.atom)).toEqual([a4]);
        });

        it('should exclude atoms with the same timestamp', () => {
            const root = atom(atomId('1', 0), null, {});
            const cause1 = atom(atomId('1', 1), root, {});
            const cause2 = atom(atomId('2', 1), root, {});

            weave.insert(root);
            weave.insert(cause1);
            weave.insert(cause2);

            const nodes = [...iterateCausalGroup(weave.getNode(cause1.id))];

            expect(nodes.map(n => n.atom)).toEqual([]);
        });
    });
});
