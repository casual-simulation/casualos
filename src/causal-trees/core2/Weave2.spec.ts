import {
    Weave,
    lastInCausalGroup,
    iterateCausalGroup,
    AtomConflictResult,
    iterateFrom,
    iterateSiblings,
    AtomRemovedResult,
    addedAtom,
    iterateNewerSiblings,
} from './Weave2';
import { atom, atomId, Atom } from './Atom2';
import { createAtom } from './SiteStatus';

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

        it('should reject root atoms that pass the cardinality of another root', () => {
            const root = atom(
                atomId('a', 0, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );
            const root2 = atom(
                atomId('b', 0, undefined, { group: 'abc', number: 1 }),
                null,
                {}
            );
            weave.insert(root);
            const result = weave.insert(root2);

            expect(result).toEqual({
                type: 'cardinality_violated',
                atom: root2,
            });
            expect(weave.getAtoms()).toEqual([root]);
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
                savedInReorderBuffer: true,
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
                type: 'atom_already_added',
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
                    loserRef: null,
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
                    loserRef: expect.anything(),
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
                    loserRef: expect.anything(),
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
                    loserRef: expect.anything(),
                });
                expect(weave.getAtoms()).toEqual([cause1, cause2, atom3]);
            });

            it('should handle conflicts between two root atoms', () => {
                const cause1 = atom(atomId('1', 0), null, {});
                const cause2 = atom(atomId('1', 0), null, {
                    abc: 'def',
                });
                weave.insert(cause1);
                const result = weave.insert(cause2);

                // atom2 should have the lowest hash
                expect(result).toEqual({
                    type: 'conflict',
                    winner: cause2,
                    loser: cause1,
                    loserRef: expect.anything(),
                });
                expect(weave.getAtoms()).toEqual([cause2]);
            });

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

                const nodes = [...iterateFrom(result.loserRef)];

                expect(result.loserRef.prev).toBe(null);
                expect(nodes.map((n) => n.atom)).toEqual([
                    atom2,
                    atom2b,
                    atom2a,
                ]);
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

        it('should properly sort atoms that have null/undefined priorities in the causes', () => {
            const root1 = atom(atomId('a', 0), null, {});
            const root2 = atom(atomId('a', 0), null, {});
            const root3 = atom(atomId('a', 0), null, {});
            const first = atom(atomId('a', 5), root1, {});
            first.cause.priority = null;

            const second = atom(atomId('b', 10), root2, {});
            second.id.priority = undefined;

            weave.insert(root3);
            weave.insert(first);
            weave.insert(second);

            expect(weave.getAtoms()).toEqual([root3, second, first]);
        });

        it('should support an atom that is added before its cause', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1, 3), cause, {});

            const result1 = weave.insert(atom1);
            const result2 = weave.insert(cause);

            expect(result1).toEqual({
                type: 'cause_not_found',
                atom: atom1,
                savedInReorderBuffer: true,
            });
            expect(result2).toEqual({
                type: 'atoms_added',
                atoms: [cause, atom1],
            });
            expect(weave.getAtoms()).toEqual([cause, atom1]);
        });

        it('should support atoms that are added before their cause', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('a', 2), cause, {});
            const atom3 = atom(atomId('a', 3), cause, {});

            const result1 = weave.insert(atom1);
            const result2 = weave.insert(atom2);
            const result3 = weave.insert(atom3);
            const result4 = weave.insert(cause);

            expect(result1).toEqual({
                type: 'cause_not_found',
                atom: atom1,
                savedInReorderBuffer: true,
            });
            expect(result2).toEqual({
                type: 'cause_not_found',
                atom: atom2,
                savedInReorderBuffer: true,
            });
            expect(result3).toEqual({
                type: 'cause_not_found',
                atom: atom3,
                savedInReorderBuffer: true,
            });
            expect(result4).toEqual({
                type: 'atoms_added',
                atoms: [cause, atom3, atom2, atom1],
            });
            expect(weave.getAtoms()).toEqual([cause, atom3, atom2, atom1]);
        });

        it('should support chains of atoms that are added without a cause', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('a', 2), atom1, {});
            const atom3 = atom(atomId('a', 3), atom2, {});

            const result1 = weave.insert(atom1);
            const result2 = weave.insert(atom2);
            const result3 = weave.insert(atom3);
            const result4 = weave.insert(cause);

            expect(result1).toEqual({
                type: 'cause_not_found',
                atom: atom1,
                savedInReorderBuffer: true,
            });
            expect(result2).toEqual({
                type: 'cause_not_found',
                atom: atom2,
                savedInReorderBuffer: true,
            });
            expect(result3).toEqual({
                type: 'cause_not_found',
                atom: atom3,
                savedInReorderBuffer: true,
            });
            expect(result4).toEqual({
                type: 'atoms_added',
                atoms: [cause, atom1, atom2, atom3],
            });
            expect(weave.getAtoms()).toEqual([cause, atom1, atom2, atom3]);
        });

        it('should not save atoms that exceed the reorder buffer size in the reorder buffer', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('a', 2), cause, {});
            const atom3 = atom(atomId('a', 3), cause, {});
            const atom4 = atom(atomId('a', 4), cause, {});

            weave = new Weave({
                maxReorderBufferSize: 2,
            });

            const result1 = weave.insert(atom1);
            const result2 = weave.insert(atom2);
            const result3 = weave.insert(atom3);
            const result4 = weave.insert(atom4);

            expect(result1).toEqual({
                type: 'cause_not_found',
                atom: atom1,
                savedInReorderBuffer: true,
            });
            expect(result2).toEqual({
                type: 'cause_not_found',
                atom: atom2,
                savedInReorderBuffer: true,
            });
            expect(result3).toEqual({
                type: 'cause_not_found',
                atom: atom3,
                savedInReorderBuffer: false,
            });
            expect(result4).toEqual({
                type: 'cause_not_found',
                atom: atom4,
                savedInReorderBuffer: false,
            });
        });

        it('should support chains of atoms that are added in reverse order', () => {
            const cause = atom(atomId('a', 0), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const atom2 = atom(atomId('a', 2), atom1, {});
            const atom3 = atom(atomId('a', 3), atom2, {});
            const atom4 = atom(atomId('a', 4), atom3, {});

            const result4 = weave.insert(atom4);
            const result3 = weave.insert(atom3);
            const result2 = weave.insert(atom2);
            const result1 = weave.insert(atom1);
            const result5 = weave.insert(cause);

            expect(result1).toEqual({
                type: 'cause_not_found',
                atom: atom1,
                savedInReorderBuffer: true,
            });
            expect(result2).toEqual({
                type: 'cause_not_found',
                atom: atom2,
                savedInReorderBuffer: true,
            });
            expect(result3).toEqual({
                type: 'cause_not_found',
                atom: atom3,
                savedInReorderBuffer: true,
            });
            expect(result4).toEqual({
                type: 'cause_not_found',
                atom: atom4,
                savedInReorderBuffer: true,
            });
            expect(result5).toEqual({
                type: 'atoms_added',
                atoms: [cause, atom1, atom2, atom3, atom4],
            });

            expect(weave.getAtoms()).toEqual([
                cause,
                atom1,
                atom2,
                atom3,
                atom4,
            ]);
        });

        describe('bugs', () => {
            it('should handle issue where the atom is not overwriting a previous value', () => {
                // This test should never be updated.
                const site1 = 'e4fc0a5b-1b58-46f9-ae3b-67769153903f';
                const root = atom(atomId(site1, 1989, null), null, {
                    type: 1,
                    id: '98b4f896-413d-4875-9ddc-dd394f16c034',
                });
                expect(root.hash).toEqual(
                    'ccd9cea8f83001344e4be0202ad1116bbde20976c8b9dfa8953b1c9713860626'
                );

                let result = weave.insert(root);
                expect(result).toEqual({
                    type: 'atom_added',
                    atom: root,
                });

                const color = atom(atomId(site1, 1996, null), root, {
                    type: 2,
                    name: 'auxColor',
                });
                expect(color.hash).toEqual(
                    '5f02d0e3e44f1b4766eb5b31741c655edd025215d691f6b722e707e52eb19cee'
                );

                result = weave.insert(color);
                expect(result).toEqual({
                    type: 'atom_added',
                    atom: color,
                });

                const site2 = '6999e06b-7a56-4ea8-9e94-b9b104ee9360';
                const first = atom(atomId(site2, 2091), color, {
                    type: 3,
                    value: '#89ead4',
                });

                expect(first.hash).toEqual(
                    '2cc72a94414a0f18419be38cf3e04f581d376afdb0c34e83bfcd104094ba3eed'
                );
                result = weave.insert(first);
                expect(result).toEqual({
                    type: 'atom_added',
                    atom: first,
                });

                const site3 = '63b35cc1-b05e-4cbe-a25a-3e0262a36f6a';
                const second = atom(atomId(site3, 3431), color, {
                    type: 3,
                    value: '#89e',
                });
                expect(second.hash).toEqual(
                    '93955f3f854f4b0a9c315a7eda40afd2c0427fa342508a0eddedcfe4ec5fa583'
                );
                result = weave.insert(second);
                expect(result).toEqual({
                    type: 'atom_added',
                    atom: second,
                });

                expect(weave.getAtoms()).toEqual([root, color, second, first]);
            });
        });
    });

    describe('getNode()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the node with the given ID', () => {
            const a1 = atom(atomId('a', 1), null, {});

            weave.insert(a1);

            const node = weave.getNode(a1.id);
            expect(node.atom).toBe(a1);
        });

        it('should return the node with the given string formatted ID', () => {
            const a1 = atom(atomId('a', 1), null, {});

            weave.insert(a1);

            const node = weave.getNode('a@1');
            expect(node.atom).toBe(a1);
        });

        it('should return null when given null', () => {
            const node = weave.getNode(null);
            expect(node).toBe(null);
        });
    });

    describe('getNodeByHash()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the node with the given hash', () => {
            const a1 = atom(atomId('a', 1), null, {});

            weave.insert(a1);

            const node = weave.getNodeByHash(a1.hash);
            expect(node.atom).toBe(a1);
        });

        it('should return null when given null', () => {
            const node = weave.getNodeByHash(null);
            expect(node).toBe(null);
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

            expect(nodes.map((n) => n.atom)).toEqual([a2, a1]);
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

            expect(nodes.map((n) => n.atom)).toEqual([a5, a2, a4, a1, a3]);
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

            expect(nodes.map((n) => n.atom)).toEqual([a4]);
        });

        it('should exclude atoms with the same timestamp', () => {
            const root = atom(atomId('1', 0), null, {});
            const cause1 = atom(atomId('1', 1), root, {});
            const cause2 = atom(atomId('2', 1), root, {});

            weave.insert(root);
            weave.insert(cause1);
            weave.insert(cause2);

            const nodes = [...iterateCausalGroup(weave.getNode(cause1.id))];

            expect(nodes.map((n) => n.atom)).toEqual([]);
        });
    });

    describe('iterateSiblings()', () => {
        let weave: Weave<any>;
        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the siblings of the given node that were added to the weave before it', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});
            const a5 = atom(atomId('a', 5), root, {});
            const a6 = atom(atomId('a', 6), a5, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);
            weave.insert(a6);

            const a5Node = weave.getNode(a5.id);
            const nodes = [...iterateSiblings(a5Node)];

            expect(nodes.map((n) => n.atom)).toEqual([a2, a1]);
        });

        it('should exclude cousin atoms', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const a4 = atom(atomId('a', 4), root, {});
            const a5 = atom(atomId('a', 5), a4, {});
            const a6 = atom(atomId('a', 6), a4, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);
            weave.insert(a6);

            const a6Node = weave.getNode(a6.id);
            const nodes = [...iterateSiblings(a6Node)];

            expect(nodes.map((n) => n.atom)).toEqual([a5]);
        });

        it('should exclude cousin atoms with the same timestamp', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const b1 = atom(atomId('b', 1), root, {});
            const b2 = atom(atomId('b', 2), b1, {});
            const b3 = atom(atomId('b', 3), b1, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(b1);
            weave.insert(b2);
            weave.insert(b3);

            const b3Node = weave.getNode(b3.id);
            const nodes = [...iterateSiblings(b3Node)];

            expect(nodes.map((n) => n.atom)).toEqual([b2]);
        });

        it('should work with root atoms', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});
            const root2 = atom(atomId('b', 3), null, {});
            const b4 = atom(atomId('b', 4), root2, {});
            const b5 = atom(atomId('b', 5), root2, {});
            const b6 = atom(atomId('b', 6), b5, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(root2);
            weave.insert(b4);
            weave.insert(b5);
            weave.insert(b6);

            const rootNode = weave.getNode(root.id);
            const nodes = [...iterateSiblings(rootNode)];

            expect(nodes.map((n) => n.atom)).toEqual([]);
        });
    });

    describe('iterateNewerSiblings()', () => {
        let weave: Weave<any>;
        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the siblings of the given node that were added to the weave after it', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});
            const a5 = atom(atomId('a', 5), root, {});
            const a6 = atom(atomId('a', 6), a5, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);
            weave.insert(a6);

            const a2Node = weave.getNode(a2.id);
            const nodes = [...iterateNewerSiblings(a2Node)];

            expect(nodes.map((n) => n.atom)).toEqual([a5]);
        });

        it('should exclude cousin atoms', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const a4 = atom(atomId('a', 4), root, {});
            const a5 = atom(atomId('a', 5), a4, {});
            const a6 = atom(atomId('a', 6), a4, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(a4);
            weave.insert(a5);
            weave.insert(a6);

            const a2Node = weave.getNode(a2.id);
            const nodes = [...iterateNewerSiblings(a2Node)];

            expect(nodes.map((n) => n.atom)).toEqual([a3]);
        });

        it('should exclude cousin atoms with the same timestamp', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const b1 = atom(atomId('b', 1), root, {});
            const b2 = atom(atomId('b', 2), b1, {});
            const b3 = atom(atomId('b', 3), b1, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(a3);
            weave.insert(b1);
            weave.insert(b2);
            weave.insert(b3);

            const a2Node = weave.getNode(a2.id);
            const nodes = [...iterateNewerSiblings(a2Node)];

            expect(nodes.map((n) => n.atom)).toEqual([a3]);
        });

        it('should work with root atoms', () => {
            const root = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), root, {});
            const a2 = atom(atomId('a', 2), root, {});
            const root2 = atom(atomId('b', 3), null, {});
            const b4 = atom(atomId('b', 4), root2, {});
            const b5 = atom(atomId('b', 5), root2, {});
            const b6 = atom(atomId('b', 6), b5, {});

            weave.insert(root);
            weave.insert(a1);
            weave.insert(a2);
            weave.insert(root2);
            weave.insert(b4);
            weave.insert(b5);
            weave.insert(b6);

            const rootNode = weave.getNode(root.id);
            const nodes = [...iterateNewerSiblings(rootNode)];

            expect(nodes.map((n) => n.atom)).toEqual([]);
        });
    });

    describe('referenceChain()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave<any>();
        });

        it('should the given reference if it is the root', () => {
            const root = atom(atomId('a', 0), null, {});
            weave.insert(root);
            const chain = weave.referenceChain(root.id);
            expect(chain.map((ref) => ref.atom)).toEqual([root]);
        });

        it('should return all the ancestors of the given reference', () => {
            const root = atom(atomId('a', 0), null, {});
            const child = atom(atomId('a', 1), root, {});
            const sibling = atom(atomId('a', 4), root, {});
            const grandChild = atom(atomId('a', 2), child, {});
            const grandSibling = atom(atomId('a', 5), sibling, {});
            const greatGrandChild = atom(atomId('a', 3), grandChild, {});
            const greatGrandSibling = atom(atomId('a', 6), grandSibling, {});

            weave.insert(root);
            weave.insert(child);
            weave.insert(sibling);
            weave.insert(grandChild);
            weave.insert(grandSibling);
            weave.insert(greatGrandChild);
            weave.insert(greatGrandSibling);

            const chain = weave.referenceChain(greatGrandChild.id);

            expect(chain.map((ref) => ref.atom)).toEqual([
                greatGrandChild,
                grandChild,
                child,
                root,
            ]);
        });
    });

    describe('remove()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should return an invalid argument result when given null', () => {
            expect(weave.remove(null)).toEqual({
                type: 'invalid_argument',
            });
        });

        it('should return a not found result when given a reference thats not in the weave', () => {
            let weave = new Weave();

            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a1, {});
            const ref3 = a3;

            expect(weave.remove(ref3)).toEqual({
                type: 'atom_not_found',
                atom: a3,
            });
        });

        it('should remove the given reference from the weave', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a1, {});
            weave.insert(a3);

            const result = weave.remove(a3) as AtomRemovedResult;
            const removed = result.ref;
            expect(removed.atom).toEqual(a3);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a2]);
        });

        it('should remove all the children of the given reference when it is at the end of the weave', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a1, {});
            weave.insert(a3);

            const result = weave.remove(a1) as AtomRemovedResult;
            const removed = result.ref;
            expect(removed.atom).toEqual(a1);

            const removedAtoms = [...iterateFrom(removed)].map((n) => n.atom);
            expect(removedAtoms).toEqual([a1, a3, a2]);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([]);
        });

        it('should remove all the children of the given reference when it is in the middle of the weave', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a2, {});
            weave.insert(a3);

            const a4 = atom(atomId('2', 4), a2, {});
            weave.insert(a4);

            const a5 = atom(atomId('2', 5), a1, {});
            weave.insert(a5);

            const result = weave.remove(a2) as AtomRemovedResult;
            const removed = result.ref;
            const removedAtoms = [...iterateFrom(removed)].map((n) => n.atom);
            expect(removedAtoms).toEqual([a2, a4, a3]);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a5]);
        });
    });

    describe('removeSiblingsBefore()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should return a invalid argument result if given null', () => {
            expect(weave.removeSiblingsBefore(null)).toEqual({
                type: 'invalid_argument',
            });
            expect(weave.removeSiblingsBefore(undefined)).toEqual({
                type: 'invalid_argument',
            });
        });

        it('should return a nothing happened result if given an atom without siblings', () => {
            const a1 = atom(atomId('1', 1), null, null);
            weave.insert(a1);

            expect(weave.removeSiblingsBefore(a1)).toEqual({
                type: 'nothing_happened',
            });
        });

        it('should return a nothing happened result if given an atom whose cause isnt in the weave', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a5 = atom(atomId('1', 11), null, {});
            const a2 = atom(atomId('1', 12), a5, {});

            expect(weave.removeSiblingsBefore(a2)).toEqual({
                type: 'atom_not_found',
                atom: a2,
            });
        });

        it('should return a not found result if given an atom that is not in the weave', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a1, {});
            weave.insert(a3);

            const a4 = atom(atomId('2', 4), a1, {});

            expect(weave.removeSiblingsBefore(a4)).toEqual({
                type: 'atom_not_found',
                atom: a4,
            });
        });

        it('should remove all of the sibling references that occurred before the given reference', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a1, {});
            weave.insert(a3);

            const a4 = atom(atomId('2', 4), a1, {});
            weave.insert(a4);

            const result = weave.removeSiblingsBefore(a4) as AtomRemovedResult;
            const removed = result.ref;
            const removedAtoms = [...iterateFrom(removed)].map((n) => n.atom);
            expect(removedAtoms).toEqual([a3, a2]);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a4]);
        });

        it('should preserve sibling references that occurred after the given reference', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('2', 3), a1, {});
            weave.insert(a3);

            const a4 = atom(atomId('2', 4), a1, {});
            weave.insert(a4);

            const result = weave.removeSiblingsBefore(a3) as AtomRemovedResult;
            const removed = result.ref;
            const removedAtoms = [...iterateFrom(removed)].map((n) => n.atom);
            expect(removedAtoms).toEqual([a2]);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a4, a3]);
        });

        it('should not remove anything if there are no sibling references', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('1', 3), a2, {});
            weave.insert(a3);

            expect(weave.removeSiblingsBefore(a2)).toEqual({
                type: 'nothing_happened',
            });

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a2, a3]);
        });

        it('should preserve its own children', () => {
            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('1', 3), a2, {});
            weave.insert(a3);

            const a4 = atom(atomId('1', 4), a1, {});
            weave.insert(a4);

            const a5 = atom(atomId('1', 5), a4, {});
            weave.insert(a5);

            const result = weave.removeSiblingsBefore(a4) as AtomRemovedResult;
            const removed = result.ref;
            const removedAtoms = [...iterateFrom(removed)].map((n) => n.atom);
            expect(removedAtoms).toEqual([a2, a3]);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a4, a5]);
        });

        it('should work for deep nesting', () => {
            let weave = new Weave();

            const a1 = atom(atomId('1', 1), null, {});
            weave.insert(a1);

            const a2 = atom(atomId('1', 2), a1, {});
            weave.insert(a2);

            const a3 = atom(atomId('1', 3), a2, {});
            weave.insert(a3);

            const a4 = atom(atomId('1', 4), a3, {});
            weave.insert(a4);

            const a5 = atom(atomId('1', 5), a4, {});
            weave.insert(a5);

            const a6 = atom(atomId('1', 6), a4, {});
            weave.insert(a6);

            const a7 = atom(atomId('1', 7), a3, {});
            weave.insert(a7);

            const a8 = atom(atomId('1', 8), a2, {});
            weave.insert(a8);

            const a9 = atom(atomId('1', 9), a1, {});
            weave.insert(a9);

            const result = weave.removeSiblingsBefore(a7) as AtomRemovedResult;
            const removed = result.ref;
            const removedAtoms = [...iterateFrom(removed)].map((n) => n.atom);
            expect(removedAtoms).toEqual([a4, a6, a5]);

            const atoms = weave.getAtoms();
            expect(atoms).toEqual([a1, a9, a2, a8, a3, a7]);
        });
    });

    describe('getIndex()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the current index for the weave', () => {
            const a1 = atom(atomId('1', 1), null, {});
            const a2 = atom(atomId('1', 2), a1, {});

            weave.insert(a1);
            weave.insert(a2);

            const index = weave.calculateIndex();

            expect(index).toEqual({
                hash: expect.any(String),
                atoms: {
                    [a1.hash]: '1@1',
                    [a2.hash]: '1@2',
                },
            });
        });
    });

    describe('addedAtom()', () => {
        let weave: Weave<any>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should return the atom from the atom_added result', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const result = weave.insert(a1);

            const added = addedAtom(result);

            expect(added).toEqual(a1);
        });

        it('should return the winning atom in a conflict', () => {
            const a1 = atom(atomId('a', 1), null, {
                abc: 'def',
            });
            const a2 = atom(atomId('a', 1), null, {
                ghi: 123,
            });

            const hashes = [a1.hash, a2.hash].sort();
            expect(hashes).toEqual([a1.hash, a2.hash]);

            weave.insert(a2);
            const result = weave.insert(a1);
            const added = addedAtom(result);

            expect(added).toEqual(a1);
        });

        it('should return the atoms when a bunch are added at once', () => {
            const cause = atom(atomId('a', 0), null, {});
            const a1 = atom(atomId('a', 1), cause, {});
            const a2 = atom(atomId('a', 2), cause, {});

            weave.insert(a2);
            weave.insert(a1);
            weave.insert(a2);
            const result = weave.insert(cause);
            const added = addedAtom(result);

            expect(added).toEqual([cause, a2, a1]);
        });
    });
});
