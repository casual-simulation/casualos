import { Weave } from "common/channels-core/Weave";
import { AuxOp } from "./AuxOpTypes";
import { AuxReducer } from "./AuxReducer";
import { WeaveTraverser } from "common/channels-core/WeaveTraverser";
import { AuxCausalTree } from "./AuxCausalTree";

describe('AuxReducer', () => {

    describe('evalSequence', () => {
        let reducer: AuxReducer;
        let site1: AuxCausalTree;
        let traverser: WeaveTraverser<AuxOp>;

        beforeEach(() => {
            reducer = new AuxReducer();
            site1 = new AuxCausalTree(1);
            traverser = new WeaveTraverser(site1.weave);
        });

        it('should return the initial value if there are no children', () => {
            const root = site1.val('abc', null);
            const result = reducer.evalSequence(traverser, root, root.atom.value.value);
            expect(result).toBe('abc');
        });

        describe('single insert', () => {
           
            it('should handle single inserts at the beginning of the string', () => {
                const root = site1.val('abc', null);
                site1.insert(0, '123', root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('123abc');
            });

            it('should handle single inserts in the middle of the string', () => {
                const root = site1.val('abc', null);
                site1.insert(2, '123', root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('ab123c');
            });

            it('should handle single inserts at the end of the string', () => {
                const root = site1.val('abc', null);
                site1.insert(3, '123', root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('abc123');
            });
        });

        
        describe('multiple insertions', () => {
            it('should handle multiple insertions at the beginning', () => {
                const root = site1.val('abc', null);
                site1.insert(0, '123', root.atom);
                site1.insert(0, '456', root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);

                // 456 appears after 123 because both insertions are on
                // the root.
                expect(result).toBe('123456abc');
            });

            it('should handle multiple insertions at the end', () => {
                const root = site1.val('abc', null);
                site1.insert(3, '123', root.atom);
                site1.insert(3, '456', root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('abc123456');
            });

            it('should handle multiple insertions in the middle', () => {
                const root = site1.val('abc', null);
                site1.insert(1, '123', root.atom);
                site1.insert(1, '456', root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('a123456bc');
            });

            it('should handle chained insertions at the beginning', () => {
                const root = site1.val('abc', null);
                const first = site1.insert(0, '123', root.atom);
                const second = site1.insert(0, '456', first.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('456123abc');
            });

            it('should handle chained insertions at the end of the intermediate string', () => {
                const root = site1.val('abc', null);
                const first = site1.insert(0, '123', root.atom);
                const second = site1.insert(3, '456', first.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('123456abc');
            });

            it('should handle chained insertions in the middle of the intermediate string', () => {
                const root = site1.val('abc', null);
                const first = site1.insert(0, '123', root.atom);
                const second = site1.insert(2, '456', first.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('124563abc');
            });
        });

        describe('single delete', () => {
 
            it('should handle single deletions for the entire string without indicies', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('');
            });

            it('should handle single deletions for the entire string with indicies', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 3);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('');
            });

            it('should handle single deletions for the beginning of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('bc');
            });

            it('should handle single deletions for the middle of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 1, 2);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('ac');
            });

            it('should handle single deletions for the end of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 2, 3);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('ab');
            });

            it('should handle negative start indicies', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, -1, 3);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('');
            });

            it('should handle end further than the end of the string', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 4);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('');
            });
        });

        describe('multiple delete', () => {
            it('should combine deletes at the beginning', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 0, 1);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('bc');
            });

            it('should combine deletes at the end', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 2, 3);
                site1.delete(root.atom, 2, 3);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('ab');
            });

            it('should combine deletes in the middle', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 1, 2);
                site1.delete(root.atom, 1, 2);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('ac');
            });

            it('should preserve overlapping deletes at the beginning', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 0, 2);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('c');
            });

            it('should preserve overlapping deletes at the end', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 2, 3);
                site1.delete(root.atom, 1, 3);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('a');
            });

            it('should preserve overlapping deletes anywhere', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 0, 3);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('');
            });

            it('should preserve sequential deletes', () => {
                const root = site1.val('abc', null);
                site1.delete(root.atom, 0, 1);
                site1.delete(root.atom, 1, 2);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('c');
            });
        });

        describe('mixed', () => {
            it('should process deletes before inserts', () => {
                const root = site1.val('abc', null);
                site1.insert(0, '123', root.atom);
                site1.delete(root.atom, 0, 1);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('123bc');
            });

            it('should handle chaining deletes onto inserts', () => {
                const root = site1.val('abc', null);
                const insert1 = site1.insert(3, '456', root.atom);
                const insert2 = site1.insert(0, '123', root.atom);
                site1.delete(root.atom, 1, 2);
                site1.delete(insert1.atom, 2, 3);
                site1.delete(insert2.atom, 0, 1);

                traverser.next();

                const result = reducer.evalSequence(traverser, root, root.atom.value.value);
                expect(result).toBe('23ac45');
            });
        });
    });
});