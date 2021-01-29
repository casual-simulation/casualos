import {
    DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES,
    LocalActions,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject, Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { Bundle } from './PortalBundler';
import {
    DEFAULT_SCRIPT_PREFIXES,
    PortalData,
    PortalManager,
    PortalUpdate,
    ScriptPrefix,
} from './PortalManager';

describe('PortalManager', () => {
    let manager: PortalManager;
    let vm: TestAuxVM;
    let sub: Subscription;
    let bundleUpdated: Subject<Bundle>;
    let localEvents: Subject<LocalActions[]>;

    beforeEach(() => {
        sub = new Subscription();
        vm = new TestAuxVM();
        localEvents = vm.localEvents = new Subject();
        bundleUpdated = new Subject();
        manager = new PortalManager(vm, bundleUpdated);
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('portalsDiscovered', () => {
        let portals = [] as PortalData[];

        beforeEach(() => {
            portals = [];
            sub.add(
                manager.portalsDiscovered.subscribe((p) => portals.push(...p))
            );
        });

        it('should not resolve registered portals until they have some source', async () => {
            expect(portals).toEqual([]);

            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test-portal',
                    taskId: 'task',
                    options: {
                        scriptPrefixes: ['🙂'],
                        style: {
                            abc: 'def',
                        },
                    },
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'abc',
                error: null,
                warnings: [],
            });

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                    scriptPrefixes: ['🙂'],
                    style: {
                        abc: 'def',
                    },
                    error: null,
                },
            ]);
        });

        it('should resolve multiple portals at the same time', async () => {
            expect(portals).toEqual([]);

            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test-portal',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'register_custom_portal',
                    portalId: 'other-portal',
                    taskId: 'task2',
                    options: {},
                },
            ]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'abc',
                error: null,
                warnings: [],
            });

            bundleUpdated.next({
                portalId: 'other-portal',
                source: 'def',
                error: null,
                warnings: [],
            });

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                    error: null,
                },
                {
                    id: 'other-portal',
                    source: 'def',
                    error: null,
                },
            ]);
        });

        it('should resolve portals that already have source', async () => {
            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test-portal',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'register_custom_portal',
                    portalId: 'other-portal',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'abc',
                error: null,
                warnings: [],
            });

            bundleUpdated.next({
                portalId: 'other-portal',
                source: 'def',
                error: null,
                warnings: [],
            });

            await waitAsync();

            let existingPortals: PortalData[][] = [];
            manager.portalsDiscovered.subscribe((p) => existingPortals.push(p));

            expect(existingPortals).toEqual([
                [
                    {
                        id: 'test-portal',
                        source: 'abc',
                        error: null,
                    },
                    {
                        id: 'other-portal',
                        source: 'def',
                        error: null,
                    },
                ],
            ]);
        });

        it('should not resolve portals that had no source', async () => {
            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test-portal',
                    taskId: 'task1',
                    options: {},
                },
            ]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'abc',
                error: null,
                warnings: [],
            });
            bundleUpdated.next({
                portalId: 'test-portal',
                source: '',
                error: null,
                warnings: [],
            });
            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'def',
                error: null,
                warnings: [],
            });

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                    error: null,
                },
            ]);
        });
    });

    describe('portalsUpdated', () => {
        let updates = [] as PortalUpdate[];

        beforeEach(async () => {
            updates = [];
            sub.add(
                manager.portalsUpdated.subscribe((p) => updates.push(...p))
            );

            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test-portal',
                    taskId: 'task1',
                    options: {},
                },
                {
                    type: 'register_custom_portal',
                    portalId: 'other-portal',
                    taskId: 'task2',
                    options: {},
                },
            ]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'abc',
                error: null,
                warnings: [],
            });
            bundleUpdated.next({
                portalId: 'other-portal',
                source: 'def',
                error: null,
                warnings: [],
            });

            await waitAsync();
        });

        it('should resolve updates to a portal', async () => {
            expect(updates).toEqual([]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'different',
                error: null,
                warnings: [],
            });

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'different',
                        error: null,
                    },
                },
            ]);
        });

        it('should resolve settings updates to a portal', async () => {
            expect(updates).toEqual([]);

            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test-portal',
                    taskId: 'task1',
                    options: {
                        scriptPrefixes: ['custom'],
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
                        source: 'abc',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'abc',
                        scriptPrefixes: ['custom'],
                        style: {
                            anything: true,
                        },
                        error: null,
                    },
                },
            ]);
        });

        it('should collapse multiple source updates', async () => {
            expect(updates).toEqual([]);

            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'different1',
                error: null,
                warnings: [],
            });
            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'different2',
                error: null,
                warnings: [],
            });
            bundleUpdated.next({
                portalId: 'test-portal',
                source: 'different3',
                error: null,
                warnings: [],
            });

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'different1',
                        error: null,
                    },
                },
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'different1',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'different2',
                        error: null,
                    },
                },
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'different2',
                        error: null,
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'different3',
                        error: null,
                    },
                },
            ]);
        });
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

        it('should resolve when a new portal is added', async () => {
            localEvents.next([
                {
                    type: 'register_custom_portal',
                    taskId: 'task1',
                    portalId: 'test',
                    options: {
                        scriptPrefixes: ['🐦', '🔺'],
                        style: {},
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    portalId: 'test',
                    prefix: '🐦',
                    language: 'javascript',
                },
                {
                    portalId: 'test',
                    prefix: '🔺',
                    language: 'javascript',
                },
            ]);
        });

        it('should do nothing when a portal is updated but the prefixes stay the same', async () => {
            localEvents.next([
                {
                    type: 'register_custom_portal',
                    taskId: 'task1',
                    portalId: 'test',
                    options: {
                        scriptPrefixes: ['🐦', '🔺'],
                        style: {},
                    },
                },
                {
                    type: 'register_custom_portal',
                    taskId: 'task2',
                    portalId: 'test',
                    options: {
                        scriptPrefixes: ['🐦', '🔺'],
                        style: {},
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    portalId: 'test',
                    prefix: '🐦',
                    language: 'javascript',
                },
                {
                    portalId: 'test',
                    prefix: '🔺',
                    language: 'javascript',
                },
            ]);
        });

        it('should emit an event for when a prefix is removed', async () => {
            localEvents.next([
                {
                    type: 'register_custom_portal',
                    portalId: 'test',
                    taskId: 'task1',
                    options: {
                        scriptPrefixes: ['🐦', '🔺'],
                        style: {},
                    },
                },
                {
                    type: 'register_custom_portal',
                    portalId: 'test',
                    taskId: 'task2',
                    options: {
                        scriptPrefixes: ['🐦'],
                        style: {},
                    },
                },
            ]);

            await waitAsync();

            expect(removedPrefixes).toEqual(['🔺']);
        });
    });
});
