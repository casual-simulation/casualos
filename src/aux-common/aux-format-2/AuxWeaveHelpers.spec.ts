import {
    Weave,
    atom,
    atomId,
    SiteStatus,
    newSite,
    createAtom,
} from '@casual-simulation/causal-trees/core2';
import { AuxOp, bot, tag, value, deleteOp, insertOp } from './AuxOpTypes';
import {
    findTagNode,
    findValueNode,
    findBotNode,
    findEditPosition,
} from './AuxWeaveHelpers';
import { createBot } from '../bots';

describe('AuxWeaveHelpers', () => {
    describe('findBotNode()', () => {
        let weave: Weave<AuxOp>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should find the first node that defines the given bot', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));

            weave.insert(b1);

            const result = findBotNode(weave, 'test');

            expect(result.atom).toBe(b1);
        });

        it('should find the first node that defines the given bot that is not deleted', () => {
            const b1A = atom(atomId('a', 1), null, bot('test'));
            const del1A = atom(atomId('a', 2), b1A, deleteOp());
            const b1B = atom(atomId('a', 3), null, bot('test'));

            weave.insert(b1A);
            weave.insert(del1A);
            weave.insert(b1B);

            const result = findBotNode(weave, 'test');

            expect(result.atom).toBe(b1B);
        });

        it('should return null if no bots match the given ID', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));

            weave.insert(b1);

            const result = findBotNode(weave, 'missing');

            expect(result).toBe(null);
        });
    });

    describe('findTagNode()', () => {
        let weave: Weave<AuxOp>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should find the first node that defines the given tag', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            weave.insert(b1);
            weave.insert(t1);
            const botNode = weave.getNode(b1.id);

            const result = findTagNode(botNode, 'abc');

            expect(result.atom).toBe(t1);
        });

        it('should return null if no tags match the given name', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            weave.insert(b1);
            weave.insert(t1);
            const botNode = weave.getNode(b1.id);

            const result = findTagNode(botNode, 'missing');

            expect(result).toBe(null);
        });
    });

    describe('findValueNode()', () => {
        let weave: Weave<AuxOp>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should find the last value node for the given tag', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));
            const v1 = atom(atomId('a', 3), t1, value('123'));
            const v2 = atom(atomId('a', 4), t1, value('999'));

            weave.insert(b1);
            weave.insert(t1);
            weave.insert(v1);
            weave.insert(v2);

            const tagNode = weave.getNode(t1.id);

            const result = findValueNode(tagNode);

            expect(result.atom).toBe(v2);
        });

        it('should return null if no tags are value tags', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            weave.insert(b1);
            weave.insert(t1);

            const tagNode = weave.getNode(t1.id);

            const result = findValueNode(tagNode);

            expect(result).toBe(null);
        });
    });

    describe('findEditPosition()', () => {
        let weave: Weave<AuxOp>;

        beforeEach(() => {
            weave = new Weave();
        });

        const b1 = atom(atomId('a', 1), null, bot('test'));
        const t1 = atom(atomId('a', 2), b1, tag('abc'));
        const v1 = atom(atomId('a', 3), t1, value('111'));
        const i1 = atom(atomId('a', 4), v1, insertOp(0, '222'));
        const i2 = atom(atomId('a', 5), v1, insertOp(2, '333'));
        // value: 22211333

        const cases = [
            // [timestamp, index, expectedAtom, expectedIndex]
            [3, 0, v1, 0] as const,
            [3, 1, v1, 1] as const,
            [4, 0, i1, 0] as const,
            [4, 1, i1, 1] as const,
            [4, 3, i1, 3] as const,
            [4, 4, v1, 1] as const,
            [5, 0, i1, 0] as const,
            [5, 1, i1, 1] as const,
            [5, 3, i1, 3] as const,
            [5, 5, v1, 3] as const,
            [5, 6, i2, 1] as const,
            [5, 7, i2, 2] as const,
        ];
        it('should find the insert atom that the given index is pointing to', () => {
            weave.insert(b1);
            weave.insert(t1);
            weave.insert(v1);
            weave.insert(i1);
            weave.insert(i2);

            const valueNode = weave.getNode(v1.id);

            for (let [timestamp, index, expectedAtom, expectedIndex] of cases) {
                const result = findEditPosition(valueNode, timestamp, index);
                expect(result.atom).toBe(expectedAtom);
                expect(result.index).toBe(expectedIndex);
            }
        });
    });
});
