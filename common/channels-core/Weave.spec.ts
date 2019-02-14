import { Weave, WeaveReference } from "./Weave";
import { Atom, AtomId } from "./Atom";

describe('Weave', () => {
    describe('insert()', () => {
        it('should return references', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, {});
            const ref1 = weave.insert(a1);

            expect(ref1).toEqual(new WeaveReference(a1.id, 0));

            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), {});
            const ref2 = weave.insert(a2);

            expect(ref2).toEqual(new WeaveReference(a2.id, 1));

            const a3 = new Atom(new AtomId(2, 3), new AtomId(1, 1), {});
            const ref3 = weave.insert(a3);

            expect(ref3).toEqual(new WeaveReference(a3.id, 1));
        });

        it.skip('should update weave references', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, {});
            const ref1 = weave.insert(a1);

            expect(ref1).toEqual(new WeaveReference(a1.id, 0));

            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), {});
            const ref2 = weave.insert(a2);

            expect(ref2).toEqual(new WeaveReference(a2.id, 1));

            const a3 = new Atom(new AtomId(2, 3), new AtomId(1, 1), {});
            const ref3 = weave.insert(a3);

            expect(ref3).toEqual(new WeaveReference(a3.id, 1));

            // Weave references should be updated automatically
            expect(ref2).toEqual(new WeaveReference(a2.id, 2));
        });

        it('should order atoms based on their timestamp', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, {});
            const ref1 = weave.insert(a1);

            expect(ref1).toEqual(new WeaveReference(a1.id, 0));

            const a3 = new Atom(new AtomId(2, 3), new AtomId(1, 1), {});
            const ref3 = weave.insert(a3);

            expect(ref3).toEqual(new WeaveReference(a3.id, 1));

            // Later atoms should be sorted before earlier ones
            // Therefore when adding an atom with time 2 it should be sorted after atom at time 3.
            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), {});
            const ref2 = weave.insert(a2);

            expect(ref2).toEqual(new WeaveReference(a2.id, 2));
        });

        it('should order atoms based on their site ID if timestamp is equal', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, {});
            const ref1 = weave.insert(a1);

            expect(ref1).toEqual(new WeaveReference(a1.id, 0));

            const a3 = new Atom(new AtomId(2, 2), new AtomId(1, 1), {});
            const ref3 = weave.insert(a3);

            expect(ref3).toEqual(new WeaveReference(a3.id, 1));

            // Lower Site IDs should be sorted before higher ones
            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), {});
            const ref2 = weave.insert(a2);

            expect(ref2).toEqual(new WeaveReference(a2.id, 1));
        });

        it('should consider priority for sorting', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, {});
            const ref1 = weave.insert(a1);

            const a3 = new Atom(new AtomId(2, 4), new AtomId(1, 1), {});
            const ref3 = weave.insert(a3);

            // Lower Site IDs should be sorted before higher ones
            const a2 = new Atom(new AtomId(1, 3), new AtomId(1, 1), {});
            const ref2 = weave.insert(a2);

            const a4 = new Atom(new AtomId(1, 2, 1), new AtomId(1, 1), {});
            const ref4 = weave.insert(a4);

            expect(ref4).toEqual(new WeaveReference(a4.id, 1));
        });

        it('should handle deeply nested atoms', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, {});
            const ref1 = weave.insert(a1);

            expect(ref1).toEqual(new WeaveReference(a1.id, 0));

            const a2 = new Atom(new AtomId(2, 2), new AtomId(1, 1), {});
            const ref2 = weave.insert(a2);

            expect(ref2).toEqual(new WeaveReference(a2.id, 1));

            const a3 = new Atom(new AtomId(2, 3), new AtomId(2, 2), {});
            const ref3 = weave.insert(a3);

            expect(ref3).toEqual(new WeaveReference(a3.id, 2));

            const a4 = new Atom(new AtomId(1, 4), new AtomId(2, 3), {});
            const ref4 = weave.insert(a4);

            expect(ref4).toEqual(new WeaveReference(a4.id, 3));

            const a5 = new Atom(new AtomId(1, 5), new AtomId(1, 1), {});
            const ref5 = weave.insert(a5);

            expect(ref5).toEqual(new WeaveReference(a5.id, 1));
        });
    });

    describe('traverse()', () => {
        // it('should ')
    });
});