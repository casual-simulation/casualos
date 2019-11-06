import { MemoryAtomStore } from './MemoryAtomStore';
import { atom, atomId } from './Atom2';

describe('MemoryAtomStore', () => {
    let subject: MemoryAtomStore;

    beforeEach(async () => {
        subject = new MemoryAtomStore();

        await subject.init();
    });

    describe('findByCause()', () => {
        it('should be able to find atoms by their cause', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const a4 = atom(atomId('a', 4), a2, {});
            await subject.add([a1, a3, a4, a2]);

            const atoms = await subject.findByCause(atomId('a', 1));

            // Sorts atoms by their timestamp
            expect(atoms).toEqual([a2, a3]);
        });

        it('should return an empty array if there are no atoms', async () => {
            const atoms = await subject.findByCause(atomId('a', 1));

            // Sorts atoms by their timestamp
            expect(atoms).toEqual([]);
        });
    });

    describe('findByHash()', () => {
        it('should be able to find atoms by their hash', async () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a1, {});
            const a4 = atom(atomId('a', 4), a2, {});
            await subject.add([a1, a3, a4, a2]);

            const atoms = await subject.findByHashes([
                a3.hash,
                a2.hash,
                a4.hash,
            ]);

            // Returns in same order as hashes
            expect(atoms).toEqual([a3, a2, a4]);
        });

        it('should place a null for hashes that dont have an atom', async () => {
            const atoms = await subject.findByHashes(['missing', 'missing2']);

            // Sorts atoms by their timestamp
            expect(atoms).toEqual([null, null]);
        });
    });
});
