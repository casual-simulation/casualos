import { Weave } from "./Weave";
import { Atom, AtomId } from "./Atom";

describe('Weave', () => {
    describe('insert()', () => {
        it('should return references', () => {
            let weave = new Weave();

            const ref1 = weave.insert(new Atom(new AtomId(1, 1), null, {}));

            expect(ref1).toMatchObject({
                id: new AtomId(1, 1),
                index: 0
            });

            const ref2 = weave.insert(new Atom(new AtomId(1, 2), new AtomId(1, 1), {}));

            expect(ref2).toMatchObject({
                id: new AtomId(1, 2),
                index: 1
            });

            const ref3 = weave.insert(new Atom(new AtomId(2, 3), new AtomId(1, 1), {}));

            expect(ref3).toMatchObject({
                id: new AtomId(2, 3),
                index: 1
            });
        });

        it('should order atoms based on their site ID and timestamp', () => {
            let weave = new Weave();

            const ref1 = weave.insert(new Atom(new AtomId(1, 1), null, {}));

            expect(ref1).toMatchObject({
                id: new AtomId(1, 1),
                index: 0
            });

            const ref3 = weave.insert(new Atom(new AtomId(2, 3), new AtomId(1, 1), {}));

            expect(ref3).toMatchObject({
                id: new AtomId(2, 3),
                index: 1
            });

            // Later atoms should be sorted before earlier ones
            // Therefore when adding an atom with time 2 it should be sorted after atom at time 3.
            const ref2 = weave.insert(new Atom(new AtomId(1, 2), new AtomId(1, 1), {}));

            expect(ref2).toMatchObject({
                id: new AtomId(1, 2),
                index: 2
            });
        });

        it('should map atoms into different sites', () => {
            let weave = new Weave();

            // weave.insert(new Atom(new AtomId(1, 1), null, {});
        });
    });
});