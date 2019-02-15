import { CausalTree } from "./CausalTree";
import { Atom, AtomId, AtomOp } from "./Atom";
import { AtomReducer } from "./AtomReducer";
import { Weave } from './Weave';

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
            const atom = weave.atoms[i];
            if(atom.value.type === OpType.add) {
                val += 1;
            } else if(atom.value.type === OpType.subtract) {
                val -= 1;
            }
        }
        return val;
    }
}

describe('CausalTree', () => {
    describe('insert()', () => {
        it('should update the factory time when adding an atom from another site', () => {
            let tree = new CausalTree(1, new Reducer());

            tree.add(new Atom(new AtomId(2, 3), new AtomId(2, 2), new Op()));

            expect(tree.factory.time).toBe(4);
        });

        it('should not update the factory time when adding an atom from this site', () => {
            let tree = new CausalTree(1, new Reducer());

            tree.add(new Atom(new AtomId(1, 3), new AtomId(1, 2), new Op()));

            expect(tree.factory.time).toBe(0);
        });
    });

    describe('value', () => {
        it('should calculate the value using the reducer', () => {
            let tree = new CausalTree(1, new Reducer());

            const root = tree.add(tree.factory.create(new Op(), null));
            tree.create(new Op(OpType.add), root);
            tree.create(new Op(OpType.subtract), root);
            tree.create(new Op(OpType.add), root);

            expect(tree.value).toBe(1);
        });
    });
});