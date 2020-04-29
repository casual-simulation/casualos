import { MemoryCausalRepoStore } from './MemoryCausalRepoStore';
import { FallbackCausalObjectStore } from './CausalRepoStore';
import { storeData } from './CausalRepo';
import { atom, atomId } from './Atom2';
import { repoAtom } from './CausalRepoObject';

describe('FallbackCausalObjectStore', () => {
    let first: MemoryCausalRepoStore;
    let second: MemoryCausalRepoStore;
    let subject: FallbackCausalObjectStore;

    beforeEach(() => {
        first = new MemoryCausalRepoStore();
        second = new MemoryCausalRepoStore();

        subject = new FallbackCausalObjectStore(first, second);
    });

    describe('getObjects()', () => {
        const a1 = atom(atomId('a', 1), null, {});
        const a2 = atom(atomId('a', 2), null, {});
        const a3 = atom(atomId('a', 3), null, {});

        it('should return the array from the first if it returns an array with at least one item', async () => {
            await storeData(first, 'abc', [a1, a2]);
            await storeData(second, 'abc', [a1, a2, a3]);

            const list = await subject.getObjects('abc', [
                a1.hash,
                a2.hash,
                a3.hash,
            ]);

            expect(list).toEqual([repoAtom(a1), repoAtom(a2), undefined]);
        });

        it('should return the array from the second if the first doesnt have any of the objects', async () => {
            await storeData(second, 'abc', [a1, a2, a3]);

            const list = await subject.getObjects('abc', [
                a1.hash,
                a2.hash,
                a3.hash,
            ]);

            expect(list).toEqual([repoAtom(a1), repoAtom(a2), repoAtom(a3)]);
        });
    });

    describe('getObject()', () => {
        const a1 = atom(atomId('a', 1), null, {});
        const a2 = atom(atomId('a', 2), null, {});

        it('should return the first if it is not null', async () => {
            await storeData(first, 'abc', [a1]);
            await storeData(second, 'abc', [a1, a2]);

            const obj = await subject.getObject(a1.hash);

            expect(obj).toEqual(repoAtom(a1));
        });

        it('should return the second if the first doesnt have the object', async () => {
            await storeData(second, 'abc', [a1, a2]);

            const obj = await subject.getObject(a1.hash);

            expect(obj).toEqual(repoAtom(a1));
        });
    });
});
