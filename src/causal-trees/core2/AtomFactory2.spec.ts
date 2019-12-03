import { AtomFactory } from './AtomFactory2';
import { AtomId, atomId, atom } from './Atom2';

describe('AtomFactory2', () => {
    it('should maintain the current lamport time', () => {
        const factory = new AtomFactory('1', 0);

        const root = atom(atomId('1', 0), null, {});

        // Got event from remote
        const a1 = atom(atomId('2', 1), root, {});
        factory.updateTime(a1);

        expect(factory.time).toBe(2);

        const a2 = atom(atomId('2', 2), root, {});
        factory.updateTime(a2);

        expect(factory.time).toBe(3);

        // We got two concurrent events
        const a3 = atom(atomId('3', 2), root, {});
        factory.updateTime(a3);
        expect(factory.time).toBe(4);

        // We got new event from current site
        const a4 = atom(atomId('1', 7), root, {});
        factory.updateTime(a4);

        // Doesn't increment time to atom.time + 1 because it was a local event
        expect(factory.time).toBe(7);
    });

    it('should increment the time after creating events', async () => {
        const factory = new AtomFactory('1', 0);

        const op = {};
        const atom = await factory.create(op, null);

        expect(atom.id.site).toBe('1');
        expect(atom.id.timestamp).toBe(1);
        expect(atom.id.priority).toBeUndefined();
        expect(atom.value).toBe(op);
        expect(factory.time).toBe(1);
    });

    it('should create atoms with the given cause', async () => {
        const factory = new AtomFactory('1', 0);

        const op = {};
        const root = await factory.create(op, null);

        const op2 = {};
        const atom = await factory.create(op2, root);

        expect(atom.id.site).toBe('1');
        expect(atom.id.timestamp).toBe(2);
        expect(atom.id.priority).toBeUndefined();
        expect(atom.cause).toBe(root.id);
        expect(atom.value).toBe(op2);
        expect(factory.time).toBe(2);
    });

    it('should create atoms with the given priority', async () => {
        const factory = new AtomFactory('1', 0);

        const op = {};
        const root = await factory.create(op, null);

        const op2 = {};
        const atom = await factory.create(op2, root, 10);

        expect(atom.id.site).toBe('1');
        expect(atom.id.timestamp).toBe(2);
        expect(atom.id.priority).toBe(10);
        expect(atom.cause).toBe(root.id);
        expect(atom.value).toBe(op2);
        expect(factory.time).toBe(2);
    });
});
