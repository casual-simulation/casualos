import { IdeNode, IdePortalManager } from './IdePortalManager';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    PrecalculatedBot,
    BotIndex,
    botUpdated,
    botRemoved,
    registerPrefix,
    BotsState,
    BotAction,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject } from 'rxjs';
import { locale } from 'faker';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

describe('IdePortalManager', () => {
    let manager: IdePortalManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';
    let localEvents: Subject<BotAction[]>;

    beforeEach(async () => {
        vm = new TestAuxVM('sim', userId);
        vm.processEvents = true;
        localEvents = vm.localEvents = new Subject();
        helper = new BotHelper(vm);
        helper.userId = userId;
        index = new BotIndex();

        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );

        await vm.sendEvents([
            botAdded(
                createBot('user', {
                    idePortal: '🔺',
                })
            ),
        ]);

        localEvents.next([
            registerPrefix('🔺', {
                language: 'javascript',
            }),
        ]);

        manager = new IdePortalManager(watcher, helper, false);
    });

    describe('botsUpdated', () => {
        it('should resolve whenever a bot with the correct prefix is added', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
            ]);

            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        other: '🔺myScript',
                    })
                ),
            ]);

            await waitAsync();

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    name: 'hello',
                    botId: 'test',
                    tag: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test2',
                    name: 'other',
                    botId: 'test2',
                    tag: 'other',
                },
            ]);
            expect(hasPortal).toBe(true);
        });

        it('should resolve whenever a bot with the correct prefix is updated', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
            ]);

            await vm.sendEvents([
                botUpdated('test', {
                    tags: {
                        other: '🔺a',
                    },
                }),
            ]);

            await waitAsync();

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'hello.test',
                    name: 'hello',
                    botId: 'test',
                    tag: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test',
                    name: 'other',
                    botId: 'test',
                    tag: 'other',
                },
            ]);
        });

        it('should sort items by tag and then bot ID', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        zzz: '🔺bcd',
                        aaa: '🔺script',
                    })
                ),
                botAdded(
                    createBot('abc', {
                        zzz: '🔺bcd',
                        bbb: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'aaa.test',
                    botId: 'test',
                    tag: 'aaa',
                    name: 'aaa',
                },
                {
                    type: 'tag',
                    key: 'bbb.abc',
                    botId: 'abc',
                    tag: 'bbb',
                    name: 'bbb',
                },
                {
                    type: 'tag',
                    key: 'zzz.abc',
                    botId: 'abc',
                    tag: 'zzz',
                    name: 'zzz',
                },
                {
                    type: 'tag',
                    key: 'zzz.test',
                    botId: 'test',
                    tag: 'zzz',
                    name: 'zzz',
                },
            ]);
        });

        it('should indicate listen tags are such', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botUpdated(userId, {
                    tags: {
                        idePortal: '@',
                    },
                }),
                botAdded(
                    createBot('test', {
                        zzz: '@bcd',
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'zzz.test',
                    botId: 'test',
                    tag: 'zzz',
                    name: 'zzz',
                    isScript: true,
                    prefix: '@',
                },
            ]);
        });

        it('should indicate DNA tags are such', async () => {
            let items: IdeNode[];
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
            });

            await vm.sendEvents([
                botUpdated(userId, {
                    tags: {
                        idePortal: '🧬',
                    },
                }),
                botAdded(
                    createBot('test', {
                        zzz: '🧬bcd',
                        hello: '🔺script',
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'zzz.test',
                    botId: 'test',
                    tag: 'zzz',
                    name: 'zzz',
                    isFormula: true,
                    prefix: '🧬',
                },
            ]);
        });

        it('should not have a portal if there is no idePortal tag on the user bot', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botUpdated(userId, {
                    tags: {
                        idePortal: null,
                    },
                }),
            ]);

            expect(hasPortal).toBe(false);
            expect(items).toEqual([]);
        });

        it('should include all tags if set to true', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('user', {
                        idePortal: true,
                    })
                ),
            ]);

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                        other: 'abc',
                        def: false,
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'def.test',
                    botId: 'test',
                    tag: 'def',
                    name: 'def',
                },
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test',
                    botId: 'test',
                    tag: 'other',
                    name: 'other',
                },
            ]);
            expect(hasPortal).toBe(true);
        });

        it('should include all tags if set to the string true', async () => {
            let items: IdeNode[];
            let hasPortal: boolean;
            manager.itemsUpdated.subscribe((e) => {
                items = e.items;
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('user', {
                        idePortal: 'true',
                    })
                ),
            ]);

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: '🔺script',
                        other: 'abc',
                        def: false,
                    })
                ),
            ]);

            expect(items).toEqual([
                {
                    type: 'tag',
                    key: 'def.test',
                    botId: 'test',
                    tag: 'def',
                    name: 'def',
                },
                {
                    type: 'tag',
                    key: 'hello.test',
                    botId: 'test',
                    tag: 'hello',
                    name: 'hello',
                },
                {
                    type: 'tag',
                    key: 'other.test',
                    botId: 'test',
                    tag: 'other',
                    name: 'other',
                },
            ]);
            expect(hasPortal).toBe(true);
        });
    });
});
