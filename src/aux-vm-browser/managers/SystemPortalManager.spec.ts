import {
    getSystemArea,
    SystemPortalManager,
    SystemPortalSelectionUpdate,
    SystemPortalUpdate,
} from './SystemPortalManager';
import {
    BotHelper,
    BotWatcher,
    buildVersionNumber,
    CodeBundle,
    LibraryModule,
    PortalManager,
    ScriptPrefix,
} from '@casual-simulation/aux-vm';
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
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject, Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { skip } from 'rxjs/operators';

describe('SystemPortalManager', () => {
    let manager: SystemPortalManager;
    let watcher: BotWatcher;
    let portals: PortalManager;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';
    let localEvents: Subject<BotAction[]>;
    let updates: SystemPortalUpdate[];
    let selectionUpdates: SystemPortalSelectionUpdate[];
    let sub: Subscription;

    beforeEach(async () => {
        sub = new Subscription();
        vm = new TestAuxVM(userId);
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

        await vm.sendEvents([botAdded(createBot('user', {}))]);

        updates = [];
        selectionUpdates = [];
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

        it('should include bots where the portal matches prefixes of the bot system tag', async () => {
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
                    bot: createPrecalculatedBot('test2', {
                        system: 'core.game.test2',
                        color: 'red',
                        onClick: '@os.toast("Cool!");',
                    }),
                    tags: [
                        { name: 'onClick', isScript: true },
                        { name: 'color' },
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
                        { name: 'onClick', isScript: true },
                        { name: 'color' },
                        { name: 'color', space: TEMPORARY_BOT_PARTITION_ID },
                        { name: 'system' },
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
    ];

    it.each(cases)('should map %s to %s', (given, expected) => {
        expect(getSystemArea(given)).toBe(expected);
    });
});
