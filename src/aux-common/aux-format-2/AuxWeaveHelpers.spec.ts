import {
    Weave,
    atom,
    atomId,
    SiteStatus,
    newSite,
    createAtom,
    iterateCausalGroup,
    Atom,
} from '@casual-simulation/causal-trees/core2';
import { AuxOp, bot, tag, value, deleteOp, insertOp } from './AuxOpTypes';
import {
    findTagNode,
    findValueNode,
    findBotNode,
    findEditPosition,
    calculateOrderedEdits,
} from './AuxWeaveHelpers';
import { createBot } from '../bots';
import reducer from './AuxWeaveReducer';
import { apply } from './AuxStateHelpers';

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

    describe.only('calculateOrderedEdits()', () => {
        let weave: Weave<AuxOp>;

        beforeEach(() => {
            weave = new Weave();
        });

        it('should treat value nodes as a segment', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));
            
            const v1 = atom(atomId('a', 3), t1, value('111'));

            insert(b1, t1, v1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([{ text: '111', atom: v1 }]);
        });

        it('should remove deleted sections from value nodes', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));

            insert(b1, t1, v1, d0);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([{ text: '11', atom: v1 }]);
        });

        it('should not report empty text segments', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const d0 = atom(atomId('a', 4, 1), v1, deleteOp(0, 3));

            insert(b1, t1, v1, d0);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([]);
        });

        it('should support multiple delete atoms on a single value node', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));
            const d1 = atom(atomId('a', 5, 1), v1, deleteOp(2, 3));

            insert(b1, t1, v1, d0, d1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([{ text: '1', atom: v1 }]);
        });

        it('should support overlapping delete atoms on a single value node', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));
            const d1 = atom(atomId('a', 5, 1), v1, deleteOp(1, 3));

            insert(b1, t1, v1, d0, d1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([{ text: '1', atom: v1 }]);
        });

        it('should remove deleted sections from insert nodes', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(1, '222'));
            const d0 = atom(atomId('a', 5, 1), i1, deleteOp(1, 2));

            insert(b1, t1, v1, i1, d0);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '1', atom: v1 },
                { text: '22', atom: i1 },
                { text: '11', atom: v1 },
            ]);
        });

        it('should support multiple delete atoms on a single insert node', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(1, '222'));
            const d0 = atom(atomId('a', 5, 1), i1, deleteOp(1, 2));
            const d1 = atom(atomId('a', 6, 1), i1, deleteOp(2, 3));

            insert(b1, t1, v1, i1, d0, d1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '1', atom: v1 },
                { text: '2', atom: i1 },
                { text: '11', atom: v1 },
            ]);
        });

        it('should support overlapping delete atoms on a single insert node', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(1, '222'));
            const d0 = atom(atomId('a', 5, 1), i1, deleteOp(1, 2));
            const d1 = atom(atomId('a', 6, 1), i1, deleteOp(1, 3));

            insert(b1, t1, v1, i1, d0, d1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '1', atom: v1 },
                { text: '2', atom: i1 },
                { text: '11', atom: v1 },
            ]);
        });

        it('should treat insert nodes as a segment', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(3, '222'));

            insert(b1, t1, v1, i1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '111', atom: v1 },
                { text: '222', atom: i1 },
            ]);
        });

        it('should place insert operations with a zero index before the value operation', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(0, '222'));

            insert(b1, t1, v1, i1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '222', atom: i1 },
                { text: '111', atom: v1 },
            ]);
        });

        it('should split a text segment if an insert is in the middle', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(1, '222'));

            insert(b1, t1, v1, i1);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '1', atom: v1 },
                { text: '222', atom: i1 },
                { text: '11', atom: v1 },
            ]);
        });

        it('should support sibling inserts on a value', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            const i1 = atom(atomId('a', 4), v1, insertOp(1, '222'));
            const i2 = atom(atomId('a', 5), v1, insertOp(2, '333'));

            insert(b1, t1, v1, i1, i2);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '1', atom: v1 },
                { text: '222', atom: i1 },
                { text: '1', atom: v1 },
                { text: '333', atom: i2 },
                { text: '1', atom: v1 },
            ]);
        });

        it('should split inserts and deletes into a sequence of edits', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            // 111
            const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));
            // 11
            const i1 = atom(atomId('a', 5), v1, insertOp(0, '222'));
            // 22211
            const d1 = atom(atomId('a', 6, 1), i1, deleteOp(2, 3));
            // 2211
            const i2 = atom(atomId('a', 7), v1, insertOp(2, '333'));
            // 2213331 - insert is in the middle of v1 because it should apply to "111" and not "11"
            const i3 = atom(atomId('a', 9), i1, insertOp(2, '444'));
            // 2244413331
            const d3 = atom(atomId('a', 10, 1), i3, deleteOp(2, 3));
            // 224413331

            insert(b1, t1, v1, d0, i1, d1, i2, i3, d3);

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '22', atom: i1 },
                { text: '44', atom: i3 },
                { text: '1', atom: v1 },
                { text: '333', atom: i2 },
                { text: '1', atom: v1 },
            ]);
        });

        it('should report the same value as the reducer', () => {
            const b1 = atom(atomId('a', 1), null, bot('test'));
            const t1 = atom(atomId('a', 2), b1, tag('abc'));

            const v1 = atom(atomId('a', 3), t1, value('111'));
            // 111
            const d0 = atom(atomId('a', 4, 1), v1, deleteOp(1, 2));
            // 11
            const i1 = atom(atomId('a', 5), v1, insertOp(0, '222'));
            // 22211
            const d1 = atom(atomId('a', 6, 1), i1, deleteOp(2, 3));
            // 2211
            const i2 = atom(atomId('a', 7), v1, insertOp(2, '333'));
            // 2213331 - insert is in the middle of v1 because it should apply to "111" and not "11"
            const i3 = atom(atomId('a', 9), i1, insertOp(2, '444'));
            // 2244413331
            const d3 = atom(atomId('a', 10, 1), i3, deleteOp(2, 3));
            // 224413331

            let atoms = [b1, t1, v1, d0, i1, d1, i2, i3, d3];
            let state = {};
            for (let atom of atoms) {
                const weaveResult = weave.insert(atom);
                const update = reducer(weave, weaveResult);
                state = apply(state, update);
            }

            const valueNode = weave.getNode(v1.id);
            const nodes = [valueNode, ...iterateCausalGroup(valueNode)];

            const segments = calculateOrderedEdits(nodes);

            const result = segments.map((s) => ({
                text: s.text,
                atom: s.node.atom,
            }));

            expect(result).toEqual([
                { text: '22', atom: i1 },
                { text: '44', atom: i3 },
                { text: '1', atom: v1 },
                { text: '333', atom: i2 },
                { text: '1', atom: v1 },
            ]);
            expect(state).toEqual({
                test: createBot('test', {
                    abc: '224413331',
                }),
            });
        });

        function insert(...atoms: Atom<AuxOp>[]) {
            for (let atom of atoms) {
                const result = weave.insert(atom);
                if (result.type !== 'atom_added') {
                    throw new Error(
                        'Unable to add atom to weave: ' + result.type
                    );
                }
            }
        }
    });
});
