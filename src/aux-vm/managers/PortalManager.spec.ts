import { DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES } from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
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

    beforeEach(() => {
        sub = new Subscription();
        vm = new TestAuxVM();
        manager = new PortalManager(vm);
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

            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test-portal',
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

            vm.portalEvents.next([
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'abc',
                    error: null,
                },
            ]);

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

            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'abc',
                    error: null,
                },
                {
                    type: 'register_portal',
                    portalId: 'other-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'other-portal',
                    source: 'def',
                    error: null,
                },
            ]);

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
            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'abc',
                    error: null,
                },
                {
                    type: 'register_portal',
                    portalId: 'other-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'other-portal',
                    source: 'def',
                    error: null,
                },
            ]);

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
            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'abc',
                    error: null,
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: '',
                    error: null,
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'def',
                    error: null,
                },
            ]);

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

            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'abc',
                    error: null,
                },
                {
                    type: 'register_portal',
                    portalId: 'other-portal',
                    options: {},
                },
                {
                    type: 'update_portal_source',
                    portalId: 'other-portal',
                    source: 'def',
                    error: null,
                },
            ]);

            await waitAsync();
        });

        it('should resolve updates to a portal', async () => {
            expect(updates).toEqual([]);

            vm.portalEvents.next([
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'different',
                    error: null,
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
                        source: 'different',
                        error: null,
                    },
                },
            ]);
        });

        it('should resolve settings updates to a portal', async () => {
            expect(updates).toEqual([]);

            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test-portal',
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

            vm.portalEvents.next([
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'different1',
                    error: null,
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'different2',
                    error: null,
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'different3',
                    error: null,
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
            vm.portalEvents.next([
                {
                    type: 'register_portal',
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
            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test',
                    options: {
                        scriptPrefixes: ['🐦', '🔺'],
                        style: {},
                    },
                },
                {
                    type: 'register_portal',
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
            vm.portalEvents.next([
                {
                    type: 'register_portal',
                    portalId: 'test',
                    options: {
                        scriptPrefixes: ['🐦', '🔺'],
                        style: {},
                    },
                },
                {
                    type: 'register_portal',
                    portalId: 'test',
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
