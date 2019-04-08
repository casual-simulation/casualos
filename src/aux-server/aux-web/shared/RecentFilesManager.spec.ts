import { RecentFilesManager } from "./RecentFilesManager";
import { FileHelper } from "./FileHelper";
import { AuxCausalTree, createFile } from "@yeti-cgi/aux-common";
import { storedTree, site } from "@yeti-cgi/aux-common/causal-trees";


describe('RecentFilesManager', () => {
    let tree: AuxCausalTree;
    let helper: FileHelper;
    let recent: RecentFilesManager;
    beforeEach(() => {
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, 'user');
        recent = new RecentFilesManager(helper);
    });
    
    describe('addTagDiff()', () => {
        it('should add a recent file for editing a tag', () => {

            expect(recent.files).toEqual([]);

            recent.addTagDiff('testFileId', 'testTag', 'newValue');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId',
                    tags: {
                        testTag: 'newValue',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag']
                    }
                }
            ]);
        });

        it('should limit files to 5 files', () => {

            expect(recent.files).toEqual([]);

            recent.addTagDiff('testFileId1', 'testTag1', 'newValue');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue');
            recent.addTagDiff('testFileId4', 'testTag4', 'newValue');
            recent.addTagDiff('testFileId5', 'testTag5', 'newValue');
            recent.addTagDiff('testFileId6', 'testTag6', 'newValue');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId6',
                    tags: {
                        testTag6: 'newValue',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag6']
                    }
                },
                {
                    id: 'testFileId5',
                    tags: {
                        testTag5: 'newValue',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag5']
                    }
                },
                {
                    id: 'testFileId4',
                    tags: {
                        testTag4: 'newValue',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag4']
                    }
                },
                {
                    id: 'testFileId3',
                    tags: {
                        testTag3: 'newValue',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag3']
                    }
                },
                {
                    id: 'testFileId2',
                    tags: {
                        testTag2: 'newValue',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag2']
                    }
                }
            ]);
        });

        it('should send an updated event', () => {
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });

            recent.addTagDiff('testFileId', 'testTag', 'newValue');

            expect(updates).toEqual([1]);
        });

        it('should move reused IDs to the front of the list with the new value', () => {
            expect(recent.files).toEqual([]);

            recent.addTagDiff('testFileId1', 'testTag1', 'newValue1');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue2');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue3');
            recent.addTagDiff('testFileId1', 'testTag4', 'newValue4');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId1',
                    tags: {
                        testTag4: 'newValue4',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag4']
                    }
                },
                {
                    id: 'testFileId3',
                    tags: {
                        testTag3: 'newValue3',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag3']
                    }
                },
                {
                    id: 'testFileId2',
                    tags: {
                        testTag2: 'newValue2',
                        'aux.shape': 'sphere',
                        'aux._diff': true,
                        'aux._diffTags': ['testTag2']
                    }
                }
            ]);
        });
    });

    describe('addFileDiff()', () => {
        it('should add the given file', () => {
            let file = createFile('testId', {
                test: 'abc',
                "aux.color": 'red'
            });
            recent.addFileDiff(file);

            expect(recent.files).toEqual([
                file
            ]);
        });

        it('should send updates', () => {
            let file = createFile('testId', {
                test: 'abc',
                "aux.color": 'red'
            });
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addFileDiff(file);

            expect(updates).toEqual([
                1
            ]);
        });

        it('should trim to the max length', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                "aux.color": 'red'
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                "aux.color": 'green'
            });
            let file3 = createFile('testId3', {
                test: 'abc',
                "aux.color": 'blue'
            });
            let file4 = createFile('testId4', {
                test: 'abc',
                "aux.color": 'magenta'
            });
            let file5 = createFile('testId5', {
                test: 'abc',
                "aux.color": 'yellow'
            });
            let file6 = createFile('testId6', {
                test: 'abc',
                "aux.color": 'cyan'
            });
            
            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file4);
            recent.addFileDiff(file5);
            recent.addFileDiff(file6);

            expect(recent.files).toEqual([
                file6,
                file5,
                file4,
                file3,
                file2
            ]);
        });

        it('should move reused IDs to the front of the list with the new value', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                "aux.color": 'red'
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                "aux.color": 'green'
            });
            let file3 = createFile('testId3', {
                test: 'abc',
                "aux.color": 'blue'
            });
            let file1_2 = createFile('testId1', {
                test1: '999',
                "aux.color": 'magenta'
            });
            
            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file1_2);

            expect(recent.files).toEqual([
                file1_2,
                file3,
                file2
            ]);
        });

        it('should move files that appear equal to the front of the list', () => {
            let file1 = createFile('testId1', {
                test: 'abc',
                "aux.color": 'red'
            });
            let file2 = createFile('testId2', {
                test: 'abc',
                "aux.color": 'green'
            });
            let file3 = createFile('testId3', {
                test: 'abc',
                "aux.color": 'blue'
            });
            let file4 = createFile('testId4', {
                test: 'abc',
                "aux.color": 'red'
            });
            
            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file4);

            expect(recent.files).toEqual([
                file4,
                file3,
                file2
            ]);
        });
    });

    describe('clear()', () => {
        it('should clear the recent list', () => {
            recent.addTagDiff('fileId', 'tag', 'value');
            recent.clear();
            expect(recent.files).toEqual([]);
        });

        it('should send an update event', () => {
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addTagDiff('fileId', 'tag', 'value');
            recent.clear();

            expect(updates).toEqual([
                1,
                1
            ]);
        });
    });
});