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

        it('should reject the atom if the timestamp is before the cause timestamp', () => {
            let weave = new Weave();

            const cause = atom(atomId('a', 5), null, {});
            const atom1 = atom(atomId('a', 1), cause, {});
            const result = weave.insert(atom1);

            expect(result).toEqual({
                type: 'invalid_timestamp',
                atom: atom1,
            });
            expect(weave.getAtoms()).toEqual([]);
        });
    });
});
