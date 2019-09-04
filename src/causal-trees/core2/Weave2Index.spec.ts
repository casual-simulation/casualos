import { Weave } from './Weave2';
import { atom, atomId } from './Atom2';
import { batchDiff } from './Weave2Index';

describe('Weave2Index', () => {
    describe('batchDiff()', () => {
        it('should calculate a index diff that contains the added atoms', () => {
            let weave = new Weave();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});

            const r1 = weave.insert(a1);
            const r2 = weave.insert(a2);

            const diff = batchDiff([r1, r2]);

            expect(diff).toEqual({
                additions: [a1, a2],
                deletions: {},
            });
        });

        it('should calculate a index diff that does not contain duplicate atoms', () => {
            let weave = new Weave();

            const a1 = atom(atomId('a', 1), null, {});

            const r1 = weave.insert(a1);
            const r2 = weave.insert(a1);

            const diff = batchDiff([r1, r2]);

            expect(diff).toEqual({
                additions: [a1],
                deletions: {},
            });
        });

        it('should calculate a index diff that contains atoms added and removed from conflicts', () => {
            let weave = new Weave();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const aa2 = atom(atomId('a', 2), a1, {
                abc: 'def',
            });

            const r1 = weave.insert(a1);
            const r2 = weave.insert(a2);
            const r3 = weave.insert(a3);
            const r4 = weave.insert(a4);
            const r5 = weave.insert(aa2);

            const diff = batchDiff([r1, r2, r3, r4, r5]);

            expect(diff).toEqual({
                additions: [a1, aa2],
                deletions: {},
            });
        });

        it('should not allow duplicates for conflicts where no atoms are added or removed', () => {
            let weave = new Weave();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});
            const aa2 = atom(atomId('a', 2), a1, {
                a: 'def',
            });

            const r1 = weave.insert(a1);
            const r2 = weave.insert(a2);
            const r3 = weave.insert(a3);
            const r4 = weave.insert(a4);
            const r5 = weave.insert(aa2);

            const diff = batchDiff([r1, r2, r3, r4, r5]);

            expect(diff).toEqual({
                additions: [a1, a2, a3, a4],
                deletions: {},
            });
        });

        it('should remove deleted atoms', () => {
            let weave = new Weave();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});

            const r1 = weave.insert(a1);
            const r2 = weave.insert(a2);
            const r3 = weave.insert(a3);
            const r4 = weave.insert(a4);
            const r5 = weave.remove(a3);

            const diff = batchDiff([r1, r2, r3, r4, r5]);

            expect(diff).toEqual({
                additions: [a1, a2, a4],
                deletions: {},
            });
        });

        it('should add deleted atoms to the deleted list', () => {
            let weave = new Weave();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const a3 = atom(atomId('a', 3), a2, {});
            const a4 = atom(atomId('a', 4), a2, {});

            const r1 = weave.insert(a1);
            const r2 = weave.insert(a2);
            const r3 = weave.insert(a3);
            const r4 = weave.insert(a4);
            const r5 = weave.remove(a3);

            const diff = batchDiff([r5]);

            expect(diff).toEqual({
                additions: [],
                deletions: {
                    [a3.hash]: 'a@3',
                },
            });
        });
    });
});
