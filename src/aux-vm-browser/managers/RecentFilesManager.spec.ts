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

    it('should start with an empty bot', () => {
        expect(recent.bots).toEqual([
            {
                id: 'empty',
                precalculated: true,
                tags: {},
                values: {},
            },
        ]);
    });

    describe('addTagDiff()', () => {
        it('should add a recent bot for editing a tag', () => {
            recent.addTagDiff('testFileId', 'testTag', 'newValue');

            expect(recent.bots).toEqual([
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

        it('should limit bots to 1 bot', () => {
            recent.addTagDiff('testFileId1', 'testTag1', 'newValue');
            recent.addTagDiff('testFileId2', 'testTag2', 'newValue');
            recent.addTagDiff('testFileId3', 'testTag3', 'newValue');
            recent.addTagDiff('testFileId4', 'testTag4', 'newValue');
            recent.addTagDiff('testFileId5', 'testTag5', 'newValue');
            recent.addTagDiff('testFileId6', 'testTag6', 'newValue');

            expect(recent.bots).toEqual([
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

            expect(recent.bots).toEqual([
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

        it('should unselect the selected recent bot', () => {
            recent.addTagDiff('abc', 'deg', 'ghi');
            recent.selectedRecentBot = recent.bots[0];

            recent.addTagDiff('xyz', 'deg', 'ghi');

            expect(recent.selectedRecentBot).toBe(null);
        });

        it('should preserve the selected recent bot if the ID is the same', () => {
            recent.addTagDiff('abc', 'deg', 'ghi');
            recent.selectedRecentBot = recent.bots[0];

            recent.addTagDiff('abc', 'deg', 'zzz');

            expect(recent.selectedRecentBot).toEqual({
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

    describe('addBotDiff()', () => {
        it('should add the given bot', () => {
            let bot = createBot('testId', {
                test: 'abc',
                'aux.color': 'red',
            });
            recent.addBotDiff(bot);

            expect(recent.bots).toEqual([
                {
                    id: 'mod-testId',
                    precalculated: true,
                    tags: {
                        ...bot.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                    values: {
                        ...bot.tags,
                        'aux.mod': true,
                        'aux.mod.mergeTags': ['test', 'aux.color'],
                    },
                },
            ]);
        });

        it('should unselect the selected recent bot', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });
            let file2 = createBot('testId2', {
                test: 'abc',
                'aux.color': 'green',
            });

            recent.addBotDiff(file1);
            recent.selectedRecentBot = recent.bots[0];

            recent.addBotDiff(file2);

            expect(recent.selectedRecentBot).toBe(null);
        });

        it('should preserve the selected recent bot if the ID is the same', () => {
            let file1 = createBot('testId1', {
                test: 'abc',
                'aux.color': 'red',
            });

            recent.addBotDiff(file1);
            recent.selectedRecentBot = recent.bots[0];

            let file2 = createBot('mod-testId1', {
                test1: 'abc',
                'aux.color': 'red',
                'aux.mod': true,
                'aux.mod.mergeTags': ['test1', 'aux.color'],
            });

            recent.addBotDiff(file2);

            expect(recent.selectedRecentBot).toEqual({
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

            recent.addBotDiff(file1);
            recent.selectedRecentBot = recent.bots[0];

            expect(recent.bots).toEqual([
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
            helper.botsState = {
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

            recent.addBotDiff(file1);
            recent.selectedRecentBot = recent.bots[0];

            expect(recent.bots).toEqual([
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

        it('should be an empty bot if no tags can be used as a diff', async () => {
            helper.botsState = {
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

            recent.addBotDiff(file1);
            recent.selectedRecentBot = recent.bots[0];

            expect(recent.bots).toEqual([
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

            recent.addBotDiff(file1);
            recent.selectedRecentBot = recent.bots[0];

            let file2 = createBot('mod-testId1', {
                test1: 'abc',
                'aux.color': 'red',
                'aux.mod': true,
                'aux.mod.mergeTags': ['test1', 'aux.color'],
            });

            recent.addBotDiff(file2, true);

            expect(recent.selectedRecentBot).toEqual({
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
            let bot = createBot('testId', {
                test: 'abc',
                'aux.color': 'red',
            });
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addBotDiff(bot);

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

            recent.addBotDiff(file1);
            recent.addBotDiff(file2);
            recent.addBotDiff(file3);
            recent.addBotDiff(file4);
            recent.addBotDiff(file5);
            recent.addBotDiff(file6);

            expect(recent.bots).toEqual([
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

            recent.addBotDiff(file1);
            recent.addBotDiff(file2);
            recent.addBotDiff(file3);
            recent.addBotDiff(file1_2);

            expect(recent.bots).toEqual([
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

        it('should move bots that appear equal to the front of the list', () => {
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

            recent.addBotDiff(file1);
            recent.addBotDiff(file2);
            recent.addBotDiff(file3);
            recent.addBotDiff(file4);

            expect(recent.bots).toEqual([
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

            recent.addBotDiff(file1);

            expect(recent.bots).toEqual([
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

            recent.addBotDiff(file1);

            expect(recent.bots).toEqual([
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
            recent.addTagDiff('botId', 'tag', 'value');
            recent.clear();
            expect(recent.bots).toEqual([
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
            recent.addTagDiff('botId', 'tag', 'value');
            recent.clear();

            expect(updates).toEqual([1, 1]);
        });
    });
});
