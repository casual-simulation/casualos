import { BotTagChange, BotWatcher, UpdatedBotInfo } from './BotWatcher';
import {
    createPrecalculatedBot,
    PrecalculatedBot,
    PrecalculatedBotsState,
    BotIndex,
    Bot,
    BotIndexEvent,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { BotHelper } from './BotHelper';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { skip } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import {
    del,
    edit,
    insert,
    preserve,
} from '@casual-simulation/aux-common/bots';

describe('BotWatcher', () => {
    let vm: TestAuxVM;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;

    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM('id');
        helper = new BotHelper(vm);
        helper.userId = userId;

        index = new BotIndex();

        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );
    });

    it('should update the bot helper state', () => {
        const state = {
            user: createPrecalculatedBot('user'),
        };
        vm.sendState({
            state: state,
            addedBots: [],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        expect(helper.botsState).toEqual(state);
    });

    it('should update the index state with new bots', () => {
        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const state = {
            test: test,
        };

        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        expect(index.findBotsWithTag('abc')).toEqual([test]);
    });

    it('should update the index state with removed bots', () => {
        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const state = {
            test: test,
        };

        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        const state2 = {
            test: <any>null,
        };
        vm.sendState({
            state: state2,
            addedBots: [],
            updatedBots: [],
            removedBots: ['test'],
            version: null,
        });

        expect(index.findBotsWithTag('abc')).toEqual([]);
    });

    it('should update the index state with updated bots', () => {
        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const state = {
            test: test,
        };

        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        const state2: Partial<PrecalculatedBotsState> = {
            test: <any>{
                tags: {
                    abc: 123,
                },
                values: {
                    abc: 123,
                },
            },
        };
        vm.sendState({
            state: state2,
            addedBots: [],
            updatedBots: ['test'],
            removedBots: [],
            version: null,
        });

        expect(index.findBotsWithTag('abc')).toEqual([
            createPrecalculatedBot('test', {
                abc: 123,
            }),
        ]);
    });

    it('should batch index updates', async () => {
        let updates = [] as BotIndexEvent[][];

        index.events.subscribe((e) => updates.push(e));

        const test = createPrecalculatedBot('test', {
            abc: 'def',
        });
        const test2 = createPrecalculatedBot('test2', {
            hello: 'world',
        });
        const state = {
            test: test,
            test2: test2,
        };

        vm.sendState({
            state: state,
            addedBots: ['test', 'test2'],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        const state2: Partial<PrecalculatedBotsState> = {
            test: <any>{
                tags: {
                    abc: 123,
                },
                values: {
                    abc: 123,
                },
            },
            test2: null,
        };
        vm.sendState({
            state: state2,
            addedBots: [],
            updatedBots: ['test'],
            removedBots: ['test2'],
            version: null,
        });

        await waitAsync();

        expect(updates).toEqual([
            [
                {
                    type: 'bot_tag_added',
                    bot: test,
                    tag: 'abc',
                },
                {
                    type: 'bot_tag_added',
                    bot: test2,
                    tag: 'hello',
                },
            ],
            [
                {
                    type: 'bot_tag_removed',
                    bot: test2,
                    oldBot: test2,
                    tag: 'hello',
                },
                {
                    type: 'bot_tag_updated',
                    bot: createPrecalculatedBot('test', { abc: 123 }),
                    oldBot: test,
                    tag: 'abc',
                },
            ],
        ]);
    });

    it('should merge the new state with the current state', () => {
        vm.sendState({
            state: {
                user: createPrecalculatedBot('user'),
                bot: createPrecalculatedBot('bot'),
            },
            addedBots: [],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        vm.sendState({
            state: {
                test: createPrecalculatedBot('test'),
                user: <PrecalculatedBot>(<Partial<PrecalculatedBot>>{
                    tags: {
                        abc: 'def',
                    },
                    values: {
                        abc: 'def',
                    },
                }),
                bot: null,
            },
            addedBots: [],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        expect(helper.botsState).toEqual({
            user: createPrecalculatedBot('user', {
                abc: 'def',
            }),
            test: createPrecalculatedBot('test'),
        });
    });

    it('should merge the new version with the latest version', () => {
        vm.sendState({
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
            version: {
                currentSite: 'abc',
                remoteSite: 'def',
                vector: {
                    abc: 123,
                    def: 456,
                },
            },
        });

        expect(watcher.latestVersion).toEqual({
            localSites: {
                abc: true,
            },
            vector: {
                abc: 123,
                def: 456,
            },
        });

        vm.sendState({
            state: {},
            addedBots: [],
            updatedBots: [],
            removedBots: [],
            version: {
                currentSite: 'new',
                remoteSite: 'remote',
                vector: {
                    abc: 999,
                    def: 1000,
                    new: 123,
                    remote: 456,
                },
            },
        });

        expect(watcher.latestVersion).toEqual({
            localSites: {
                abc: true,
                new: true,
            },
            vector: {
                abc: 999,
                def: 1000,
                new: 123,
                remote: 456,
            },
        });
    });

    it('should handle tag edits', () => {
        const state = {
            test: createPrecalculatedBot('test', {
                abc: 'def',
                ghi: 'jfk',
            }),
        };
        vm.sendState({
            state: state,
            addedBots: ['test'],
            updatedBots: [],
            removedBots: [],
            version: null,
        });

        vm.sendState(
            stateUpdatedEvent({
                test: {
                    tags: {
                        abc: edit({}, preserve(1), insert('p')),
                        ghi: edit({}, del(3)),
                    },
                    values: {
                        abc: 'dpef',
                        ghi: null,
                    },
                },
            })
        );

        expect(helper.botsState).toEqual({
            test: createPrecalculatedBot('test', {
                abc: 'dpef',
            }),
        });
    });

    describe('botsDiscovered', () => {
        it('should resolve with the added bots', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botsDiscovered.subscribe((f) => bots.push(...f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([state['test'], state['test2']]);
        });

        it('should not send an update if no bots were added', async () => {
            let bots: PrecalculatedBot[][] = [];
            watcher.botsDiscovered.subscribe((f) => bots.push(f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            vm.sendState({
                state: {},
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([[state['test'], state['test2']]]);
        });

        it('should resolve with the current bots immediately', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botsDiscovered.subscribe((f) => bots.push(...f));

            expect(bots).toEqual([state['test'], state['test2']]);
        });

        it('should not start with bots that were removed', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            state = Object.assign({}, state);
            state['test2'] = null;

            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: [],
                removedBots: ['test2'],
                version: null,
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botsDiscovered.subscribe((f) => bots.push(...f));

            expect(bots).toEqual([state['test']]);
        });
    });

    describe('botsRemoved', () => {
        it('should resolve with the removed bot IDs', async () => {
            let bots: string[] = [];
            watcher.botsRemoved.subscribe((f) => bots.push(...f));

            vm.sendState({
                state: {},
                addedBots: [],
                updatedBots: [],
                removedBots: ['test', 'test2'],
                version: null,
            });

            expect(bots).toEqual(['test', 'test2']);
        });

        it('should not send an update if no bots were removed', async () => {
            let bots: string[][] = [];
            watcher.botsRemoved.subscribe((f) => bots.push(f));

            vm.sendState({
                state: {},
                addedBots: [],
                updatedBots: [],
                removedBots: ['test', 'test2'],
                version: null,
            });
            vm.sendState({
                state: {},
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([['test', 'test2']]);
        });
    });

    describe('botsUpdated', () => {
        it('should resolve with the updated bots', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botsUpdated.subscribe((f) => bots.push(...f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([state['test'], state['test2']]);
        });

        it('should not send an update if no bots were updated', async () => {
            let bots: PrecalculatedBot[][] = [];
            watcher.botsUpdated.subscribe((f) => bots.push(f));

            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
                version: null,
            });

            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([[state['test'], state['test2']]]);
        });

        it('should omit tags that are null', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botsUpdated.subscribe((f) => bots.push(...f));

            vm.sendState({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                },
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let state: any = {
                test: {
                    tags: {
                        abc: null,
                    },
                    values: {
                        abc: null,
                    },
                },
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([createPrecalculatedBot('test')]);
        });
    });

    describe('botTagsUpdated', () => {
        it('should include tags whose value was updated but the formula was not', async () => {
            vm.sendState({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                },
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsUpdated.subscribe((f) => bots.push(...f));

            let state: any = {
                test: {
                    values: {
                        abc: 'red',
                    },
                },
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([
                {
                    bot: createPrecalculatedBot(
                        'test',
                        {
                            abc: 'red',
                        },
                        { abc: 'def' }
                    ),
                    tags: new Set(['abc']),
                },
            ]);
        });

        it('should not send an update when no bots were updated', async () => {
            vm.sendState({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                },
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: UpdatedBotInfo[][] = [];
            watcher.botTagsUpdated.subscribe((f) => bots.push(f));

            let state: any = {
                test: {
                    values: {
                        abc: 'red',
                    },
                },
            };
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
                version: null,
            });

            vm.sendState({
                state: {},
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([
                [
                    {
                        bot: createPrecalculatedBot(
                            'test',
                            {
                                abc: 'red',
                            },
                            { abc: 'def' }
                        ),
                        tags: new Set(['abc']),
                    },
                ],
            ]);
        });
    });

    describe('botChanged()', () => {
        it('should return an observable that only resolved when the given bot changes', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botChanged('test').subscribe((f) => bots.push(f));

            let secondState = {
                test: createPrecalculatedBot('test', { abc: 'def' }),
                test2: createPrecalculatedBot('test2', { ghi: 'jfk' }),
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([state['test'], secondState['test']]);
        });

        it('should resolve with null if the given bot ID is deleted', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: PrecalculatedBot[] = [];
            watcher.botChanged('test').subscribe((f) => bots.push(f));

            let secondState: PrecalculatedBotsState = {
                test: null,
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: ['test'],
                version: null,
            });

            expect(bots).toEqual([state['test'], null]);
        });

        it('should resolve with the bot when it is added', async () => {
            let bots: PrecalculatedBot[] = [];
            watcher.botChanged('test').subscribe((f) => bots.push(f));

            let state = {
                test: createPrecalculatedBot('test'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let secondState = {
                test: createPrecalculatedBot('test', { abc: 'def' }),
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([state['test'], secondState['test']]);
        });

        it('should handle updates for bots that dont exist', async () => {
            let state = {};
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: Bot[] = [];
            let err: any;
            watcher.botChanged('test').subscribe(
                (f) => bots.push(f),
                (e) => (err = e)
            );

            let secondState = {};
            vm.sendState({
                state: <any>secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
                version: null,
            });

            await waitAsync();

            expect(bots).toEqual([]);
            expect(err).toBeFalsy();
        });
    });

    describe('botTagsChanged()', () => {
        it('should return an observable that resolves with the tags that changed on a bot', async () => {
            let state = {
                test: createPrecalculatedBot('test', { test: 123 }),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsChanged('test').subscribe((f) => bots.push(f));

            let secondState = {
                test: createPrecalculatedBot('test', {
                    abc: 'def',
                    test: null,
                }),
                test2: createPrecalculatedBot('test2', { ghi: 'jfk' }),
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test', 'test2'],
                removedBots: [],
                version: null,
            });

            expect(bots).toEqual([
                {
                    bot: state['test'],
                    tags: new Set(['test']),
                },
                {
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tags: new Set(['abc', 'test']),
                },
            ]);
        });

        it('should resolve with null if the given bot ID is deleted', async () => {
            let state = {
                test: createPrecalculatedBot('test'),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsChanged('test').subscribe((f) => bots.push(f));

            let secondState: PrecalculatedBotsState = {
                test: null,
            };
            vm.sendState({
                state: secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: ['test'],
                version: null,
            });

            expect(bots).toEqual([
                {
                    bot: state['test'],
                    tags: new Set(),
                },
                null,
            ]);
        });

        it('should not resolve with a null bot if the bot is not created yet', async () => {
            let state = {
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: UpdatedBotInfo[] = [];
            watcher.botTagsChanged('test').subscribe((f) => bots.push(f));

            let secondState: PrecalculatedBotsState = {
                test: createPrecalculatedBot('test'),
            };
            vm.sendState({
                state: secondState,
                addedBots: ['test'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            await waitAsync();

            expect(bots).toEqual([
                {
                    bot: secondState['test'],
                    tags: new Set(),
                },
            ]);
        });

        it('should handle updates for bots that dont exist', async () => {
            let state = {};
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let bots: UpdatedBotInfo[] = [];
            let err: any;
            watcher.botTagsChanged('test').subscribe(
                (f) => bots.push(f),
                (e) => (err = e)
            );

            let secondState = {};
            vm.sendState({
                state: <any>secondState,
                addedBots: [],
                updatedBots: ['test'],
                removedBots: [],
                version: null,
            });

            await waitAsync();

            expect(bots).toEqual([]);
            expect(err).toBeFalsy();
        });
    });

    describe('botTagChanged()', () => {
        it('should return an observable that resolves with the tag that changed on a bot', async () => {
            let state = {
                test: createPrecalculatedBot('test', { test: 123 }),
                test2: createPrecalculatedBot('test2'),
            };
            vm.sendState({
                state: state,
                addedBots: ['test', 'test2'],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc')
                .subscribe((f) => changes.push(f));

            let secondUpdate = stateUpdatedEvent({
                test: {
                    tags: {
                        abc: 'def',
                        test: null,
                    },
                    values: {
                        abc: 'def',
                        test: null,
                    },
                },
                test2: {
                    tags: {
                        ghi: 'jfk',
                    },
                    values: {
                        ghi: 'jfk',
                    },
                },
            });
            vm.sendState(secondUpdate);

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { test: 123 }),
                    tag: 'abc',
                    space: null,
                    version: {},
                },
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tag: 'abc',
                    space: null,
                    version: {},
                },
            ]);
        });

        it('should return an observable that resolves when the bot is added', async () => {
            let state = {};
            vm.sendState({
                state: state,
                addedBots: [],
                updatedBots: [],
                removedBots: [],
                version: null,
            });

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc')
                .subscribe((f) => changes.push(f));

            let secondUpdate = stateUpdatedEvent({
                test: createPrecalculatedBot('test', {
                    abc: 'def',
                }),
            });
            vm.sendState(secondUpdate);

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: null,
                    tag: 'abc',
                    space: null,
                    version: {},
                },
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tag: 'abc',
                    space: null,
                    version: {},
                },
            ]);
        });

        it('should return an observable that resolves with the current tag value', async () => {
            let state = {};
            vm.sendState(
                stateUpdatedEvent({
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                })
            );

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc')
                .subscribe((f) => changes.push(f));

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tag: 'abc',
                    space: null,
                    version: {},
                },
            ]);
        });

        it('should return an observable that resolves with null when the bot is deleted', async () => {
            vm.sendState(
                stateUpdatedEvent({
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                })
            );

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc')
                .subscribe((f) => changes.push(f));

            let secondUpdate = stateUpdatedEvent({
                test: null,
            });
            vm.sendState(secondUpdate);

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tag: 'abc',
                    space: null,
                    version: {},
                },
                null,
            ]);
        });

        it('should return an observable that resolves with edits for the tag', async () => {
            vm.sendState(
                stateUpdatedEvent({
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                })
            );

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc')
                .subscribe((f) => changes.push(f));

            let secondUpdate = stateUpdatedEvent({
                test: {
                    tags: {
                        abc: edit({}, preserve(1), insert('1'), del(1)),
                    },
                    values: {
                        abc: 'd1f',
                    },
                },
            });
            vm.sendState(secondUpdate);

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tag: 'abc',
                    space: null,
                    version: {},
                },
                {
                    type: 'edit',
                    bot: createPrecalculatedBot('test', {
                        abc: 'd1f',
                    }),
                    tag: 'abc',
                    space: null,
                    operations: [[preserve(1), insert('1'), del(1)]],
                    version: {},
                },
            ]);
        });

        it('should support edits on tag masks', async () => {
            vm.sendState(
                stateUpdatedEvent({
                    test: {
                        id: 'test',
                        precalculated: true,
                        tags: {},
                        masks: {
                            shared: {
                                abc: 'def',
                            },
                        },
                        values: {
                            abc: 'def',
                        },
                    },
                })
            );

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc', 'shared')
                .subscribe((f) => changes.push(f));

            let secondUpdate = stateUpdatedEvent({
                test: {
                    masks: {
                        shared: {
                            abc: edit(
                                { a: 1 },
                                preserve(1),
                                insert('1'),
                                del(1)
                            ),
                        },
                    },
                    values: {
                        abc: 'd1f',
                    },
                },
            });
            vm.sendState(secondUpdate);

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: {
                        id: 'test',
                        precalculated: true,
                        tags: {},
                        masks: {
                            shared: {
                                abc: 'def',
                            },
                        },
                        values: {
                            abc: 'def',
                        },
                    },
                    tag: 'abc',
                    space: 'shared',
                    version: {},
                },
                {
                    type: 'edit',
                    bot: {
                        id: 'test',
                        precalculated: true,
                        tags: {},
                        masks: {
                            shared: {
                                abc: 'd1f',
                            },
                        },
                        values: {
                            abc: 'd1f',
                        },
                    },
                    tag: 'abc',
                    space: 'shared',
                    operations: [[preserve(1), insert('1'), del(1)]],
                    version: { a: 1 },
                },
            ]);
        });

        it('should return the version for the update', async () => {
            vm.sendState(
                stateUpdatedEvent(
                    {
                        test: createPrecalculatedBot('test', {
                            abc: 'def',
                        }),
                    },
                    {
                        currentSite: 'site1',
                        remoteSite: 'site2',
                        vector: {
                            site1: 123,
                            site2: 456,
                        },
                    }
                )
            );

            let changes: BotTagChange[] = [];
            watcher
                .botTagChanged('test', 'abc')
                .subscribe((f) => changes.push(f));

            let secondUpdate = stateUpdatedEvent({
                test: {
                    tags: {
                        abc: edit(
                            {
                                site3: 987,
                                site4: 654,
                            },
                            preserve(1),
                            insert('1'),
                            del(1)
                        ),
                    },
                    values: {
                        abc: 'd1f',
                    },
                },
            });
            vm.sendState(secondUpdate);

            vm.sendState(
                stateUpdatedEvent(
                    {
                        test: {
                            tags: {
                                abc: 123,
                            },
                            values: {
                                abc: 123,
                            },
                        },
                    },
                    {
                        currentSite: 'site5',
                        remoteSite: 'site6',
                        vector: {
                            site5: 999,
                            site6: 555,
                        },
                    }
                )
            );

            expect(changes).toEqual([
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', { abc: 'def' }),
                    tag: 'abc',
                    space: null,
                    version: {
                        site1: 123,
                        site2: 456,
                    },
                },
                {
                    type: 'edit',
                    bot: createPrecalculatedBot('test', {
                        abc: 'd1f',
                    }),
                    tag: 'abc',
                    space: null,
                    operations: [[preserve(1), insert('1'), del(1)]],
                    version: {
                        site3: 987,
                        site4: 654,
                    },
                },
                {
                    type: 'update',
                    bot: createPrecalculatedBot('test', {
                        abc: 123,
                    }),
                    tag: 'abc',
                    space: null,
                    version: {
                        site5: 999,
                        site6: 555,
                    },
                },
            ]);
        });
    });
});
