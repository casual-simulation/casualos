import { AtomFactory } from "./AtomFactory";
import { AtomOp, AtomId } from "./Atom";

class Op implements AtomOp {
    type: number;
}

describe('AtomFactory', () => {
    it('should maintain the current lamport time', () => {
        const factory = new AtomFactory(1, 0);

        // Got event from remote
        factory.updateTime(1);

        expect(factory.time).toBe(2);

        factory.updateTime(2);

        expect(factory.time).toBe(3);

        // We got two concurrent events
        factory.updateTime(2);

        expect(factory.time).toBe(4);
    });

    it('should increment the time after creating events', () => {
        const factory = new AtomFactory(1, 0);

        const op = new Op();
        const atom = factory.create(op, null);

        expect(atom.id.site).toBe(1);
        expect(atom.id.timestamp).toBe(1);
        expect(atom.id.priority).toBe(0);
        expect(atom.value).toBe(op);
        expect(factory.time).toBe(1);
    });

    it('should create atoms with the given cause', () => {
        const factory = new AtomFactory(1, 0);

        const op = new Op();
        const root = factory.create(op, null);

        const op2 = new Op();
        const atom = factory.create(op2, root);

        expect(atom.id.site).toBe(1);
        expect(atom.id.timestamp).toBe(2);
        expect(atom.id.priority).toBe(0);
        expect(atom.cause).toBe(root.id);
        expect(atom.value).toBe(op2);
        expect(factory.time).toBe(2);
    });

    it('should create atoms with the given cause ID', () => {
        const factory = new AtomFactory(1, 0);

        factory.updateTime(1);

        const op2 = new Op();
        const atom = factory.create(op2, new AtomId(2, 1));

        expect(atom.id.site).toBe(1);
        expect(atom.id.timestamp).toBe(3);
        expect(atom.id.priority).toBe(0);
        expect(atom.cause).toEqual(new AtomId(2, 1));
        expect(atom.value).toBe(op2);
        expect(factory.time).toBe(3);
    });
});