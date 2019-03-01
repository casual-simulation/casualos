import { CausalTree } from "./CausalTree";
import { Atom, AtomId, AtomOp, atomId, atom } from "./Atom";
import { AtomReducer } from "./AtomReducer";
import { Weave, WeaveReference } from './Weave';
import { site } from './SiteIdInfo';
import { storedTree } from "./StoredCausalTree";
import { precalculatedOp } from "./PrecalculatedOp";

enum OpType {
    root = 0,
    add = 1,
    subtract = 2
}

class Op implements AtomOp {
    type: number;

    constructor(type: OpType = OpType.root) {
        this.type = type;
    }
}

class Reducer implements AtomReducer<Op, number> {
    eval(weave: Weave<Op>): number {
        let val = 0;
        for (let i = 0; i < weave.atoms.length; i++) {
            const ref = weave.atoms[i];
            if(ref.atom.value.type === OpType.add) {
                val += 1;
            } else if(ref.atom.value.type === OpType.subtract) {
                val -= 1;
            }
        }
        return val;
    }
}

describe('CausalTree', () => {

    describe('constructor', () => {
        it('should import the given weave', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            const root = tree1.factory.create(new Op(), null); // Time 1
            tree1.add(root);

            let tree2 = new CausalTree(storedTree(site(2), null, tree1.weave.atoms), new Reducer());

            expect(tree2.weave.atoms.map(r => r.atom)).toEqual([
                root
            ]);
        });

        it('should add the given known sites to the known sites list', () => {
            let tree1 = new CausalTree(storedTree(site(1), [
                site(2),
                site(1)
            ]), new Reducer());

            expect(tree1.knownSites).toEqual([
                { id: 1 },
                { id: 2 }
            ]);
        });
    });

    describe('add()', () => {
        it('should update the factory time when adding an atom from another site', () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            tree.add(atom(atomId(2, 3), atomId(2, 2), new Op()));

            expect(tree.factory.time).toBe(4);
        });

        it('should not update the factory time when adding an atom from this site', () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            tree.add(atom(atomId(1, 3), atomId(1, 2), new Op()));

            expect(tree.factory.time).toBe(0);
        });

        it('should trigger an event when an atom gets added', () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            let refs: WeaveReference<Op>[] = [];
            tree.atomAdded.subscribe(ref => {
                refs.push(ref);
            });

            // no parent so it's skipped
            const skipped = tree.add(atom(atomId(1, 3), atomId(1, 2), new Op()));

            const root = tree.add(atom(atomId(1, 3), null, new Op()));
            const child = tree.add(atom(atomId(1, 4), atomId(1, 3), new Op()));

            expect(refs).toEqual([
                root,
                child
            ]);
        });
    });

    describe('value', () => {
        it('should calculate the value using the reducer', () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            const root = tree.add(tree.factory.create(new Op(), null));
            tree.create(new Op(OpType.add), root);
            tree.create(new Op(OpType.subtract), root);
            tree.create(new Op(OpType.add), root);

            expect(tree.value).toBe(1);
        });
    });

    describe('import()', () => {
        it('should update the current time based on the given references', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = tree1.factory.create(new Op(), null); // Time 1
            tree1.add(root);
            tree2.add(root); // Time 2

            tree2.add(tree2.factory.create(new Op(OpType.add), root)); // Time 3
            tree2.add(tree2.factory.create(new Op(OpType.add), root)); // Time 4
            tree2.add(tree2.factory.create(new Op(OpType.subtract), root)); // Time 5

            tree1.importWeave(tree2.weave.atoms);

            expect(tree1.time).toBe(6);
        });

        it('should update the current time even when importing from the same site', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            let tree2 = new CausalTree(storedTree(site(1)), new Reducer());

            const root = tree1.factory.create(new Op(), null); // Time 1
            tree1.add(root);
            tree2.add(root); // Time 2
            
            tree2.factory.updateTime(1);

            tree2.add(tree2.factory.create(new Op(OpType.add), root)); // Time 3
            tree2.add(tree2.factory.create(new Op(OpType.add), root)); // Time 4
            tree2.add(tree2.factory.create(new Op(OpType.subtract), root)); // Time 5

            tree1.importWeave(tree2.weave.atoms);

            expect(tree1.time).toBe(6);
        });

        it('should not update the current time when importing duplicates', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = tree1.factory.create(new Op(), null); // Time 1
            tree1.add(root);
            tree2.add(root); // Time 2

            tree2.add(tree2.factory.create(new Op(OpType.add), root)); // Time 3
            tree2.add(tree2.factory.create(new Op(OpType.add), root)); // Time 4
            tree2.add(tree2.factory.create(new Op(OpType.subtract), root)); // Time 5

            tree1.importWeave(tree2.weave.atoms);
            tree1.importWeave(tree2.weave.atoms);

            expect(tree1.time).toBe(6);
        });
    });

    describe('knownSites', () => {
        it('should default to only our site ID', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            expect(tree1.knownSites).toEqual([
                { id: 1 }
            ]);
        });
        
        it('should not combine with the weaves known sites', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = tree1.factory.create(new Op(), null);
            tree1.add(root);
            tree2.add(root);

            expect(tree2.knownSites).toEqual([
                { id: 2 }
            ]);
        });

        it('should allow adding sites via registerSite()', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            tree1.registerSite(site(12));

            expect(tree1.knownSites).toEqual([
                { id: 1 },
                { id: 12 }
            ]);
        });

        it('should ignore duplicate sites', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            tree1.registerSite(site(1));

            expect(tree1.knownSites).toEqual([
                { id: 1 }
            ]);
        });
    });

    describe('createFromPrecalculated()', () => {
        it('should add the given op to the tree', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            tree1.createFromPrecalculated(precalculatedOp(
                new Op(),
            ));

            expect(tree1.weave.atoms.length).toBe(1);
        });
    });
});