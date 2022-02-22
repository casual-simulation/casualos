import {
    getBotTitle,
    getSystemArea,
    searchTag,
    searchValue,
    SystemPortalHasRecentsUpdate,
    SystemPortalManager,
    SystemPortalRecentsUpdate,
    SystemPortalSearchUpdate,
    SystemPortalSelectionUpdate,
    SystemPortalUpdate,
} from './SystemPortalManager';
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
    SYSTEM_PORTAL,
    SYSTEM_PORTAL_BOT,
    TEMPORARY_BOT_PARTITION_ID,
    EDITING_TAG,
    EDITING_BOT,
    EDITING_TAG_SPACE,
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_SEARCH,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject, Subscription } from 'rxjs';
import {
    wait,
    waitAsync,
} from '@casual-simulation/aux-common/test/TestHelpers';
import { skip } from 'rxjs/operators';

describe('SystemPortalManager', () => {
    let manager: SystemPortalManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';
    let localEvents: Subject<BotAction[]>;
    let updates: SystemPortalUpdate[];
    let selectionUpdates: SystemPortalSelectionUpdate[];
    let recentsUpdates: SystemPortalRecentsUpdate[];
    let searchUpdates: SystemPortalSearchUpdate[];
    let sub: Subscription;

    beforeEach(async () => {
        sub = new Subscription();
        vm = new TestAuxVM(userId);
        vm.processEvents = true;
        localEvents = vm.localEvents = new Subject();
        helper = new BotHelper(vm, false);
        helper.userId = userId;
        index = new BotIndex();

        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );

        await vm.sendEvents([botAdded(createBot('user', {}))]);

        updates = [];
        selectionUpdates = [];
        recentsUpdates = [];
        searchUpdates = [];
        manager = new SystemPortalManager(watcher, helper, false);
        sub.add(
            manager.onItemsUpdated
                .pipe(skip(1))
                .subscribe((u) => updates.push(u))
        );
        sub.add(
            manager.onSelectionUpdated
                .pipe(skip(1))
                .subscribe((u) => selectionUpdates.push(u))
        );
        sub.add(
            manager.onRecentsUpdated
                .pipe(skip(1))
                .subscribe((u) => recentsUpdates.push(u))
        );
        sub.add(
            manager.onSearchResultsUpdated
                .pipe(skip(1))
                .subscribe((u) => searchUpdates.push(u))
        );
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('onItemsUpdated', () => {
        it('should resolve when the user bot is updated with the portal tag', async () => {
            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                }),
            ]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: null,
                    },
                }),
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    items: [],
                },
                {
                    hasPortal: false,
                },
            ]);
        });

        it('should include bots where the portal is contained in the bot system tag', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        system: 'wrong.other.test4',
                    })
                ),
                botAdded(
                    createBot('test5', {
                        system: 'wrong.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        system: 'different.core.test6',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                }),
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test1', {
                                        system: 'core.game.test1',
                                    }),
                                    title: 'test1',
                                },
                                {
                                    bot: createPrecalculatedBot('test2', {
                                        system: 'core.game.test2',
                                    }),
                                    title: 'test2',
                                },
                            ],
                        },
                        {
                            area: 'core.other',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test3', {
                                        system: 'core.other.test3',
                                    }),
                                    title: 'test3',
                                },
                                {
                                    bot: createPrecalculatedBot('test4', {
                                        system: 'core.other.test4',
                                    }),
                                    title: 'test4',
                                },
                            ],
                        },
                        {
                            area: 'different.core',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test6', {
                                        system: 'different.core.test6',
                                    }),
                                    title: 'test6',
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should update the selected bot from the user bot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: 'test2',
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test1', {
                                        system: 'core.game.test1',
                                    }),
                                    title: 'test1',
                                },
                                {
                                    bot: createPrecalculatedBot('test2', {
                                        system: 'core.game.test2',
                                    }),
                                    title: 'test2',
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should support bot links in the systemPortalBot tag', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: '🔗test2',
                    },
                }),
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: 'test2',
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test1', {
                                        system: 'core.game.test1',
                                    }),
                                    title: 'test1',
                                },
                                {
                                    bot: createPrecalculatedBot('test2', {
                                        system: 'core.game.test2',
                                    }),
                                    title: 'test2',
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should keep the currently selected bot in this list if the system portal tag has changed', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.other',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: 'test2',
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test2', {
                                        system: 'core.game.test2',
                                    }),
                                    title: 'test2',
                                },
                            ],
                        },
                        {
                            area: 'core.other',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test3', {
                                        system: 'core.other.test3',
                                    }),
                                    title: 'test3',
                                },
                                {
                                    bot: createPrecalculatedBot('test4', {
                                        system: 'core.other.test4',
                                    }),
                                    title: 'test4',
                                },
                            ],
                        },
                    ],
                },
            ]);
        });

        it('should include all bots when the portal is set to true', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botAdded(
                    createBot('test6', {
                        system: 'wrong.other.test6',
                    })
                ),
                botAdded(
                    createBot('test5', {
                        system: 'wrong.other.test5',
                    })
                ),
                botAdded(
                    createBot('test7', {
                        notSystem: 'value',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: true,
                    },
                }),
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    hasPortal: true,
                    selectedBot: null,
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test1', {
                                        system: 'core.game.test1',
                                    }),
                                    title: 'test1',
                                },
                                {
                                    bot: createPrecalculatedBot('test2', {
                                        system: 'core.game.test2',
                                    }),
                                    title: 'test2',
                                },
                            ],
                        },
                        {
                            area: 'core.other',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test3', {
                                        system: 'core.other.test3',
                                    }),
                                    title: 'test3',
                                },
                                {
                                    bot: createPrecalculatedBot('test4', {
                                        system: 'core.other.test4',
                                    }),
                                    title: 'test4',
                                },
                            ],
                        },
                        {
                            area: 'wrong.other',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test5', {
                                        system: 'wrong.other.test5',
                                    }),
                                    title: 'test5',
                                },
                                {
                                    bot: createPrecalculatedBot('test6', {
                                        system: 'wrong.other.test6',
                                    }),
                                    title: 'test6',
                                },
                            ],
                        },
                    ],
                },
            ]);
        });
    });

    describe('onSelectionUpdated', () => {
        it('should resolve when a bot is selected via the user bot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                        mod: '🧬{}',
                        link: '🔗abc',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                            mod: {},
                            link: '🔗abc',
                        },
                        {
                            system: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                            mod: '🧬{}',
                            link: '🔗abc',
                        }
                    ),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'link', isLink: true, prefix: '🔗' },
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should include tag masks', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
            ]);
            await vm.sendEvents([
                botUpdated('test2', {
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            color: 'blue',
                        },
                    },
                }),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: {
                        id: 'test2',
                        precalculated: true,
                        values: {
                            system: 'core.game.test2',
                            color: 'blue',
                            onClick: '@os.toast("Cool!");',
                        },
                        tags: {
                            system: 'core.game.test2',
                            color: 'red',
                            onClick: '@os.toast("Cool!");',
                        },
                        masks: {
                            [TEMPORARY_BOT_PARTITION_ID]: {
                                color: 'blue',
                            },
                        },
                    },
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'color', space: TEMPORARY_BOT_PARTITION_ID },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should sort alphabetically if specified', async () => {
            manager.tagSortMode = 'alphabetical';
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'alphabetical',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'color' },
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should resolve when a tag is selected via the user bot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tag: 'onClick',
                    space: null,
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should include the selected tag in the tags list even if the bot doesnt have the tag', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                        [SYSTEM_PORTAL_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                    }),
                    tag: 'onClick',
                    space: null,
                    tags: [{ name: 'onClick' }, { name: 'system' }],
                },
            ]);
        });
    });

    describe('addPinnedTag()', () => {
        it('should add the new tag to a pinned tags list', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('test');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [{ name: 'test', focusValue: true }],
                },
            ]);
        });

        it('should be able to add tags that already exist on bot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('onClick');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
            ]);
        });

        it('should focus the new tag and unfocus the other pinned tags', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('onClick');

            await waitAsync();

            manager.addPinnedTag('other');

            await waitAsync();

            expect(selectionUpdates).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'other', focusValue: true },
                    ],
                },
            ]);
        });

        it('should preserve pinned tags across bots', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.game.test3',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('onClick');

            await waitAsync();

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test3',
                    },
                }),
            ]);

            await waitAsync();

            expect(selectionUpdates.slice(2)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test3', {
                        system: 'core.game.test3',
                    }),
                    tags: [{ name: 'system' }],
                    pinnedTags: [{ name: 'onClick' }],
                },
            ]);
        });

        it('should do nothing if the new tag is already pinned', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('onClick');
            manager.addPinnedTag('onClick');

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
            ]);
        });

        it('should create an empty script if the tag is prefixed with @', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('@onClick');

            await waitAsync();

            expect(helper.botsState['test2']).toEqual(
                createPrecalculatedBot('test2', {
                    system: 'core.game.test2',
                    onClick: '@',
                })
            );

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        onClick: '@',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'onClick',
                            isScript: true,
                            prefix: '@',
                            focusValue: true,
                        },
                    ],
                },
            ]);
        });

        it('should create an empty mod if the tag is prefixed with the DNA emoji', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('🧬mod');

            await waitAsync();

            expect(helper.botsState['test2']).toEqual(
                createPrecalculatedBot(
                    'test2',
                    {
                        system: 'core.game.test2',
                        mod: expect.any(String),
                    },
                    {
                        system: 'core.game.test2',
                        mod: '🧬',
                    }
                )
            );

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            mod: expect.any(String),
                        },
                        {
                            system: 'core.game.test2',
                            mod: '🧬',
                        }
                    ),
                    tags: [
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'system' },
                    ],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot(
                        'test2',
                        {
                            system: 'core.game.test2',
                            mod: expect.any(String),
                        },
                        {
                            system: 'core.game.test2',
                            mod: '🧬',
                        }
                    ),
                    tags: [
                        { name: 'mod', isFormula: true, prefix: '🧬' },
                        { name: 'system' },
                    ],
                    pinnedTags: [
                        {
                            name: 'mod',
                            focusValue: true,
                            isFormula: true,
                            prefix: '🧬',
                        },
                    ],
                },
            ]);
        });
    });

    describe('removePinnedTag()', () => {
        it('should remove the given tag from the pinned tags list', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.addPinnedTag('test');

            await waitAsync();

            manager.removePinnedTag({ name: 'test' });

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                    pinnedTags: [{ name: 'test', focusValue: true }],
                },
                {
                    hasSelection: true,
                    sortMode: 'scripts-first',
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true, prefix: '@' },
                        { name: 'color' },
                        { name: 'system' },
                    ],
                },
            ]);
        });

        it('should do nothing if given a tag that is not pinned', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core.game',
                        [SYSTEM_PORTAL_BOT]: 'test2',
                    },
                }),
            ]);

            await waitAsync();

            manager.removePinnedTag({ name: 'test' });

            await waitAsync();

            expect(selectionUpdates.slice(1)).toEqual([]);
        });
    });

    describe('onRecentsUpdate', () => {
        it('should resolve when the editingTag tag changes', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'color',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should bot links for editingBot', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: '🔗test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: '🔗test2',
                        [EDITING_TAG]: 'color',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support formulas', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '🧬{}',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: true,
                            isLink: false,
                            prefix: '🧬',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support links', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        link: '🔗abc',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'link',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: true,
                            prefix: '🔗',
                            botId: 'test2',
                            tag: 'link',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should support tag masks', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                        [EDITING_TAG_SPACE]: 'tempLocal',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            botId: 'test2',
                            tag: 'onClick',
                            space: 'tempLocal',
                        },
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should update the name on other tags if there are two of the same tag name', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        onClick: '@os.toast("Test!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test1',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: 'test1',
                            system: 'core.game.test1',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test1',
                            tag: 'onClick',
                            space: null,
                        },
                        {
                            hint: 'test2',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should not add a hint if just moving a tag to the front', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'color',
                    },
                }),
            ]);

            await waitAsync();

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [EDITING_BOT]: 'test2',
                        [EDITING_TAG]: 'onClick',
                    },
                }),
            ]);

            await waitAsync();

            expect(recentsUpdates).toEqual([
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                    ],
                },
                {
                    hasRecents: true,
                    recentTags: [
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: true,
                            isFormula: false,
                            isLink: false,
                            prefix: '@',
                            botId: 'test2',
                            tag: 'onClick',
                            space: null,
                        },
                        {
                            hint: '',
                            system: 'core.game.test2',
                            isScript: false,
                            isFormula: false,
                            isLink: false,
                            botId: 'test2',
                            tag: 'color',
                            space: null,
                        },
                    ],
                },
            ]);
        });

        it('should limit recent items to 10 items', async () => {
            let tags = {} as any;
            for (let i = 0; i < 20; i++) {
                tags['tag' + i] = 'abc';
            }

            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        ...tags,
                    })
                ),
            ]);

            for (let tag in tags) {
                await vm.sendEvents([
                    botUpdated('user', {
                        tags: {
                            [EDITING_BOT]: 'test2',
                            [EDITING_TAG]: tag,
                        },
                    }),
                ]);
                await waitAsync();
            }

            const lastUpdate = recentsUpdates[recentsUpdates.length - 1];

            expect(lastUpdate.hasRecents).toBe(true);
            expect(
                (lastUpdate as SystemPortalHasRecentsUpdate).recentTags
            ).toHaveLength(10);
        });
    });

    describe('onSearchResultsUpdated', () => {
        it('should resolve when the user bot is updated with the portal tag', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test2', {
                        system: 'core.game.test2',
                        script1: '@abcdefghi',
                    })
                ),
                botAdded(
                    createBot('test1', {
                        system: 'core.game.test1',
                        script2: '@abcdefghiabcdef',
                        script3: '@abcdefghi\nabcdefghi',
                    })
                ),
                botAdded(
                    createBot('test4', {
                        system: 'core.other.test4',
                        link1: '🔗abcdef',
                    })
                ),
                botAdded(
                    createBot('test3', {
                        system: 'core.other.test3',
                        normal1: 'abcdef',
                    })
                ),
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL]: 'core',
                    },
                }),
            ]);
            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        [SYSTEM_PORTAL_SEARCH]: 'abcdef',
                    },
                }),
            ]);

            await waitAsync();

            expect(searchUpdates).toEqual([
                {
                    numMatches: 7,
                    numBots: 4,
                    items: [
                        {
                            area: 'core.game',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test1', {
                                        system: 'core.game.test1',
                                        script2: '@abcdefghiabcdef',
                                        script3: '@abcdefghi\nabcdefghi',
                                    }),
                                    title: 'test1',
                                    tags: [
                                        {
                                            tag: 'script2',
                                            isScript: true,
                                            prefix: '@',
                                            matches: [
                                                {
                                                    text: 'abcdefghiabcdef',
                                                    index: 1,
                                                    endIndex: 7,
                                                    highlightStartIndex: 0,
                                                    highlightEndIndex: 6,
                                                },
                                                {
                                                    text: 'abcdefghiabcdef',
                                                    index: 10,
                                                    endIndex: 16,
                                                    highlightStartIndex: 9,
                                                    highlightEndIndex: 15,
                                                },
                                            ],
                                        },
                                        {
                                            tag: 'script3',
                                            isScript: true,
                                            prefix: '@',
                                            matches: [
                                                {
                                                    text: 'abcdefghi',
                                                    index: 1,
                                                    endIndex: 7,
                                                    highlightStartIndex: 0,
                                                    highlightEndIndex: 6,
                                                },
                                                {
                                                    text: 'abcdefghi',
                                                    index: 11,
                                                    endIndex: 17,
                                                    highlightStartIndex: 0,
                                                    highlightEndIndex: 6,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    bot: createPrecalculatedBot('test2', {
                                        system: 'core.game.test2',
                                        script1: '@abcdefghi',
                                    }),
                                    title: 'test2',
                                    tags: [
                                        {
                                            tag: 'script1',
                                            isScript: true,
                                            prefix: '@',
                                            matches: [
                                                {
                                                    text: 'abcdefghi',
                                                    index: 1,
                                                    endIndex: 7,
                                                    highlightStartIndex: 0,
                                                    highlightEndIndex: 6,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            area: 'core.other',
                            bots: [
                                {
                                    bot: createPrecalculatedBot('test3', {
                                        system: 'core.other.test3',
                                        normal1: 'abcdef',
                                    }),
                                    title: 'test3',
                                    tags: [
                                        {
                                            tag: 'normal1',
                                            matches: [
                                                {
                                                    text: 'abcdef',
                                                    index: 0,
                                                    endIndex: 6,
                                                    highlightStartIndex: 0,
                                                    highlightEndIndex: 6,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    bot: createPrecalculatedBot('test4', {
                                        system: 'core.other.test4',
                                        link1: '🔗abcdef',
                                    }),
                                    title: 'test4',
                                    tags: [
                                        {
                                            tag: 'link1',
                                            isLink: true,
                                            prefix: '🔗',
                                            matches: [
                                                {
                                                    text: 'abcdef',
                                                    index: 2,
                                                    endIndex: 8,
                                                    highlightStartIndex: 0,
                                                    highlightEndIndex: 6,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);
        });
    });
});

describe('getSystemArea()', () => {
    const cases = [
        ['core', 'core'],
        ['core.ui', 'core'],
        ['core.ui.menu', 'core.ui'],
        ['core.ui.menu.button', 'core.ui'],
        ['.core.ui.menu.button', '.core'],
        ['..core.ui.menu.button', '.'],
        [null, ''],
    ];

    it.each(cases)('should map %s to %s', (given, expected) => {
        expect(getSystemArea(given)).toBe(expected);
    });
});

describe('getBotTitle()', () => {
    const cases = [
        ['core', '', 'core'],
        ['core.ui', 'core', 'ui'],
        ['core.ui.menu', 'core', 'ui.menu'],
        ['core.ui.menu.button', 'core.ui', 'menu.button'],
        ['.core.ui.menu.button', '', 'core.ui.menu.button'],
        ['..core.ui.menu.button', '', '.core.ui.menu.button'],
        ['', '', ''],
        [null, '', ''],
    ];

    it.each(cases)('should map %s to %s', (given, area, expected) => {
        expect(getBotTitle(given, area)).toBe(expected);
    });
});

describe('searchValue()', () => {
    it('should return a list of matches for the given value', () => {
        expect(searchValue('abcdefghi\nghiabcdef', 0, 'abcdef')).toEqual([
            {
                text: 'abcdefghi',
                index: 0,
                endIndex: 6,
                highlightStartIndex: 0,
                highlightEndIndex: 6,
            },
            {
                text: 'ghiabcdef',
                index: 13,
                endIndex: 19,
                highlightStartIndex: 3,
                highlightEndIndex: 9,
            },
        ]);
    });

    it('should add the given index offset value to the absolute indexes', () => {
        expect(searchValue('abcdefghi\nghiabcdef', 5, 'abcdef')).toEqual([
            {
                text: 'abcdefghi',
                index: 5,
                endIndex: 11,
                highlightStartIndex: 0,
                highlightEndIndex: 6,
            },
            {
                text: 'ghiabcdef',
                index: 18,
                endIndex: 24,
                highlightStartIndex: 3,
                highlightEndIndex: 9,
            },
        ]);
    });
});

describe('searchTag()', () => {
    it('should return an object if there are any matches', () => {
        expect(searchTag('test', null, '@abcdefghi', 'abcdef')).toEqual({
            tag: 'test',
            isScript: true,
            prefix: '@',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 1,
                    endIndex: 7,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support tag links', () => {
        expect(searchTag('test', null, '🔗abcdefghi', 'abcdef')).toEqual({
            tag: 'test',
            isLink: true,
            prefix: '🔗',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 2,
                    endIndex: 8,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support formulas', () => {
        expect(searchTag('test', null, '🧬abcdefghi', 'abcdef')).toEqual({
            tag: 'test',
            isFormula: true,
            prefix: '🧬',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 2,
                    endIndex: 8,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support normal tags', () => {
        expect(searchTag('test', null, 'abcdefghi', 'abcdef')).toEqual({
            tag: 'test',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 0,
                    endIndex: 6,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should support spaces', () => {
        expect(searchTag('test', 'mySpace', 'abcdefghi', 'abcdef')).toEqual({
            tag: 'test',
            space: 'mySpace',
            matches: [
                {
                    text: 'abcdefghi',
                    index: 0,
                    endIndex: 6,
                    highlightStartIndex: 0,
                    highlightEndIndex: 6,
                },
            ],
        });
    });

    it('should return null if there are no matches', () => {
        expect(searchTag('test', null, '@abcdefghi', 'missing')).toEqual(null);
    });

    it('should convert objects to JSON', () => {
        expect(searchTag('test', null, { test: 'abcdef' }, 'abcdef')).toEqual({
            tag: 'test',
            matches: [
                {
                    text: '{"test":"abcdef"}',
                    index: 9,
                    endIndex: 15,
                    highlightStartIndex: 9,
                    highlightEndIndex: 15,
                },
            ],
        });
    });
});
