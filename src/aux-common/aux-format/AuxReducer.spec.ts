import { Weave } from '../causal-trees/Weave';
import { AuxOp } from './AuxOpTypes';
import {
    AuxReducer,
    calculateSequenceRef,
    calculateSequenceRefs,
    AuxReducerMetadata,
} from './AuxReducer';
import { WeaveTraverser } from '../causal-trees/WeaveTraverser';
import { AuxCausalTree } from './AuxCausalTree';
import { storedTree } from '../causal-trees/StoredCausalTree';
import { site } from '../causal-trees/SiteIdInfo';
import { AuxSequenceMetadata } from './AuxState';

describe('AuxReducer', () => {
    describe('evalSequence', () => {
        let reducer: AuxReducer;
        let site1: AuxCausalTree;
        let traverser: WeaveTraverser<AuxOp>;
        let metadata: AuxReducerMetadata;

        beforeEach(() => {
            reducer = new AuxReducer();
            site1 = new AuxCausalTree(storedTree(site(1)));
            traverser = new WeaveTraverser(site1.weave);
            metadata = {
                cache: new Map(),
            };
        });

        it('should return the initial value if there are no children', async () => {
            const { added: root } = await site1.val('abc', null);
            const { value, meta } = reducer.evalSequence(
                traverser,
                root,
                root.value.value,
                metadata
            );
            expect(value).toBe('abc');
            expect(meta).toEqual({
                indexes: [0, 1, 2],
                refs: [root, root, root],
            });
        });

        it('should preserve non string values if possible', async () => {
            const obj = {
                num: 123,
                b: true,
                str: 'abc',
            };
            const { added: root } = await site1.val(obj, null);

            traverser.next();

            const { value, meta } = reducer.evalSequence(
                traverser,
                root,
                root.value.value,
                metadata
            );
            expect(value).toBe(obj);
            expect(meta).toEqual(null);
        });

        describe('single insert', () => {
            it('should handle single inserts at the beginning of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert } = await site1.insert(0, '123', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('123abc');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2],
                    refs: [insert, insert, insert, root, root, root],
                });
            });

            it('should handle single inserts in the middle of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert } = await site1.insert(2, '123', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('ab123c');
                expect(meta).toEqual({
                    indexes: [0, 1, 0, 1, 2, 2],
                    refs: [root, root, insert, insert, insert, root],
                });
            });

            it('should handle single inserts at the end of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert } = await site1.insert(3, '123', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('abc123');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2],
                    refs: [root, root, root, insert, insert, insert],
                });
            });

            it('should convert the value a string if something is inserted', async () => {
                const { added: root } = await site1.val(987, null);
                const { added: insert } = await site1.insert(3, '123', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('987123');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2],
                    refs: [root, root, root, insert, insert, insert],
                });
            });
        });

        describe('multiple insertions', () => {
            it('should handle multiple insertions at the beginning', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert1 } = await site1.insert(0, '123', root);
                const { added: insert2 } = await site1.insert(0, '456', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                // 456 appears after 123 because both insertions are on
                // the root.
                expect(value).toBe('123456abc');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2, 0, 1, 2],
                    refs: [
                        insert1,
                        insert1,
                        insert1,
                        insert2,
                        insert2,
                        insert2,
                        root,
                        root,
                        root,
                    ],
                });
            });

            it('should handle multiple insertions at the end', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert1 } = await site1.insert(3, '123', root);
                const { added: insert2 } = await site1.insert(3, '456', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('abc123456');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2, 0, 1, 2],
                    refs: [
                        root,
                        root,
                        root,
                        insert1,
                        insert1,
                        insert1,
                        insert2,
                        insert2,
                        insert2,
                    ],
                });
            });

            it('should handle multiple insertions in the middle', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert1 } = await site1.insert(1, '123', root);
                const { added: insert2 } = await site1.insert(1, '456', root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('a123456bc');
                expect(meta).toEqual({
                    indexes: [0, 0, 1, 2, 0, 1, 2, 1, 2],
                    refs: [
                        root,
                        insert1,
                        insert1,
                        insert1,
                        insert2,
                        insert2,
                        insert2,
                        root,
                        root,
                    ],
                });
            });

            it('should handle chained insertions at the beginning', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: first } = await site1.insert(0, '123', root);
                const { added: second } = await site1.insert(0, '456', first);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('456123abc');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2, 0, 1, 2],
                    refs: [
                        second,
                        second,
                        second,
                        first,
                        first,
                        first,
                        root,
                        root,
                        root,
                    ],
                });
            });

            it('should handle chained insertions at the end of the intermediate string', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: first } = await site1.insert(0, '123', root);
                const { added: second } = await site1.insert(3, '456', first);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('123456abc');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 0, 1, 2, 0, 1, 2],
                    refs: [
                        first,
                        first,
                        first,
                        second,
                        second,
                        second,
                        root,
                        root,
                        root,
                    ],
                });
            });

            it('should handle chained insertions in the middle of the intermediate string', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: first } = await site1.insert(0, '123', root);
                const { added: second } = await site1.insert(2, '456', first);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('124563abc');
                expect(meta).toEqual({
                    indexes: [0, 1, 0, 1, 2, 2, 0, 1, 2],
                    refs: [
                        first,
                        first,
                        second,
                        second,
                        second,
                        first,
                        root,
                        root,
                        root,
                    ],
                });
            });
        });

        describe('single delete', () => {
            it('should handle single deletions for the entire string without indicies', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('');
                expect(meta).toEqual({
                    indexes: [],
                    refs: [],
                });
            });

            it('should handle single deletions for the entire string with indicies', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('');
                expect(meta).toEqual({
                    indexes: [],
                    refs: [],
                });
            });

            it('should handle single deletions for the beginning of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('bc');
                expect(meta).toEqual({
                    indexes: [1, 2],
                    refs: [root, root],
                });
            });

            it('should handle single deletions for the middle of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 1, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('ac');
                expect(meta).toEqual({
                    indexes: [0, 2],
                    refs: [root, root],
                });
            });

            it('should handle single deletions for the end of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 2, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('ab');
                expect(meta).toEqual({
                    indexes: [0, 1],
                    refs: [root, root],
                });
            });

            it('should handle negative start indicies', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, -1, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('');
                expect(meta).toEqual({
                    indexes: [],
                    refs: [],
                });
            });

            it('should handle end further than the end of the string', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 4);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('');
                expect(meta).toEqual({
                    indexes: [],
                    refs: [],
                });
            });
        });

        describe('multiple delete', () => {
            it('should combine deletes at the beginning', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 1);
                await site1.delete(root, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('bc');
                expect(meta).toEqual({
                    indexes: [1, 2],
                    refs: [root, root],
                });
            });

            it('should combine deletes at the end', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 2, 3);
                await site1.delete(root, 2, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('ab');
                expect(meta).toEqual({
                    indexes: [0, 1],
                    refs: [root, root],
                });
            });

            it('should combine deletes in the middle', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 1, 2);
                await site1.delete(root, 1, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('ac');
                expect(meta).toEqual({
                    indexes: [0, 2],
                    refs: [root, root],
                });
            });

            it('should preserve overlapping deletes at the beginning', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 1);
                await site1.delete(root, 0, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('c');
                expect(meta).toEqual({
                    indexes: [2],
                    refs: [root],
                });
            });

            it('should preserve overlapping deletes at the end', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 2, 3);
                await site1.delete(root, 1, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('a');
                expect(meta).toEqual({
                    indexes: [0],
                    refs: [root],
                });
            });

            it('should preserve overlapping deletes anywhere', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 1);
                await site1.delete(root, 0, 3);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('');
                expect(meta).toEqual({
                    indexes: [],
                    refs: [],
                });
            });

            it('should preserve sequential deletes', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root, 0, 1);
                await site1.delete(root, 1, 2);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('c');
                expect(meta).toEqual({
                    indexes: [2],
                    refs: [root],
                });
            });
        });

        describe('mixed', () => {
            it('should process deletes before inserts', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert } = await site1.insert(0, '123', root);
                await site1.delete(root, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('123bc');
                expect(meta).toEqual({
                    indexes: [0, 1, 2, 1, 2],
                    refs: [insert, insert, insert, root, root],
                });
            });

            it('should handle chaining deletes onto inserts', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert1 } = await site1.insert(3, '456', root);
                const { added: insert2 } = await site1.insert(0, '123', root);
                await site1.delete(root, 1, 2);
                await site1.delete(insert1, 2, 3);
                await site1.delete(insert2, 0, 1);

                traverser.next();

                const { value, meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );
                expect(value).toBe('23ac45');
                expect(meta).toEqual({
                    indexes: [1, 2, 0, 2, 0, 1],
                    refs: [insert2, insert2, root, root, insert1, insert1],
                });
            });
        });

        describe('calculateSequenceRef()', () => {
            it('should return the root if there are no other inserts', async () => {
                const { added: root } = await site1.val('abc', null);
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRef(meta, 0)).toEqual({
                    ref: root,
                    index: 0,
                });
                expect(calculateSequenceRef(meta, 1)).toEqual({
                    ref: root,
                    index: 1,
                });
                expect(calculateSequenceRef(meta, 2)).toEqual({
                    ref: root,
                    index: 2,
                });
                expect(calculateSequenceRef(meta, 3)).toEqual({
                    ref: root,
                    index: 3,
                });
            });

            it('should return the last valid index if the insert index is after the sequence', async () => {
                const { added: root } = await site1.val('abc', null);
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRef(meta, 4)).toEqual({
                    ref: root,
                    index: 3,
                });
            });

            it('should return the first valid index if the insert index is before the sequence', async () => {
                const { added: root } = await site1.val('abc', null);
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRef(meta, -1)).toEqual({
                    ref: root,
                    index: 0,
                });
            });

            it('should return the first valid index if there is nowhere to place the text', async () => {
                const { added: root } = await site1.val('abc', null);
                await site1.delete(root);
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRef(meta, 1)).toEqual({
                    ref: null,
                    index: 0,
                });
            });

            it('should return the index if the root does not have an end', async () => {
                const { added: root } = await site1.val(19, null);
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRef(meta, 1)).toEqual({
                    ref: null,
                    index: 1,
                });
                expect(calculateSequenceRef(meta, 100)).toEqual({
                    ref: null,
                    index: 100,
                });
            });

            it('should return the index within a sequence after another sequence', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert1 } = await site1.insert(3, '456', root);
                const { added: insert2 } = await site1.insert(0, '123', root);
                await site1.delete(root, 1, 2);
                await site1.delete(insert1, 2, 3);
                await site1.delete(insert2, 0, 1);

                // text: "23ac45"
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRef(meta, 0)).toEqual({
                    ref: insert2,
                    index: 1,
                });
                expect(calculateSequenceRef(meta, 1)).toEqual({
                    ref: insert2,
                    index: 2,
                });
                expect(calculateSequenceRef(meta, 2)).toEqual({
                    ref: root,
                    index: 0,
                });
                expect(calculateSequenceRef(meta, 3)).toEqual({
                    ref: root,
                    index: 2,
                });
                expect(calculateSequenceRef(meta, 4)).toEqual({
                    ref: insert1,
                    index: 0,
                });
                expect(calculateSequenceRef(meta, 5)).toEqual({
                    ref: insert1,
                    index: 1,
                });
                expect(calculateSequenceRef(meta, 6)).toEqual({
                    ref: insert1,
                    index: 2,
                });
            });
        });

        describe('calculateSequenceRefs()', () => {
            it('should return the proper deletion length', async () => {
                const { added: root } = await site1.val('abc', null);

                // text: "23ac45"
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRefs(meta, 1, 2)).toEqual([
                    { ref: root, index: 1, length: 2 },
                ]);
            });

            it('should return all the refs and indexes that the given span covers', async () => {
                const { added: root } = await site1.val('abc', null);
                const { added: insert1 } = await site1.insert(3, '456', root);
                const { added: insert2 } = await site1.insert(0, '123', root);
                await site1.delete(root, 1, 2);
                await site1.delete(insert1, 2, 3);
                await site1.delete(insert2, 0, 1);

                // text: "23ac45"
                traverser.next();
                const { meta } = reducer.evalSequence(
                    traverser,
                    root,
                    root.value.value,
                    metadata
                );

                expect(calculateSequenceRefs(meta, 0, 0)).toEqual([
                    { ref: insert2, index: 1 },
                ]);
                expect(calculateSequenceRefs(meta, 0, 1)).toEqual([
                    { ref: insert2, index: 1, length: 1 },
                ]);
                expect(calculateSequenceRefs(meta, 0, 2)).toEqual([
                    { ref: insert2, index: 1, length: 2 },
                ]);
                expect(calculateSequenceRefs(meta, 0, 3)).toEqual([
                    { ref: insert2, index: 1, length: 2 },
                    { ref: root, index: 0, length: 1 },
                ]);
                expect(calculateSequenceRefs(meta, 0, 4)).toEqual([
                    { ref: insert2, index: 1, length: 2 },
                    { ref: root, index: 0, length: 3 },
                ]);
                expect(calculateSequenceRefs(meta, 0, 5)).toEqual([
                    { ref: insert2, index: 1, length: 2 },
                    { ref: root, index: 0, length: 3 }, // need to delete all the root values
                    { ref: insert1, index: 0, length: 1 },
                ]);
                expect(calculateSequenceRefs(meta, 0, 6)).toEqual([
                    { ref: insert2, index: 1, length: 2 },
                    { ref: root, index: 0, length: 3 }, // need to delete all the root values
                    { ref: insert1, index: 0, length: 2 },
                ]);
            });
        });
    });
});
