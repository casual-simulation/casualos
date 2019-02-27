import { Weave } from "../channels-core/Weave";
import { AuxOp } from "./AuxOpTypes";
import { AuxReducer, calculateSequenceRef } from "./AuxReducer";
import { WeaveTraverser } from "../channels-core/WeaveTraverser";
import { AuxCausalTree } from "./AuxCausalTree";
import { storedTree } from "../channels-core/StoredCausalTree";
import { site } from "../channels-core/SiteIdInfo";
import { AuxSequenceMetadata } from "./AuxState";

describe('AuxReducer', () => {

    describe('evalSequence', () => {
        let reducer: AuxReducer;
        let site1: AuxCausalTree;
        let traverser: WeaveTraverser<AuxOp>;

        beforeEach(() => {
            reducer = new AuxReducer();
            site1 = new AuxCausalTree(storedTree(site(1)));
            traverser = new WeaveTraverser(site1.weave);
        });

        it('should return the initial value if there are no children', () => {
            const root = site1.val('abc', null);
            const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
            expect(value).toBe('abc');
            expect(meta).toEqual([ 
                { start: 0, end: 3, ref: root }
            ]);
        });

        describe('single insert', () => {
           
            it('should handle single inserts at the beginning of the string', () => {
                const root = site1.val('abc', null);
                const insert = site1.insert(0, '123', root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('123abc');
                expect(meta).toEqual([
                    { start: 0, end: 3, ref: insert },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle single inserts in the middle of the string', () => {
                const root = site1.val('abc', null);
                const insert = site1.insert(2, '123', root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('ab123c');
                expect(meta).toEqual([
                    { start: 2, end: 5, ref: insert },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle single inserts at the end of the string', () => {
                const root = site1.val('abc', null);
                const insert = site1.insert(3, '123', root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('abc123');
                expect(meta).toEqual([
                    { start: 3, end: 6, ref: insert },
                    { start: 0, end: 3, ref: root }
                ]);
            });
        });

        
        describe('multiple insertions', () => {
            it('should handle multiple insertions at the beginning', () => {
                const root = site1.val('abc', null);
                const insert1 = site1.insert(0, '123', root.atom);
                const insert2 = site1.insert(0, '456', root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);

                // 456 appears after 123 because both insertions are on
                // the root.
                expect(value).toBe('123456abc');
                expect(meta).toEqual([
                    { start: 0, end: 3, ref: insert1 },
                    { start: 0, end: 3, ref: insert2 },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle multiple insertions at the end', () => {
                const root = site1.val('abc', null);
                const insert1 = site1.insert(3, '123', root.atom);
                const insert2 = site1.insert(3, '456', root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('abc123456');
                expect(meta).toEqual([
                    { start: 3, end: 6, ref: insert1 },
                    { start: 3, end: 6, ref: insert2 },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle multiple insertions in the middle', () => {
                const root = site1.val('abc', null);
                const insert1 = site1.insert(1, '123', root.atom);
                const insert2 = site1.insert(1, '456', root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('a123456bc');
                expect(meta).toEqual([
                    { start: 1, end: 4, ref: insert1 },
                    { start: 1, end: 4, ref: insert2 },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle chained insertions at the beginning', () => {
                const root = site1.val('abc', null);
                const first = site1.insert(0, '123', root.atom);
                const second = site1.insert(0, '456', first.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('456123abc');
                expect(meta).toEqual([
                    { start: 0, end: 3, ref: second },
                    { start: 0, end: 3, ref: first },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle chained insertions at the end of the intermediate string', () => {
                const root = site1.val('abc', null);
                const first = site1.insert(0, '123', root.atom);
                const second = site1.insert(3, '456', first.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('123456abc');
                expect(meta).toEqual([
                    { start: 3, end: 6, ref: second },
                    { start: 0, end: 3, ref: first },
                    { start: 0, end: 3, ref: root }
                ]);
            });

            it('should handle chained insertions in the middle of the intermediate string', () => {
                const root = site1.val('abc', null);
                const first = site1.insert(0, '123', root.atom);
                const second = site1.insert(2, '456', first.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('124563abc');
                expect(meta).toEqual([
                    { start: 2, end: 5, ref: second },
                    { start: 0, end: 3, ref: first },
                    { start: 0, end: 3, ref: root }
                ]);
            });
        });

        describe('single delete', () => {
 
            it('should handle single deletions for the entire string without indicies', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('');
                expect(meta).toEqual([
                    { start: 0, end: 0, ref: root }
                ]);
            });

            it('should handle single deletions for the entire string with indicies', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('');
                expect(meta).toEqual([
                    { start: 0, end: 0, ref: root }
                ]);
            });

            it('should handle single deletions for the beginning of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('bc');
                expect(meta).toEqual([
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should handle single deletions for the middle of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 1, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('ac');
                expect(meta).toEqual([
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should handle single deletions for the end of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 2, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('ab');
                expect(meta).toEqual([
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should handle negative start indicies', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, -1, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('');
                expect(meta).toEqual([
                    { start: 0, end: 0, ref: root }
                ]);
            });

            it('should handle end further than the end of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 4);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('');
                expect(meta).toEqual([
                    { start: 0, end: -1, ref: root }
                ]);
            });
        });

        describe('multiple delete', () => {
            it('should combine deletes at the beginning', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('bc');
                expect(meta).toEqual([
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should combine deletes at the end', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 2, 3);
                site1.delete(root.atom, 2, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('ab');
                expect(meta).toEqual([
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should combine deletes in the middle', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 1, 2);
                site1.delete(root.atom, 1, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('ac');
                expect(meta).toEqual([
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should preserve overlapping deletes at the beginning', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 0, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('c');
                expect(meta).toEqual([
                    { start: 0, end: 1, ref: root }
                ]);
            });

            it('should preserve overlapping deletes at the end', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 2, 3);
                site1.delete(root.atom, 1, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('a');
                expect(meta).toEqual([
                    { start: 0, end: 1, ref: root }
                ]);
            });

            it('should preserve overlapping deletes anywhere', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 0, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('');
                expect(meta).toEqual([
                    { start: 0, end: 0, ref: root }
                ]);
            });

            it('should preserve sequential deletes', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 1, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('c');
                expect(meta).toEqual([
                    { start: 0, end: 1, ref: root }
                ]);
            });
        });

        describe('mixed', () => {
            it('should process deletes before inserts', () => {
                const root = site1.val('abc', null);
                const insert = site1.insert(0, '123', root.atom);
                site1.delete(root.atom, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('123bc');
                expect(meta).toEqual([
                    { start: 0, end: 3, ref: insert },
                    { start: 0, end: 2, ref: root }
                ]);
            });

            it('should handle chaining deletes onto inserts', () => {
                const root = site1.val('abc', null);
                const insert1 = site1.insert(3, '456', root.atom);
                const insert2 = site1.insert(0, '123', root.atom);
                site1.delete(root.atom, 1, 2);
                site1.delete(insert1.atom, 2, 3);
                site1.delete(insert2.atom, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(value).toBe('23ac45');
                expect(meta).toEqual([
                    { start: 4, end: 6, ref: insert1 },
                    { start: 0, end: 2, ref: insert2 },
                    { start: 0, end: 2, ref: root }
                ]);
            });
        });

        describe('calculateSequenceRef', () => {
            it('should return the root if there are no other inserts', () => {
                const root = site1.val('abc', null);
                const meta: AuxSequenceMetadata[] = [
                    { start: 0, end: 3, ref: root }
                ];

                expect(calculateSequenceRef(meta, 0)).toEqual({ ref: root, index: 0 });
                expect(calculateSequenceRef(meta, 1)).toEqual({ ref: root, index: 1 });
                expect(calculateSequenceRef(meta, 2)).toEqual({ ref: root, index: 2 });
                expect(calculateSequenceRef(meta, 3)).toEqual({ ref: root, index: 3 });
            });

            it('should return the last valid index if the insert index is after the sequence', () => {
                const root = site1.val('abc', null);
                const meta: AuxSequenceMetadata[] = [
                    { start: 0, end: 3, ref: root }
                ];

                expect(calculateSequenceRef(meta, 4)).toEqual({ ref: root, index: 3 });
            });

            it('should return the first valid index if the insert index is before the sequence', () => {
                const root = site1.val('abc', null);
                const meta: AuxSequenceMetadata[] = [
                    { start: 0, end: 3, ref: root }
                ];

                expect(calculateSequenceRef(meta, -1)).toEqual({ ref: root, index: 0 });
            });

            it('should return the first valid index if there is nowhere to place the text', () => {
                const root = site1.val('abc', null);
                const meta: AuxSequenceMetadata[] = [
                    { start: 0, end: 0, ref: root }
                ];

                expect(calculateSequenceRef(meta, 1)).toEqual({ ref: root, index: 0 });
            });

            it('should return the index within a sequence after another sequence', () => {
                const root = site1.val('abc', null);
                const insert1 = site1.insert(3, '456', root.atom);
                const insert2 = site1.insert(0, '123', root.atom);
                site1.delete(root.atom, 1, 2);
                site1.delete(insert1.atom, 2, 3);
                site1.delete(insert2.atom, 0, 1);

                // text: "23ac45"
                const meta: AuxSequenceMetadata[] = [
                    { start: 4, end: 6, ref: insert1 },
                    { start: 0, end: 2, ref: insert2 },
                    { start: 0, end: 2, ref: root }
                ];

                expect(calculateSequenceRef(meta, 0)).toEqual({ ref: insert2, index: 0 });
                expect(calculateSequenceRef(meta, 1)).toEqual({ ref: insert2, index: 1 });
                expect(calculateSequenceRef(meta, 2)).toEqual({ ref: insert2, index: 2 });
                expect(calculateSequenceRef(meta, 3)).toEqual({ ref: root, index: 1 });
                expect(calculateSequenceRef(meta, 4)).toEqual({ ref: insert1, index: 0 });
                expect(calculateSequenceRef(meta, 5)).toEqual({ ref: insert1, index: 1 });
                expect(calculateSequenceRef(meta, 6)).toEqual({ ref: insert1, index: 2 });
            });
        });
    });
});