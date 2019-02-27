import { AuxCausalTree } from "./AuxCausalTree";
import { AtomFactory } from "../channels-core/AtomFactory";
import { AuxOp, AuxOpType } from "./AuxOpTypes";
import { DEFAULT_WORKSPACE_SCALE, DEFAULT_WORKSPACE_HEIGHT, DEFAULT_WORKSPACE_GRID_SCALE, DEFAULT_WORKSPACE_COLOR } from "../Files";
import { site } from "../channels-core/SiteIdInfo";
import { storedTree } from "../channels-core/StoredCausalTree";
import { AuxState } from "./AuxState";
import { atomId } from "../channels-core/Atom";

describe('AuxCausalTree', () => {
    describe('value', () => {

        describe('calculations', () => {
            it('should add files to the state', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.root();
                const file = tree.file('fileId', 'object');

                expect(tree.value).toEqual({
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null
                        },
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
                const file = tree.file('fileId', 'workspace');
                const size = tree.tag('size', file.atom);
                const sizeVal = tree.val(4, size.atom);

                const extra = tree.tag('extra', file.atom);
                const extraVal = tree.val({ test: 'abc' }, extra.atom);

                expect(tree.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        type: 'workspace',
                        position: {x: 0, y: 0, z: 0},
                        size: 4,
                        extra: { test: 'abc' },
                        grid: {},
                        scale: DEFAULT_WORKSPACE_SCALE,
                        defaultHeight: DEFAULT_WORKSPACE_HEIGHT,
                        gridScale: DEFAULT_WORKSPACE_GRID_SCALE,
                        color: DEFAULT_WORKSPACE_COLOR,
                        // metadata: {
                        //     ref: file,
                        //     tags: {
                        //         size: { 
                        //             ref: size, 
                        //             value: { 
                        //                 ref: sizeVal, 
                        //                 name: [
                        //                     { start:  }
                        //                 ],
                        //                 sequence: [
                        //                     { start: 0, end: 3, ref: sizeVal }
                        //                 ]
                        //             }
                        //         },
                        //         extra: { 
                        //             ref: extra,
                        //             value: { 
                        //                 ref: extraVal, 
                        //                 sequence: [
                        //                     { start: 0, end: 3, ref: extraVal }
                        //                 ]
                        //             }
                        //         }
                        //     }
                        // }
                    }
                });
            });

            it('should use last write wins for duplicate files', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('test', first.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);

                const second = site2.file('fileId', 'object');
                const secondTag = site2.tag('other', second.atom);

                site1.add(second.atom);
                site1.add(secondTag.atom);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
                            other: null
                        },
                        // metadata: {
                        //     ref: second,
                        //     tags: {
                        //         test: {
                        //             ref: firstTag,
                                    
                        //         },
                        //         other: {
                        //             ref: secondTag
                        //         }
                        //     }
                        // }
                    }
                });
            });

            it('should use last write wins for file deletions', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('test', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);

                const deleteFile = site2.delete(first.atom);
                
                site1.add(deleteFile.atom);
                
                expect(site1.value).toEqual({
                    'fileId': null
                });
            });

            it('should use last write wins for tags', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('test', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);

                const secondTag = site2.tag('test', first.atom);
                const secondTagValue = site2.val('123', secondTag.atom);

                site1.add(secondTag.atom);
                site1.add(secondTagValue.atom);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
                            test: '123'
                        },
                        // metadata: {
                        //     ref: first,
                        //     tags: {}
                        // }
                    }
                });
            });

            it('should allow multiple tags', () => {
                let site1 = new AuxCausalTree(storedTree(site(1)));
                let site2 = new AuxCausalTree(storedTree(site(2)));

                const root = site1.root();
                site2.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('test', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);

                const secondTag = site2.tag('other', first.atom);
                const secondTagValue = site2.val('123', secondTag.atom);

                site1.add(secondTag.atom);
                site1.add(secondTagValue.atom);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
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
                site2.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('test', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);

                const secondTagValue = site2.val('123', firstTag.atom);

                site1.add(secondTagValue.atom);
                
                expect(site1.value).toMatchObject({
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
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
                site2.add(root.atom);
                site3.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('first', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);
                site3.add(first.atom);
                site3.add(firstTag.atom);
                site3.add(firstTagValue.atom);

                const firstDelete = site1.delete(firstTag.atom, 0, 5);
                const firstInsert = site1.insert(0, 'reallylong', firstTag.atom);
                const secondRename = site2.insert(5, '1', firstTag.atom);
                const thirdRename = site3.insert(0, '99', firstTag.atom);

                site1.add(thirdRename.atom);
                site1.add(secondRename.atom);

                site2.add(firstDelete.atom);
                site2.add(firstInsert.atom);
                site2.add(thirdRename.atom);

                site3.add(firstDelete.atom);
                site3.add(firstInsert.atom);
                site3.add(secondRename.atom);

                const expected: any = {
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
                            '99reallylong1': 'abc'
                        },
                        // metadata: {
                        //     ref: first,
                        //     tags: {}
                        // }
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
                site2.add(root.atom);
                site3.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('first', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);
                site3.add(first.atom);
                site3.add(firstTag.atom);
                site3.add(firstTagValue.atom);

                const secondDelete = site2.delete(firstTag.atom, 1, 5);
                const secondRename = site2.insert(1, '1', firstTag.atom);
                const thirdRename = site3.insert(0, '99', firstTag.atom);

                site1.add(secondDelete.atom);
                site1.add(thirdRename.atom);
                site1.add(secondRename.atom);

                site2.add(thirdRename.atom);

                site3.add(secondDelete.atom);
                site3.add(secondRename.atom);
                
                const expected: any = {
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
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

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('first', first.atom);
                site1.delete(firstTag.atom, 0, 5);
                
                const expected: AuxState = {
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
                        },
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
                site2.add(root.atom);
                site3.add(root.atom);

                const first = site1.file('fileId', 'object');
                const firstTag = site1.tag('first', first.atom);
                const firstTagValue = site1.val('abc', firstTag.atom);

                site2.add(first.atom);
                site2.add(firstTag.atom);
                site2.add(firstTagValue.atom);
                site3.add(first.atom);
                site3.add(firstTag.atom);
                site3.add(firstTagValue.atom);

                const secondDelete = site2.delete(firstTagValue.atom, 1, 3);
                const secondRename = site2.insert(1, '1', firstTagValue.atom);
                const thirdRename = site3.insert(0, '99', firstTagValue.atom);

                site1.add(secondDelete.atom);
                site1.add(thirdRename.atom);
                site1.add(secondRename.atom);

                site2.add(thirdRename.atom);

                site3.add(secondDelete.atom);
                site3.add(secondRename.atom);
                
                const expected: any = {
                    'fileId': {
                        id: 'fileId',
                        type: 'object',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: null,
                            'first': '99a1'
                        }
                    }
                };

                expect(site1.value).toMatchObject(expected);
                expect(site2.value).toMatchObject(expected);
                expect(site3.value).toMatchObject(expected);
            });
        });

        describe('metadata', () => {
            it('should produce metadata', () => {
                let tree = new AuxCausalTree(storedTree(site(1)));

                tree.root();
                const file = tree.file('fileId', 'workspace');
                const size = tree.tag('size', file.atom);
                const sizeVal = tree.val(4, size.atom);

                const extra = tree.tag('extra', file.atom);
                const extraVal = tree.val({ test: 'abc' }, extra.atom);

                const last = tree.tag('last', file.atom);
                const lastVal = tree.val('123456', last.atom);

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
            const file = tree.file('testId', 'object');
            const tag = tree.tag('test', file.atom);
            const val = tree.val('abc', tag.atom);

            const files = tree.value;

            const insert = tree.insertIntoTagValue(files['testId'], 'test', '123', 2);

            expect(insert.atom.value).toMatchObject({
                index: 2,
                text: '123'
            });
        });

        it('should insert the given text into the given complex tag value', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId', 'object');
            const tag = tree.tag('test', file.atom);
            const val = tree.val('abc', tag.atom);
            const insert1 = tree.insert(0, 'xyz', val.atom); // xyzabc
            const delete1 = tree.delete(insert1.atom, 0, 1); // yzabc
            const insert2 = tree.insert(0, '1', val.atom); //   yz1abc
            const insert3 = tree.insert(3, '?', val.atom); //   yz1abc?
            const delete2 = tree.delete(val.atom, 0, 3); //     yz1?

            const files = tree.value;

            const insert = tree.insertIntoTagValue(files['testId'], 'test', '5555', 2);

            expect(insert.atom.cause).toEqual(insert2.atom.id);
            expect(insert.atom.value).toMatchObject({
                index: 0,
                text: '5555'
            });
        });
    });

    describe('deleteFrom()', () => {
        it('should delete the specified section of text', () => {
            let tree = new AuxCausalTree(storedTree(site(1)));

            tree.root();
            const file = tree.file('testId', 'object');
            const tag = tree.tag('test', file.atom);
            const val = tree.val('abc', tag.atom);

            const files = tree.value;

            const deleted = tree.deleteFromTagValue(files['testId'], 'test', 1, 2);

            expect(deleted.atom.value).toMatchObject({
                start: 1,
                end: 3
            });
        });

    });
});