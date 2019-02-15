import { Weave, WeaveReference } from "./Weave";
import { Atom, AtomId, AtomOp } from "./Atom";


describe('Weave', () => {

    class Op implements AtomOp {
        type: number;
    }

    describe('insert()', () => {
        it('should return references', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            const a3 = new Atom(new AtomId(2, 3), new AtomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            expect(ref1).toEqual(new WeaveReference(1, 0));
            expect(ref2).toEqual(new WeaveReference(1, 1));
            expect(ref3).toEqual(new WeaveReference(2, 0));

            const atoms = weave.atoms;
            expect(atoms).toEqual([
                a1, a3, a2
            ]);
        });

        it('should order atoms based on their timestamp', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a3 = new Atom(new AtomId(2, 3), new AtomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            // Later atoms should be sorted before earlier ones
            // Therefore when adding an atom with time 2 it should be sorted after atom at time 3.
            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            expect(ref1).toEqual(new WeaveReference(1, 0));
            expect(ref2).toEqual(new WeaveReference(1, 1));
            expect(ref3).toEqual(new WeaveReference(2, 0));

            expect(weave.atoms).toEqual([
                a1, a3, a2
            ]);
        });

        it('should order atoms based on their site ID if timestamp is equal', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            
            const a3 = new Atom(new AtomId(2, 2), new AtomId(1, 1), new Op());
            const ref3 = weave.insert(a3);
            
            // Lower Site IDs should be sorted before higher ones
            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), new Op());
            const ref2 = weave.insert(a2);
            
            expect(ref1).toEqual(new WeaveReference(1, 0));
            expect(ref2).toEqual(new WeaveReference(1, 1));
            expect(ref3).toEqual(new WeaveReference(2, 0));

            expect(weave.atoms).toEqual([
                a1, a2, a3
            ]);
        });

        it('should consider priority for sorting', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a3 = new Atom(new AtomId(2, 4), new AtomId(1, 1), new Op());
            const ref3 = weave.insert(a3);

            const a4 = new Atom(new AtomId(3, 2, 1), new AtomId(1, 1), new Op());
            const ref4 = weave.insert(a4);

            const a2 = new Atom(new AtomId(1, 3), new AtomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            expect(ref1).toEqual(new WeaveReference(1, 0));
            expect(ref2).toEqual(new WeaveReference(1, 1));
            expect(ref3).toEqual(new WeaveReference(2, 0));
            expect(ref4).toEqual(new WeaveReference(3, 0));

            expect(weave.atoms).toEqual([
                a1, a4, a3, a2
            ]);
        });

        it('should handle deeply nested atoms', () => {
            let weave = new Weave();

            const a1 = new Atom(new AtomId(1, 1), null, new Op());
            const ref1 = weave.insert(a1);

            const a2 = new Atom(new AtomId(2, 2), new AtomId(1, 1), new Op());
            const ref2 = weave.insert(a2);

            const a3 = new Atom(new AtomId(2, 3), new AtomId(2, 2), new Op());
            const ref3 = weave.insert(a3);

            const a4 = new Atom(new AtomId(1, 4), new AtomId(2, 3), new Op());
            const ref4 = weave.insert(a4);

            const a5 = new Atom(new AtomId(1, 5), new AtomId(1, 1), new Op());
            const ref5 = weave.insert(a5);

            expect(ref1).toEqual(new WeaveReference(1, 0));
            expect(ref2).toEqual(new WeaveReference(2, 0));
            expect(ref3).toEqual(new WeaveReference(2, 1));
            expect(ref4).toEqual(new WeaveReference(1, 1));
            expect(ref5).toEqual(new WeaveReference(1, 2));

            expect(weave.atoms).toEqual([
                a1, 
                a5, 
                a2, a3, a4
            ]);
        });
    });

    describe('getSite()', () => {
        it('should return atoms in order of their timestamps', () => {
            const a1 = new Atom(new AtomId(1, 1), null, new Op());
            const a2 = new Atom(new AtomId(1, 2), new AtomId(1, 1), new Op());
            const a3 = new Atom(new AtomId(1, 3), new AtomId(1, 1), new Op());
            const a4 = new Atom(new AtomId(1, 4), new AtomId(1, 2), new Op());

            let weave = new Weave();

            weave.insert(a1);
            weave.insert(a3);
            weave.insert(a2);
            weave.insert(a4);

            const site = weave.getSite(1);

            expect(site.get(0)).toEqual(a1);
            expect(site.get(1)).toEqual(a2);
            expect(site.get(2)).toEqual(a3);
            expect(site.get(3)).toEqual(a4);
        });
    });

});