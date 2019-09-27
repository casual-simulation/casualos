import { RecentFilesManager } from './RecentFilesManager';
import { BotHelper } from '@casual-simulation/aux-vm';
import {
    createBot,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';

describe('RecentFilesManager', () => {
    let vm: TestAuxVM;
    let helper: BotHelper;
    let recent: RecentFilesManager;
    beforeEach(async () => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
        helper.userId = 'user';
        recent = new RecentFilesManager(helper);
    });

    it('should start with an empty file', () => {
        expect(recent.files).toEqual([
            {
                id: 'empty',
                precalculated: true,
                tags: {},
                values: {},
            },
        ]);
    });

    describe('addTagDiff()', () => {
        it('should add a recent file for editing a tag', () => {
            recent.addTagDiff('testFileId', 'testTag', 'newValue');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId',
                    precalculated: true,
                    tags: {
                        testTag: 'newValue',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['testTag'],
                    },
                    values: {
                        testTag: 'newValue',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['testTag'],
                    },
                },
            ]);
        });

        it('should limit files to 1 file', () => {
            recent.addTagDiff('testFileId1', 'testTag1', 'newValue');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue');
            recent.addTagDiff('testFileId4', 'testTag4', 'newValue');
            recent.addTagDiff('testFileId5', 'testTag5', 'newValue');
            recent.addTagDiff('testFileId6', 'testTag6', 'newValue');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId6',
                    precalculated: true,
                    tags: {
                        testTag6: 'newValue',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['testTag6'],
                    },
                    values: {
                        testTag6: 'newValue',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['testTag6'],
                    },
                },
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
            recent.addTagDiff('testFileId1', 'testTag1', 'newValue1');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue2');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue3');
            recent.addTagDiff('testFileId1', 'testTag4', 'newValue4');

            expect(recent.files).toEqual([
                {
                    id: 'testFileId1',
                    precalculated: true,
                    tags: {
                        testTag4: 'newValue4',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['testTag4'],
                    },
                    values: {
                        testTag4: 'newValue4',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['testTag4'],
                    },
                },
            ]);
        });

        it('should unselect the selected recent file', () => {
            recent.addTagDiff('abc', 'deg', 'ghi');
            recent.selectedRecentFile = recent.files[0];

            recent.addTagDiff('xyz', 'deg', 'ghi');

            expect(recent.selectedRecentFile).toBe(null);
        });

        it('should preserve the selected recent file if the ID is the same', () => {
            recent.addTagDiff('abc', 'deg', 'ghi');
            recent.selectedRecentFile = recent.files[0];

            recent.addTagDiff('abc', 'deg', 'zzz');

            expect(recent.selectedRecentFile).toEqual({
                id: 'abc',
                precalculated: true,
                tags: {
                    deg: 'zzz',
                    'aux.mod': true,
                    'aux.mod.mergeTags': ['deg'],
                },
                values: {
                    deg: 'zzz',
                    'aux.mod': true,
                    'aux.mod.mergeTags': ['deg'],
                },
            });
        });
    });

    describe('addFileDiff()', () => {
        it('should add the given file', () => {
            let file = createBot('testId', {
                test: 'abc',
                'aux.color': 'red',
            });
            recent.addFileDiff(file);

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId',
                    precalculated: true,
                    tags: {
                        ...file.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                    values: {
                        ...file.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should unselect the selected recent file', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createBot('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            recent.addFileDiff(file2);

            expect(recent.selectedRecentFile).toBe(null);
        });

        it('should preserve the selected recent file if the ID is the same', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            let file2 = createBot('mod-testId1', {
                test1: 'abc',
                'aux.color': 'red',
                'aux.mod': true,
                'aux.mod.mergeTags': ['test1', 'aux.color'],
            });

            recent.addFileDiff(file2);

            expect(recent.selectedRecentFile).toEqual({
                id: 'mod-testId1',
                precalculated: true,
                tags: {
                    test1: 'abc',
                    'aux.color': 'red',
                    'aux.mod': true,
                    'aux.mod.mergeTags': ['test1', 'aux.color'],
                },
                values: {
                    test1: 'abc',
                    'aux.color': 'red',
                    'aux.mod': true,
                    'aux.mod.mergeTags': ['test1', 'aux.color'],
                },
            });
        });

        it('should ignore well known tags', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux._destroyed': true,
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId1',
                    precalculated: true,
                    tags: {
                        test: 'abc',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test'],
                    },
                    values: {
                        test: 'abc',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test'],
                    },
                },
            ]);
        });

        it('should ignore context tags', () => {
            helper.filesState = {
                context: createPrecalculatedBot('context', {
                    'aux.context': 'abc',
                }),
            };

            let file1 = createBot('testId1', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                'abc.index': 100,
                def: true,
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId1',
                    precalculated: true,
                    tags: {
                        def: true,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['def'],
                    },
                    values: {
                        def: true,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['def'],
                    },
                },
            ]);
        });

        it('should be an empty file if no tags can be used as a diff', async () => {
            helper.filesState = {
                context: createPrecalculatedBot('context', {
                    'aux.context': 'abc',
                }),
            };

            let file1 = createBot('testId1', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                'abc.index': 100,
                'aux._user': 'abc',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            expect(recent.files).toEqual([
                {
                    id: 'empty',
                    precalculated: true,
                    tags: {},
                    values: {},
                },
            ]);
        });

        it('should update the diff tags', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addFileDiff(file1);
            recent.selectedRecentFile = recent.files[0];

            let file2 = createBot('mod-testId1', {
                test1: 'abc',
                'aux.color': 'red',
                'aux.mod': true,
                'aux.mod.mergeTags': ['test1', 'aux.color'],
            });

            recent.addFileDiff(file2, true);

            expect(recent.selectedRecentFile).toEqual({
                id: 'mod-testId1',
                precalculated: true,
                tags: {
                    test1: 'abc',
                    'aux.color': 'red',
                    'aux.mod': true,
                    'aux.mod.mergeTags': ['test1', 'aux.color'],
                },
                values: {
                    test1: 'abc',
                    'aux.color': 'red',
                    'aux.mod': true,
                    'aux.mod.mergeTags': ['test1', 'aux.color'],
                },
            });
        });

        it('should send updates', () => {
            let file = createBot('testId', {
                test: 'abc',
                'aux.color': 'red',
            });
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addFileDiff(file);

            expect(updates).toEqual([1]);
        });

        it('should trim to the max length', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createBot('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });
            let file3 = createBot('testId3', {
                test: 'abc',
                'aux.color': 'blue',
            });
            let file4 = createBot('testId4', {
                test: 'abc',
                'aux.color': 'magenta',
            });
            let file5 = createBot('testId5', {
                test: 'abc',
                'aux.color': 'yellow',
            });
            let file6 = createBot('testId6', {
                test: 'abc',
                'aux.color': 'cyan',
            });

            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file4);
            recent.addFileDiff(file5);
            recent.addFileDiff(file6);

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId6',
                    precalculated: true,
                    tags: {
                        ...file6.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                    values: {
                        ...file6.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should move reused IDs to the front of the list with the new value', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createBot('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });
            let file3 = createBot('testId3', {
                test: 'abc',
                'aux.color': 'blue',
            });
            let file1_2 = createBot('testId1', {
                test1: '999',
                'aux.color': 'magenta',
            });

            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file1_2);

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId1',
                    precalculated: true,
                    tags: {
                        ...file1_2.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test1', 'aux.color'],
                    },
                    values: {
                        ...file1_2.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test1', 'aux.color'],
                    },
                },
            ]);
        });

        it('should move files that appear equal to the front of the list', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createBot('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });
            let file3 = createBot('testId3', {
                test: 'abc',
                'aux.color': 'blue',
            });
            let file4 = createBot('testId4', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addFileDiff(file1);
            recent.addFileDiff(file2);
            recent.addFileDiff(file3);
            recent.addFileDiff(file4);

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId4',
                    precalculated: true,
                    tags: {
                        ...file4.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                    values: {
                        ...file4.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should ensure that diff IDs start with mod-', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
                'aux.mod': true,
                'aux.mod.mergeTags': ['aux.color'],
            });

            recent.addFileDiff(file1);

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId1',
                    precalculated: true,
                    tags: {
                        'aux.color': 'red',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['aux.color'],
                    },
                    values: {
                        'aux.color': 'red',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['aux.color'],
                    },
                },
            ]);
        });

        it('should reuse the diff ID if it is correct', () => {
            let file1 = createBot('mod-testId1', {
                test: 'abc',
                'aux.color': 'red',
                'aux.mod': true,
                'aux.mod.mergeTags': ['aux.color'],
            });

            recent.addFileDiff(file1);

            expect(recent.files).toEqual([
                {
                    id: 'mod-testId1',
                    precalculated: true,
                    tags: {
                        'aux.color': 'red',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['aux.color'],
                    },
                    values: {
                        'aux.color': 'red',
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['aux.color'],
                    },
                },
            ]);
        });
    });

    describe('clear()', () => {
        it('should clear the recent list', () => {
            recent.addTagDiff('fileId', 'tag', 'value');
            recent.clear();
            expect(recent.files).toEqual([
                {
                    id: 'empty',
                    precalculated: true,
                    tags: {},
                    values: {},
                },
            ]);
        });

        it('should send an update event', () => {
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addTagDiff('fileId', 'tag', 'value');
            recent.clear();

            expect(updates).toEqual([1, 1]);
        });
    });
});
