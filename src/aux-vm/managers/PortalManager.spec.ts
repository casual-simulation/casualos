import {
    asyncResult,
    BotIndex,
    BotsState,
    createPrecalculatedBot,
    DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES,
    LocalActions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject, Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';
import { BotWatcher } from './BotWatcher';
import { CodeBundle, PortalBundler, ScriptPrefix } from './PortalBundler';
import {
    DEFAULT_SCRIPT_PREFIXES,
    PortalData,
    PortalManager,
    PortalUpdate,
} from './PortalManager';

describe('PortalManager', () => {
    let manager: PortalManager;
    let vm: TestAuxVM;
    let helper: BotHelper;
    let index: BotIndex;
    let watcher: BotWatcher;
    let sub: Subscription;
    let bundler: {
        bundleTag: jest.Mock<
            Promise<CodeBundle>,
            [BotsState, string, ScriptPrefix[]]
        >;
    };
    let localEvents: Subject<LocalActions[]>;

    beforeEach(() => {
        sub = new Subscription();
        vm = new TestAuxVM();
        localEvents = vm.localEvents = new Subject();

        helper = new BotHelper(vm);
        index = new BotIndex();
        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );

        bundler = {
            bundleTag: jest.fn(),
        };
        manager = new PortalManager(vm, helper, watcher, bundler);
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('prefixes', () => {
        let prefixes = [] as ScriptPrefix[];
        let removedPrefixes = [] as string[];

        beforeEach(() => {
            prefixes = [];
            sub.add(
                manager.prefixesDiscovered.subscribe((p) => prefixes.push(...p))
            );
            sub.add(
                manager.prefixesRemoved.subscribe((p) =>
                    removedPrefixes.push(...p)
                )
            );
        });

        it('should resolve with the default prefixes', async () => {
            await waitAsync();
            expect(prefixes).toEqual(DEFAULT_SCRIPT_PREFIXES);
        });

        it('should resolve when a new prefix is added', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });

        it('should use the language specified on the event', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {
                        language: 'json',
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'json',
                },
            ]);
        });

        it('should finish the register_prefix task', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(vm.events).toEqual([asyncResult('task1', undefined)]);
        });

        it('should do nothing when a prefix is registered twice', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });
    });

    describe('portalsDiscovered', () => {
        let portals = [] as PortalData[];

        beforeEach(() => {
            portals = [];
            sub.add(
                manager.portalsDiscovered.subscribe((p) => portals.push(...p))
            );
        });

        it('should build and resolve new portals', async () => {
            expect(portals).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                modules: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    tag: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                    tag: 'script',
                    style: {
                        abc: 'def',
                    },
                    error: null,
                },
            ]);
        });

        it('should build and resolve portals that were registered without source', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                modules: {},
                warnings: [],
            });

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    tag: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: null,
                    tag: 'script',
                    style: {
                        abc: 'def',
                    },
                    error: null,
                },
            ]);
        });

        it('should handle when the build returns null', async () => {
            bundler.bundleTag.mockResolvedValueOnce(null);

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    options: {},
                    taskId: 'task1',
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    tag: '🔺script',
                    taskId: 'task',
                    options: {
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: null,
                    tag: 'script',
                    style: {
                        abc: 'def',
                    },
                    error: null,
                },
            ]);
        });

        it('should finish the open_custom_portal task', async () => {
            localEvents.next([
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    tag: 'script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(vm.events).toEqual([asyncResult('task1', undefined)]);
        });
    });

    describe('portalsUpdated', () => {
        let updates = [] as PortalUpdate[];

        beforeEach(() => {
            updates = [];
            sub.add(
                manager.portalsUpdated.subscribe((p) => updates.push(...p))
            );
        });

        describe('simple updates', () => {
            beforeEach(async () => {
                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        bot1: createPrecalculatedBot('bot1', {
                            script: '🔺abc',
                        }),
                    })
                );

                localEvents.next([
                    {
                        type: 'register_prefix',
                        prefix: '🔺',
                        taskId: 'task1',
                        options: {},
                    },
                    {
                        type: 'open_custom_portal',
                        portalId: 'test-portal',
                        tag: 'script',
                        taskId: 'task1',
                        options: {},
                    },
                ]);

                await waitAsync();
            });

            it('should resolve updates to a portal', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        bot1: {
                            tags: {
                                script: '🔺def',
                            },
                            values: {
                                script: '🔺def',
                            },
                        },
                    })
                );

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'abc',
                            error: null,
                        },
                        portal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'correct',
                            error: null,
                        },
                    },
                ]);
            });

            it('should update the portal if a bot with a related tag was added', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        bot2: createPrecalculatedBot('bot2', {
                            script: 'haha',
                        }),
                    })
                );

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'abc',
                            error: null,
                        },
                        portal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'correct',
                            error: null,
                        },
                    },
                ]);
            });

            it('should update the portal if a bot that was in the bundle was removed', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot1 is in the module
                        bot1: null,
                    })
                );

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'abc',
                            error: null,
                        },
                        portal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'correct',
                            error: null,
                        },
                    },
                ]);
            });

            it('should not update the portal if a bot that was not in the bundle was removed', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot5 is not in the module
                        bot5: null,
                    })
                );

                await waitAsync();

                expect(updates).toEqual([]);
            });

            it('should not update the portal if a bot that does not have a module tag was added', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot5 is not in the module
                        bot5: createPrecalculatedBot('bot5', {
                            not: 'abcd',
                            other: 123,
                        }),
                    })
                );

                await waitAsync();

                expect(updates).toEqual([]);
            });

            it('should not update the portal if non module tag was updated', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'correct',
                    error: null,
                    modules: {},
                    warnings: [],
                });

                vm.sendState(
                    stateUpdatedEvent({
                        // bot5 is not in the module
                        bot1: {
                            tags: {
                                other: true,
                            },
                            values: {
                                other: true,
                            },
                        },
                    })
                );

                await waitAsync();

                expect(updates).toEqual([]);
            });

            it('should resolve settings updates to a portal', async () => {
                expect(updates).toEqual([]);

                bundler.bundleTag.mockResolvedValueOnce({
                    tag: 'script',
                    source: 'abc',
                    error: null,
                    modules: {
                        bot1: new Set(['script']),
                    },
                    warnings: [],
                });

                localEvents.next([
                    {
                        type: 'open_custom_portal',
                        portalId: 'test-portal',
                        tag: '🔺script',
                        taskId: 'task1',
                        options: {
                            style: {
                                anything: true,
                            },
                        },
                    },
                ]);

                await waitAsync();

                expect(updates).toEqual([
                    {
                        oldPortal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'abc',
                            error: null,
                        },
                        portal: {
                            id: 'test-portal',
                            tag: 'script',
                            source: 'abc',
                            style: {
                                anything: true,
                            },
                            error: null,
                        },
                    },
                ]);
            });
        });

        it('should update the portal if there are no modules and the updated tag is an entrypoint', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                error: null,
                modules: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: createPrecalculatedBot('bot1', {
                        script: '🔺abc',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    tag: '🔺script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'correct',
                error: null,
                modules: {
                    bot1: new Set(['script']),
                },
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: {
                        tags: {
                            script: '🔺def',
                        },
                        values: {
                            script: '🔺def',
                        },
                    },
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        tag: 'script',
                        source: 'abc',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        tag: 'script',
                        source: 'correct',
                        error: null,
                    },
                },
            ]);
        });

        it('should update the portal if there are no modules and the added tag is an entrypoint', async () => {
            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'abc',
                error: null,
                modules: {},
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot1: createPrecalculatedBot('bot1', {
                        script: '🔺abc',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'register_prefix',
                    prefix: '🔺',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'open_custom_portal',
                    portalId: 'test-portal',
                    tag: '🔺script',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([]);

            bundler.bundleTag.mockResolvedValueOnce({
                tag: 'script',
                source: 'correct',
                error: null,
                modules: {
                    bot1: new Set(['script']),
                },
                warnings: [],
            });

            vm.sendState(
                stateUpdatedEvent({
                    bot2: createPrecalculatedBot('bot2', {
                        script: '🔺new script',
                    }),
                })
            );

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        tag: 'script',
                        source: 'abc',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        tag: 'script',
                        source: 'correct',
                        error: null,
                    },
                },
            ]);
        });
    });
});
