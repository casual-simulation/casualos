import { AuxCausalTree } from "./AuxCausalTree";
import { AtomFactory } from "../channels-core/AtomFactory";
import { AuxOp } from "./AuxOpTypes";
import { FilesState } from "../Files";
import { site } from "../channels-core/SiteIdInfo";

describe('AuxCausalTree', () => {
    describe('value', () => {
        it('should add files to the state', () => {
            let tree = new AuxCausalTree(site(1));

            tree.root();
            tree.file('fileId', 'object');

            expect(tree.value).toEqual({
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null
                    }
                }
            });
        });

        it('should use last write wins for duplicate files', () => {
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));

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
            
            expect(site1.value).toEqual({
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        other: null
                    }
                }
            });
        });

        it('should use last write wins for file deletions', () => {
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));

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
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));

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
            
            expect(site1.value).toEqual({
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        test: '123'
                    }
                }
            });
        });

        it('should allow multiple tags', () => {
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));

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
            
            expect(site1.value).toEqual({
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        test: 'abc',
                        other: '123'
                    }
                }
            });
        });

        it('should use last write wins for tag values', () => {
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));

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
            
            expect(site1.value).toEqual({
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        test: '123'
                    }
                }
            });
        });

        it('should use sequence for tag renaming', () => {
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));
            let site3 = new AuxCausalTree(site(3));

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

            const expected: FilesState = {
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        '99reallylong1': 'abc'
                    }
                }
            };
            
            expect(site1.value).toEqual(expected);
            expect(site2.value).toEqual(expected);
            expect(site3.value).toEqual(expected);
        });

        it('should use sequence for tag renaming', () => {
            let site1 = new AuxCausalTree(site(1));
            let site2 = new AuxCausalTree(site(2));
            let site3 = new AuxCausalTree(site(3));

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
            
            const expected: FilesState = {
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

            expect(site1.value).toEqual(expected);
            expect(site2.value).toEqual(expected);
            expect(site3.value).toEqual(expected);
        });

        it('should ignore tags with empty names', () => {
            let site1 = new AuxCausalTree(site(1));

            const root = site1.root();

            const first = site1.file('fileId', 'object');
            const firstTag = site1.tag('first', first.atom);
            site1.delete(firstTag.atom, 0, 5);
            
            const expected: FilesState = {
                'fileId': {
                    id: 'fileId',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    }
                }
            };

            expect(site1.value).toEqual(expected);
        });
    });
});