import { AuxCausalTree } from "./AuxCausalTree";
import { AtomFactory } from "../causal-trees/AtomFactory";
import { AuxOp, AuxOpType } from "./AuxOpTypes";
import { 
    DEFAULT_WORKSPACE_SCALE, 
    DEFAULT_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_GRID_SCALE, 
    DEFAULT_WORKSPACE_COLOR, 
    createFile, 
    createWorkspace, 
    fileUpdated, 
    fileAdded, 
    fileRemoved, 
    transaction, 
    addState,
    File
} from "../Files";
import { site } from "../causal-trees/SiteIdInfo";
import { storedTree } from "../causal-trees/StoredCausalTree";
import { AuxState } from "./AuxState";
import { atomId, atom, Atom } from "../causal-trees/Atom";
import { file, tag, value, del } from "./AuxAtoms";

Date.now = jest.fn();

describe('AuxCausalTree', () => {
    describe('value', () => {

        describe('calculations', () => {
            it('should add files to the state', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.root();
                const file = tree.file('fileId');

                expect(tree.value).toEqual({
                    'fileId': {
                        id: 'fileId',
                        tags: {},
                        metadata: {
                            ref: file,
                            tags: {}
                        }
                    }
                });
            });

            it('should write workspace tags directly to the object', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.root();
                const file = tree.file('fileId');
                const size = tree.tag('size', file);
                const sizeVal = tree.val(4, size);

                const extra = tree.tag('extra', file);
                const extraVal = tree.val({ test: 'abc' }, extra);

                expect(tree.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            size: 4,
                            extra: { test: 'abc' },
                        }
                    }
                });
            });

            it('should use last write wins for duplicate files', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('test', first);
                const firstTagValue = site1.val(null, firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);

                const second = site2.file('fileId');
                const secondTag = site2.tag('other', second);
                const secondTagValue = site2.val(null, secondTag);

                site1.add(second);
                site1.add(secondTag);
                site1.add(secondTagValue);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        tags: {},
                    }
                });
            });

            it('should use last write wins for file deletions', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('test', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);

                const deleteFile = site2.delete(first);
                
                site1.add(deleteFile);
                
                expect(site1.value).toEqual({});
            });

            it('should ignore tags that dont have values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                const root = site1.root();

                const first = site1.file('fileId');
                const sizeTag = site1.tag('size', first);

                expect(site1.value['fileId'].tags).toEqual({});
            });

            it('should ignore tags that have null values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                const root = site1.root();

                const first = site1.file('fileId');
                const sizeTag = site1.tag('size', first);
                const sizeVal = site1.val(null, sizeTag);

                expect(site1.value['fileId'].tags).toEqual({});
            });

            it('should ignore tags that have undefined values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                const root = site1.root();

                const first = site1.file('fileId');
                const sizeTag = site1.tag('size', first);
                const sizeVal = site1.val(undefined, sizeTag);

                expect(site1.value['fileId'].tags).toEqual({});
            });

            it('should ignore tags that have empty string values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                const root = site1.root();

                const first = site1.file('fileId');
                const sizeTag = site1.tag('size', first);
                const sizeVal = site1.val('', sizeTag);

                expect(site1.value['fileId'].tags).toEqual({});
            });

            it('should not tags that have whitespace string values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                const root = site1.root();

                const first = site1.file('fileId');
                const sizeTag = site1.tag('size', first);
                const sizeVal = site1.val('\n', sizeTag);

                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            size: '\n'
                        }
                    }
                });
            });

            it('should use last write wins for tags', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('test', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);

                const secondTag = site2.tag('test', first);
                const secondTagValue = site2.val('123', secondTag);

                site1.add(secondTag);
                site1.add(secondTagValue);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            test: '123'
                        },
                    }
                });
            });

            it('should allow multiple tags', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('test', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);

                const secondTag = site2.tag('other', first);
                const secondTagValue = site2.val('123', secondTag);

                site1.add(secondTag);
                site1.add(secondTagValue);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            test: 'abc',
                            other: '123'
                        },
                        // metadata: {
                        //     ref: first,
                        //     tags: {}
                        // }
                    }
                });
            });

            it('should use last write wins for tag values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('test', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);

                const secondTagValue = site2.val('123', firstTag);

                site1.add(secondTagValue);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            test: '123'
                        },
                        // metadata: {
                        //     ref: first,
                        //     tags: {}
                        // }
                    }
                });
            });

            it('should use sequence for tag renaming', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));
                let site3 = new AuxCausalTree(storedTree(site(3)));

                const root = site1.root();
                site2.add(root);
                site3.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('first', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);
                site3.add(first);
                site3.add(firstTag);
                site3.add(firstTagValue);

                const firstDelete = site1.delete(firstTag, 0, 5);
                const firstInsert = site1.insert(0, 'reallylong', firstTag);
                const secondRename = site2.insert(5, '1', firstTag);
                const thirdRename = site3.insert(0, '99', firstTag);

                site1.add(thirdRename);
                site1.add(secondRename);

                site2.add(firstDelete);
                site2.add(firstInsert);
                site2.add(thirdRename);

                site3.add(firstDelete);
                site3.add(firstInsert);
                site3.add(secondRename);

                const expected: any = {
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            '99reallylong1': 'abc'
                        }
                    }
                };
                
                expect(site1.value).toMatchObject(expected);
                expect(site2.value).toMatchObject(expected);
                expect(site3.value).toMatchObject(expected);
            });

            it('should use sequence for tag renaming', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));
                let site3 = new AuxCausalTree(storedTree(site(3)));

                const root = site1.root();
                site2.add(root);
                site3.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('first', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);
                site3.add(first);
                site3.add(firstTag);
                site3.add(firstTagValue);

                const secondDelete = site2.delete(firstTag, 1, 5);
                const secondRename = site2.insert(1, '1', firstTag);
                const thirdRename = site3.insert(0, '99', firstTag);

                site1.add(secondDelete);
                site1.add(thirdRename);
                site1.add(secondRename);

                site2.add(thirdRename);

                site3.add(secondDelete);
                site3.add(secondRename);
                
                const expected: any = {
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            '99f1': 'abc'
                        }
                    }
                };

                expect(site1.value).toMatchObject(expected);
                expect(site2.value).toMatchObject(expected);
                expect(site3.value).toMatchObject(expected);
            });

            it('should ignore tags with empty names', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));

                const root = site1.root();

                const first = site1.file('fileId');
                const firstTag = site1.tag('first', first);
                site1.delete(firstTag, 0, 5);
                
                const expected: AuxState = {
                    'fileId': {
                        id: 'fileId',
                        tags: {},
                        metadata: {
                            ref: first,
                            tags: {}
                        }
                    }
                };

                expect(site1.value).toEqual(expected);
            });

            it('should use sequence for tag values', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));
                let site3 = new AuxCausalTree(storedTree(site(3)));

                const root = site1.root();
                site2.add(root);
                site3.add(root);

                const first = site1.file('fileId');
                const firstTag = site1.tag('first', first);
                const firstTagValue = site1.val('abc', firstTag);

                site2.add(first);
                site2.add(firstTag);
                site2.add(firstTagValue);
                site3.add(first);
                site3.add(firstTag);
                site3.add(firstTagValue);

                const secondDelete = site2.delete(firstTagValue, 1, 3);
                const secondRename = site2.insert(1, '1', firstTagValue);
                const thirdRename = site3.insert(0, '99', firstTagValue);

                site1.add(secondDelete);
                site1.add(thirdRename);
                site1.add(secondRename);

                site2.add(thirdRename);

                site3.add(secondDelete);
                site3.add(secondRename);
                
                const expected: any = {
                    'fileId': {
                        id: 'fileId',
                        tags: {
                            'first': '99a1'
                        }
                    }
                };

                expect(site1.value).toMatchObject(expected);
                expect(site2.value).toMatchObject(expected);
                expect(site3.value).toMatchObject(expected);
            });
        });

        describe('garbage collection (garbage collect === true)', () => {
            it('should remove old values when adding a new value atom', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.garbageCollect = true;

                const root = tree.root();
                const file = tree.file('fileId');
                const test = tree.tag('test', file);
                const testVal1 = tree.val(99, test);
                const testVal2 = tree.val('hello, world', test);

                const test2 = tree.tag('test2', file);
                const test2Val1 = tree.val(99, test2);
                const test2Val2 = tree.val('hello, world', test2);

                expect(tree.weave.atoms).toEqual([
                    root,
                    file,
                    test2,
                    test2Val2,
                    test,
                    testVal2
                ]);
            });

            it('should collect garbage after addMany()', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.garbageCollect = true;

                const root = tree.root();
                const file = tree.file('fileId');
                const test = tree.tag('test', file);
                const testVal1 = tree.factory.create(value(99), test);
                const testVal2 = tree.factory.create(value('hello, world'), test);

                const test2 = tree.tag('test2', file);
                const test2Val1 = tree.factory.create(value(99), test2);
                const test2Val2 = tree.factory.create(value('hello, world'), test2);

                tree.addMany([test2Val2, test2Val1, testVal1, testVal2]);

                expect(tree.weave.atoms).toEqual([
                    root,
                    file,
                    test2,
                    test2Val2,
                    test,
                    testVal2
                ]);
            });

            it('should collect garbage after importWeave()', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));
                tree.garbageCollect = false;

                const root = tree.root();
                const file = tree.file('fileId');
                const test = tree.tag('test', file);
                const testVal1 = tree.val(99, test);
                const testVal2 = tree.val('hello, world', test);

                const test2 = tree.tag('test2', file);
                const test2Val1 = tree.val(99, test2);
                const test2Val2 = tree.val('hello, world', test2);

                let other = new AuxCausalTree(storedTree(site(1)));
                other.garbageCollect = true;
                other.importWeave(tree.weave.atoms);

                expect(other.weave.atoms).toEqual([
                    root,
                    file,
                    test2,
                    test2Val2,
                    test,
                    testVal2
                ]);
            });

            it('should emit atomsArchived events after GC', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.garbageCollect = true;
                
                let archived: Atom<AuxOp>[] = [];
                let error = jest.fn();
                tree.atomsArchived.subscribe(a => {
                    archived.push(...a);
                }, error);

                const root = tree.root();
                const file = tree.file('fileId');
                const test = tree.tag('test', file);
                const testVal1 = tree.val(99, test);
                const testVal2 = tree.val('hello, world', test);

                const test2 = tree.tag('test2', file);
                const test2Val1 = tree.val(99, test2);
                const test2Val2 = tree.val('hello, world', test2);

                expect(error).not.toBeCalled();
                expect(archived).toEqual([
                    testVal1,
                    test2Val1
                ]);
            });

            it('should emit atomsArchived events after batched GC', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.garbageCollect = true;
                
                let archived: Atom<AuxOp>[] = [];
                let error = jest.fn();
                tree.atomsArchived.subscribe(a => {
                    archived.push(...a);
                }, error);

                const root = tree.root();
                const file = tree.file('fileId');
                const test = tree.tag('test', file);

                let testVal1: Atom<AuxOp>;
                let testVal2: Atom<AuxOp>;
                tree.batch(() => {
                    testVal1 = tree.val(99, test);
                    testVal2 = tree.val('hello, world', test);
                });

                expect(error).not.toBeCalled();
                expect(archived).toEqual([
                    testVal1
                ]);
            });
        });

        describe('metadata', () => {
            it('should produce metadata', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.root();
                const file = tree.file('fileId');
                const size = tree.tag('size', file);
                const sizeVal = tree.val(4, size);

                const extra = tree.tag('extra', file);
                const extraVal = tree.val({ test: 'abc' }, extra);

                const last = tree.tag('last', file);
                const lastVal = tree.val('123456', last);

                expect(tree.value).toMatchObject({
                    'fileId': {
                        metadata: {
                            ref: file,
                            tags: {
                                size: { 
                                    ref: size, 
                                    name: {
                                        indexes: [
                                            0, 1, 2, 3
                                        ],
                                        refs: [
                                            size, size, size, size
                                        ]
                                    },
                                    value: { 
                                        ref: sizeVal,
                                        sequence: null
                                    }
                                },
                                extra: { 
                                    ref: extra,
                                    name: {
                                        indexes: [
                                            0, 1, 2, 3, 4
                                        ],
                                        refs: [
                                            extra, extra, extra, extra, extra
                                        ]
                                    },
                                    value: { 
                                        ref: extraVal, 
                                        sequence: null
                                    }
                                },
                                last: { 
                                    ref: last,
                                    name: {
                                        indexes: [
                                            0, 1, 2, 3
                                        ],
                                        refs: [
                                            last, last, last, last
                                        ]
                                    },
                                    value: { 
                                        ref: lastVal, 
                                        sequence: {
                                            indexes: [
                                                0, 1, 2, 3, 4, 5
                                            ],
                                            refs: [
                                                lastVal, lastVal, lastVal, lastVal, lastVal, lastVal
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            });
        });
    });

    describe('insertInto()', () => {
        it('should insert the given text into the given value', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId');
            const tag = tree.tag('test', file);
            const val = tree.val('abc', tag);

            const files = tree.value;

            const insert = tree.insertIntoTagValue(files['testId'], 'test', '123', 2);

            expect(insert.value).toMatchObject({
                index: 2,
                text: '123'
            });
        });

        it('should insert the given text into the given complex tag value', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId');
            const tag = tree.tag('test', file);
            const val = tree.val('abc', tag);
            const insert1 = tree.insert(0, 'xyz', val); // xyzabc
            const delete1 = tree.delete(insert1, 0, 1); // yzabc
            const insert2 = tree.insert(0, '1', val); //   yz1abc
            const insert3 = tree.insert(3, '?', val); //   yz1abc?
            const delete2 = tree.delete(val, 0, 3); //     yz1?

            const files = tree.value;

            const insert = tree.insertIntoTagValue(files['testId'], 'test', '5555', 2);

            expect(insert.cause).toEqual(insert2.id);
            expect(insert.value).toMatchObject({
                index: 0,
                text: '5555'
            });
        });

        it('should handle inserting emojii', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId');
            const tag = tree.tag('test', file);
            const val = tree.val('the quick brown fox jumped over the lazy dog', tag);

            const files = tree.value;

            const insert = tree.insertIntoTagValue(files['testId'], 'test', '🦊', 16);

            expect(insert.cause).toEqual(val.id);
            expect(insert.value).toMatchObject({
                index: 16,
                text: '🦊'
            });
            expect(tree.value['testId'].tags.test).toEqual(
                'the quick brown 🦊fox jumped over the lazy dog'
            );
        });
    });

    describe('deleteFrom()', () => {
        it('should delete the specified section of text', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId');
            const tag = tree.tag('test', file);
            const val = tree.val('abc', tag);

            const files = tree.value;

            const deleted = tree.deleteFromTagValue(files['testId'], 'test', 1, 2);

            expect(deleted.length).toBe(1);
            expect(deleted[0].value).toMatchObject({
                start: 1,
                end: 3
            });
        });

        it('should create deletions spanning multiple insertions', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId');
            const tag = tree.tag('test', file);
            const val = tree.val('abc', tag);
            const insert1 = tree.insert(0, '1', val);
            const insert2 = tree.insert(0, '2', insert1);
            const insert3 = tree.insert(2, '3', val);

            // "21ab3c"
            const files = tree.value;

            const deleted = tree.deleteFromTagValue(files['testId'], 'test', 0, 6);

            expect(deleted.length).toBe(5);
            
            expect(deleted[0].cause).toEqual(insert2.id);
            expect(deleted[0].value).toMatchObject({
                start: 0,
                end: 1
            });
            
            expect(deleted[1].cause).toEqual(insert1.id);
            expect(deleted[1].value).toMatchObject({
                start: 0,
                end: 1
            });
            
            expect(deleted[2].cause).toEqual(val.id);
            expect(deleted[2].value).toMatchObject({
                start: 0,
                end: 2
            });

            expect(deleted[3].cause).toEqual(insert3.id);
            expect(deleted[3].value).toMatchObject({
                start: 0,
                end: 1
            });

            expect(deleted[4].cause).toEqual(val.id);
            expect(deleted[4].value).toMatchObject({
                start: 2,
                end: 3
            });
        });
    });

    describe('addFile()', () => {
        it('should add the given object to the state', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));
            const newFile = createFile('test', <any>{
                abc: 'def',
                num: 5
            });

            const root = tree.root();
            const result = tree.addFile(newFile);

            const fileAtom = atom(atomId(1, 2), root.id, file('test'));
            const abcTag = atom(atomId(1, 3), fileAtom.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 4, 1), abcTag.id, value('def'));

            const numTag = atom(atomId(1, 5), fileAtom.id, tag('num'));
            const numTagValue = atom(atomId(1, 6, 1), numTag.id, value(5));

            expect(result.map(ref => ref)).toEqual([
                fileAtom,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                fileAtom,
                numTag,
                numTagValue,
                abcTag,
                abcTagValue
            ]);
        });

        it('should add the given workspace to the state', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));
            const newFile: File = {
                id: 'test',
                tags: {
                    'position': { x: 0, y: 0, z: 0}
                }
            };

            const root = tree.root();
            const result = tree.addFile(newFile);

            const fileAtom = atom(atomId(1, 2), root.id, file('test'));
            const positionTag = atom(atomId(1, 3), fileAtom.id, tag('position'));
            const positionTagValue = atom(atomId(1, 4, 1), positionTag.id, value({x: 0, y: 0, z: 0}));

            const resultAtoms = result.map(ref => ref);
            expect(resultAtoms).toContainEqual(fileAtom);
            expect(resultAtoms).toContainEqual(positionTag);
            expect(resultAtoms).toContainEqual(positionTagValue);

            const treeAtoms = tree.weave.atoms.map(ref => ref);
            expect(treeAtoms).toContainEqual(fileAtom);
            expect(treeAtoms).toContainEqual(positionTag);
            expect(treeAtoms).toContainEqual(positionTagValue);
        });

        it('should batch the updates together', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));
            const newFile = {
                id: 'test',
                tags: {
                    'position': { x: 0, y: 0, z: 0}
                }
            };

            const root = tree.root();
            
            let updates: Atom<AuxOp>[][] = [];
            tree.atomAdded.subscribe(refs => updates.push(refs));
            const result = tree.addFile(newFile);

            const fileAtom = atom(atomId(1, 2), root.id, file('test'));
            const positionTag = atom(atomId(1, 3), fileAtom.id, tag('position'));
            const positionTagValue = atom(atomId(1, 4, 1), positionTag.id, value({x: 0, y: 0, z: 0}));

            expect(updates.length).toBe(1);
            const resultAtoms = result.map(ref => ref);
            expect(resultAtoms).toContainEqual(fileAtom);
            expect(resultAtoms).toContainEqual(positionTag);
            expect(resultAtoms).toContainEqual(positionTagValue);

            const treeAtoms = tree.weave.atoms.map(ref => ref);
            expect(treeAtoms).toContainEqual(fileAtom);
            expect(treeAtoms).toContainEqual(positionTag);
            expect(treeAtoms).toContainEqual(positionTagValue);
        });
    });

    describe('updateFile()', () => {
        it('should update the object with the given values', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('test');
            const result = tree.updateFile(tree.value['test'], {
                tags: {
                    _position: { x: 1, y: 0, z: 0 },
                    abc: '123',
                    num: 99,
                    b: true
                }
            });

            const positionTag = atom(atomId(1, 3), file.id, tag('_position'));
            const positionTagValue = atom(atomId(1, 4, 1), positionTag.id, value({ x: 1, y: 0, z: 0 }));

            const abcTag = atom(atomId(1, 5), file.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 6, 1), abcTag.id, value('123'));

            const numTag = atom(atomId(1, 7), file.id, tag('num'));
            const numTagValue = atom(atomId(1, 8, 1), numTag.id, value(99));

            const bTag = atom(atomId(1, 9), file.id, tag('b'));
            const bTagValue = atom(atomId(1, 10, 1), bTag.id, value(true));

            expect(result.map(ref => ref)).toEqual([
                positionTag,
                positionTagValue,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue,
                bTag,
                bTagValue
            ]);
        });

        it('should handle nested objects', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('test');
            tree.updateFile(tree.value['test'], {
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                }
            });

            const result = tree.updateFile(tree.value['test'], {
                tags: {
                    _position: <any>{ x: 1 },
                }
            });

            const positionTag = atom(atomId(1, 3), file.id, tag('_position'));
            const positionTagValue = atom(atomId(1, 5, 1), positionTag.id, value({ x: 1, y: 0, z: 0 }));

            expect(result.map(ref => ref)).toEqual([
                positionTagValue
            ]);
        });

        it('should batch the updates together', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('test');
            
            let updates: Atom<AuxOp>[][] = [];
            tree.atomAdded.subscribe(refs => updates.push(refs));
            
            tree.updateFile(tree.value['test'], {
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                }
            });

            const result = tree.updateFile(tree.value['test'], {
                tags: {
                    _position: <any>{ x: 1 },
                }
            });

            const positionTag = atom(atomId(1, 3), file.id, tag('_position'));
            const positionTagValue = atom(atomId(1, 5, 1), positionTag.id, value({ x: 1, y: 0, z: 0 }));

            
            expect(updates.length).toBe(2);
            expect(result.map(ref => ref)).toEqual([
                positionTagValue
            ]);
        });

        it('should not write duplicates', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = createFile('test', {
                _workspace: null,
                _position: { x: 0, y: 0, z: 0 },
                test: 99
            });
            tree.addFile(file);
            
            let updates: Atom<AuxOp>[][] = [];
            tree.atomAdded.subscribe(refs => updates.push(refs));
            
            const result = tree.updateFile(tree.value['test'], {
                tags: {
                    test: 99,
                    _workspace: null,
                    _position: { x: 0, y: 0, z: 0 }
                }
            });

            expect(updates.length).toBe(0);
            expect(result.map(ref => ref)).toEqual([]);
        });

        it('should allow setting null', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = createFile('test', {
                _workspace: null,
                _position: { x: 0, y: 0, z: 0 },
                test: 99
            });
            tree.addFile(file);
            
            let updates: Atom<AuxOp>[][] = [];
            tree.atomAdded.subscribe(refs => updates.push(refs));
            
            const result = tree.updateFile(tree.value['test'], {
                tags: {
                    test: null
                }
            });

            expect(updates.length).toBe(1);
            expect(result.map(ref => ref)).toEqual([
                atom(atomId(1, 9, 1), atomId(1, 7), value(null))
            ]);
        });
    });

    describe('addEvents()', () => {
        it('should handle file update events', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('test');
            const result = tree.addEvents([
                fileUpdated('test', {
                    tags: {
                        _position: { x: 1, y: 0, z: 0 },
                        abc: '123',
                        num: 99,
                        b: true
                    }
                })
            ]);

            const positionTag = atom(atomId(1, 3), file.id, tag('_position'));
            const positionTagValue = atom(atomId(1, 4, 1), positionTag.id, value({ x: 1, y: 0, z: 0 }));

            const abcTag = atom(atomId(1, 5), file.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 6, 1), abcTag.id, value('123'));

            const numTag = atom(atomId(1, 7), file.id, tag('num'));
            const numTagValue = atom(atomId(1, 8, 1), numTag.id, value(99));

            const bTag = atom(atomId(1, 9), file.id, tag('b'));
            const bTagValue = atom(atomId(1, 10, 1), bTag.id, value(true));

            expect(result.map(ref => ref)).toEqual([
                positionTag,
                positionTagValue,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue,
                bTag,
                bTagValue
            ]);
        });

        it('should handle file added events', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));
            const newFile = createFile('test', <any>{
                abc: 'def',
                num: 5
            });

            const root = tree.root();
            const result = tree.addEvents([
                fileAdded(newFile)
            ]);

            const fileAtom = atom(atomId(1, 2), root.id, file('test'));
            const abcTag = atom(atomId(1, 3), fileAtom.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 4, 1), abcTag.id, value('def'));

            const numTag = atom(atomId(1, 5), fileAtom.id, tag('num'));
            const numTagValue = atom(atomId(1, 6, 1), numTag.id, value(5));

            expect(result.map(ref => ref)).toEqual([
                fileAtom,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                fileAtom,
                numTag,
                numTagValue,
                abcTag,
                abcTagValue
            ]);
        });

        it('should handle file removed events', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = tree.root();
            const file = tree.file('test');

            const result = tree.addEvents([
                fileRemoved('test')
            ]);

            const deleteFile = atom(atomId(1, 3, 1), file.id, del());

            expect(result.map(ref => ref)).toEqual([
                deleteFile
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                file,
                deleteFile,
            ]);
        });

        it('should handle file removed events on already deleted files', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId');
            const del = tree.delete(file);

            const result = tree.addEvents([
                fileRemoved('test')
            ]);

            expect(result.map(ref => ref)).toEqual([]);
        });

        it('should handle transaction events', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = tree.root();
            const newFile = tree.file('test');
            const newFile2 = createFile('test', <any>{
                abc: 'def',
                num: 5
            });

            const result = tree.addEvents([
                transaction([
                    fileRemoved('test'),
                    fileAdded(newFile2)
                ])
            ]);

            const deleteFile = atom(atomId(1, 3, 1), newFile.id, del());

            const fileAtom = atom(atomId(1, 4), root.id, file('test'));
            const abcTag = atom(atomId(1, 5), fileAtom.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 6, 1), abcTag.id, value('def'));

            const numTag = atom(atomId(1, 7), fileAtom.id, tag('num'));
            const numTagValue = atom(atomId(1, 8, 1), numTag.id, value(5));

            expect(result.map(ref => ref)).toEqual([
                deleteFile,
                fileAtom,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                fileAtom,
                numTag,
                numTagValue,
                abcTag,
                abcTagValue,
                newFile,
                deleteFile,
            ]);
        });

        it('should add files from add_state events', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = tree.root();
            const newFile = createFile('test', <any>{
                abc: 'def',
                num: 5
            });

            const result = tree.addEvents([
                addState({
                    'test': newFile
                })
            ]);

            const fileAtom = atom(atomId(1, 2), root.id, file('test'));
            const abcTag = atom(atomId(1, 3), fileAtom.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 4, 1), abcTag.id, value('def'));

            const numTag = atom(atomId(1, 5), fileAtom.id, tag('num'));
            const numTagValue = atom(atomId(1, 6, 1), numTag.id, value(5));

            expect(result.map(ref => ref)).toEqual([
                fileAtom,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                fileAtom,
                numTag,
                numTagValue,
                abcTag,
                abcTagValue
            ]);
        });

        it('should update files from add_state events', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = tree.root();
            const newFile = createFile('test', <any>{
                abc: 'def',
                num: 5
            });

            const result = tree.addEvents([
                addState({
                    'test': newFile
                })
            ]);

            const fileAtom = atom(atomId(1, 2), root.id, file('test'));
            const abcTag = atom(atomId(1, 3), fileAtom.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 4, 1), abcTag.id, value('def'));

            const numTag = atom(atomId(1, 5), fileAtom.id, tag('num'));
            const numTagValue = atom(atomId(1, 6, 1), numTag.id, value(5));

            expect(result.map(ref => ref)).toEqual([
                fileAtom,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                fileAtom,
                numTag,
                numTagValue,
                abcTag,
                abcTagValue
            ]);
        });

        it('should batch updates', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            const root = tree.root();
            const newFile = createFile('test', <any>{
                abc: 'def',
                num: 5
            });

            const otherFile = tree.file('other');
            const otherTag = tree.tag('tag', otherFile);
            const otherTagValue = tree.val('99', otherTag);

            let updates: Atom<AuxOp>[][] = [];
            tree.atomAdded.subscribe(refs => updates.push(refs));

            const result = tree.addEvents([
                addState({
                    'test': newFile,
                    'other': <any><Partial<Object>>{
                        id: 'other',
                        type: 'object',
                        tags: {
                            tag: 'hello'
                        }
                    }
                })
            ]);

            const fileAtom = atom(atomId(1, 5), root.id, file('test'));
            const abcTag = atom(atomId(1, 6), fileAtom.id, tag('abc'));
            const abcTagValue = atom(atomId(1, 7, 1), abcTag.id, value('def'));

            const numTag = atom(atomId(1, 8), fileAtom.id, tag('num'));
            const numTagValue = atom(atomId(1, 9, 1), numTag.id, value(5));

            const newOtherTagValue = atom(atomId(1, 10, 1), otherTag.id, value('hello'));

            expect(updates.length).toBe(1);
            expect(result.map(ref => ref)).toEqual([
                fileAtom,
                abcTag,
                abcTagValue,
                numTag,
                numTagValue,
                newOtherTagValue
            ]);
            expect(tree.weave.atoms.map(ref => ref)).toEqual([
                root,
                fileAtom,
                numTag,
                numTagValue,
                abcTag,
                abcTagValue,
                otherFile,
                otherTag,
                newOtherTagValue,
                otherTagValue
            ]);
        });
    });
});