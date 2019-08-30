import { Weave } from './Weave2';
import { atom, atomId } from './Atom2';

describe('Weave2', () => {
    describe('insert()', () => {
        it('should add the first atom as the root', () => {
            let weave = new Weave();

            const root = atom(atomId('a', 0), null, {});
            const result = weave.insert(root);

            expect(result).toEqual({
                type: 'atom_added',
                atom: root,
            });
            expect(weave.getAtoms()).toEqual([root]);
        });

        it('should allow adding a second root', () => {
            let weave = new Weave();

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
            let weave = new Weave();

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
            let weave = new Weave();

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
            let weave = new Weave();

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
            let weave = new Weave();

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
            let weave = new Weave();

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
            let weave = new Weave();

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

        it('should treat atoms with the same ID but different causes as a conflict', () => {
            let weave = new Weave();

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
            let weave = new Weave();

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

        it('should add the atom after its cause', () => {
            let weave = new Weave();

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
    });
});
