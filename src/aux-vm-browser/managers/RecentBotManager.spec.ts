import { RecentBotManager } from './RecentBotManager';
import { BotHelper } from '@casual-simulation/aux-vm';
import {
    createBot,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';

describe('RecentBotManager', () => {
    let vm: TestAuxVM;
    let helper: BotHelper;
    let recent: RecentBotManager;
    beforeEach(async () => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
        helper.userId = 'user';
        recent = new RecentBotManager(helper);
    });

    it('should start with an empty bot', () => {
        expect(recent.bot).toEqual({
            id: 'empty',
            precalculated: true,
            tags: {},
            values: {},
        });
    });

    describe('addBotDiff()', () => {
        it('should add the given bot', () => {
            let bot = createBot('testId', {
                test: 'abc',
                auxColor: 'red',
            });
            recent.addBotDiff(bot);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    ...bot.tags,
                },
                values: {
                    ...bot.tags,
                },
            });
        });

        it('should ignore well known tags', () => {
            let bot1 = createBot('testId1', {
                test: 'abc',
                'aux._destroyed': true,
            });

            recent.addBotDiff(bot1);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    test: 'abc',
                },
                values: {
                    test: 'abc',
                },
            });
        });

        it('should ignore context tags', () => {
            helper.botsState = {
                context: createPrecalculatedBot('context', {
                    'aux.context': 'abc',
                }),
            };

            let bot1 = createBot('testId1', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                'abc.index': 100,
                def: true,
            });

            recent.addBotDiff(bot1);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    def: true,
                },
                values: {
                    def: true,
                },
            });
        });

        it('should be an empty bot if no tags can be used as a diff', async () => {
            helper.botsState = {
                context: createPrecalculatedBot('context', {
                    'aux.context': 'abc',
                }),
            };

            let bot1 = createBot('testId1', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                'abc.index': 100,
                'aux._user': 'abc',
            });

            recent.addBotDiff(bot1);

            expect(recent.bot).toEqual({
                id: 'empty',
                precalculated: true,
                tags: {},
                values: {},
            });
        });

        it('should send updates', () => {
            let bot = createBot('testId', {
                test: 'abc',
                auxColor: 'red',
            });
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            recent.addBotDiff(bot);

            expect(updates).toEqual([1]);
        });

        it('should trim to the max length', () => {
            let bot1 = createBot('testId1', {
                test: 'abc',
                auxColor: 'red',
            });
            let bot2 = createBot('testId2', {
                test: 'abc',
                auxColor: 'green',
            });
            let bot3 = createBot('testId3', {
                test: 'abc',
                auxColor: 'blue',
            });
            let bot4 = createBot('testId4', {
                test: 'abc',
                auxColor: 'magenta',
            });
            let bot5 = createBot('testId5', {
                test: 'abc',
                auxColor: 'yellow',
            });
            let bot6 = createBot('testId6', {
                test: 'abc',
                auxColor: 'cyan',
            });

            recent.addBotDiff(bot1);
            recent.addBotDiff(bot2);
            recent.addBotDiff(bot3);
            recent.addBotDiff(bot4);
            recent.addBotDiff(bot5);
            recent.addBotDiff(bot6);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    ...bot6.tags,
                },
                values: {
                    ...bot6.tags,
                },
            });
        });

        it('should move reused IDs to the front of the list with the new value', () => {
            let bot1 = createBot('testId1', {
                test: 'abc',
                auxColor: 'red',
            });
            let bot2 = createBot('testId2', {
                test: 'abc',
                auxColor: 'green',
            });
            let bot3 = createBot('testId3', {
                test: 'abc',
                auxColor: 'blue',
            });
            let bot1_2 = createBot('testId1', {
                test1: '999',
                auxColor: 'magenta',
            });

            recent.addBotDiff(bot1);
            recent.addBotDiff(bot2);
            recent.addBotDiff(bot3);
            recent.addBotDiff(bot1_2);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    ...bot1_2.tags,
                },
                values: {
                    ...bot1_2.tags,
                },
            });
        });

        it('should move bots that appear equal to the front of the list', () => {
            let bot1 = createBot('testId1', {
                test: 'abc',
                auxColor: 'red',
            });
            let bot2 = createBot('testId2', {
                test: 'abc',
                auxColor: 'green',
            });
            let bot3 = createBot('testId3', {
                test: 'abc',
                auxColor: 'blue',
            });
            let bot4 = createBot('testId4', {
                test: 'abc',
                auxColor: 'red',
            });

            recent.addBotDiff(bot1);
            recent.addBotDiff(bot2);
            recent.addBotDiff(bot3);
            recent.addBotDiff(bot4);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    ...bot4.tags,
                },
                values: {
                    ...bot4.tags,
                },
            });
        });

        it('should ensure that diff IDs are mod', () => {
            let bot1 = createBot('testId1', {
                test: 'abc',
                auxColor: 'red',
            });

            recent.addBotDiff(bot1);

            expect(recent.bot).toEqual({
                id: 'mod',
                precalculated: true,
                tags: {
                    auxColor: 'red',
                    test: 'abc',
                },
                values: {
                    auxColor: 'red',
                    test: 'abc',
                },
            });
        });
    });

    describe('clear()', () => {
        it('should clear the recent list', () => {
            let bot1 = createBot('mod-testId1', {
                test: 'abc',
                auxColor: 'red',
            });
            recent.addBotDiff(bot1);
            recent.clear();
            expect(recent.bot).toEqual({
                id: 'empty',
                precalculated: true,
                tags: {},
                values: {},
            });
        });

        it('should send an update event', () => {
            let updates: number[] = [];
            recent.onUpdated.subscribe(_ => {
                updates.push(1);
            });
            let bot1 = createBot('mod-testId1', {
                test: 'abc',
                auxColor: 'red',
            });
            recent.addBotDiff(bot1);
            recent.clear();

            expect(updates).toEqual([1, 1]);
        });
    });
});
