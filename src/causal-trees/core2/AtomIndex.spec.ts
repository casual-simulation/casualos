import { atom, atomId } from './Atom2';
import { createIndex, calculateDiff } from './AtomIndex';

describe('AtomIndex', () => {
    describe('createIndex()', () => {
        it('should use the given list of atoms', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});

            const index = createIndex([a1, a2, a3]);
            const index2 = createIndex([a2, a1, a3]);

            expect(index.hash).toMatchInlineSnapshot(
                `"d4e77a49706c9d7b69273bea7affcb5ff2e3c8fc89491a5cd3d729854faaa355"`
            );
            expect(index).toEqual({
                hash: expect.any(String),
                atoms: {
                    'a@1': a1.hash,
                    'a@2': a2.hash,
                    'a@3': a3.hash,
                },
            });

            // Should return the same result no matter the order of atoms.
            expect(index).toEqual(index2);
        });

        it('should support multiple roots', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const b1 = atom(atomId('b', 1), null, {});
            const b2 = atom(atomId('b', 2), b1, {});
            const b3 = atom(atomId('b', 3), b2, {});

            const index = createIndex([a1, a2, a3, b1, b2, b3]);

            expect(index.hash).toMatchInlineSnapshot(
                `"fe9062529831e99f5c293d48daf8b0b6df7f88d364196de5d3da1f472b3b0576"`
            );
            expect(index).toEqual({
                hash: expect.any(String),
                atoms: {
                    'a@1': a1.hash,
                    'a@2': a2.hash,
                    'a@3': a3.hash,
                    'b@1': b1.hash,
                    'b@2': b2.hash,
                    'b@3': b3.hash,
                },
            });
        });
    });

    describe('calculateDiff()', () => {
        it('should return a diff containing the list of atoms that were added and removed', () => {
            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a1, {});

            const otherA3 = atom(atomId('a', 3), a1, {});

            const index = createIndex([a1, a2, a3]);
            const index2 = createIndex([a1, otherA3, a4]);

            const diff = calculateDiff(index, index2);

            expect(diff).toEqual({
                additions: {
                    'a@4': a4.hash,
                },
                changes: {
                    'a@3': otherA3.hash,
                },
                deletions: {
                    'a@2': a2.hash,
                },
            });
        });
    });
});
