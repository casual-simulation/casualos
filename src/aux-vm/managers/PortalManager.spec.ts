import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { PortalData, PortalManager, PortalUpdate } from './PortalManager';

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

    describe('onPortalDiscovered', () => {
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
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                },
                {
                    id: 'other-portal',
                    source: 'def',
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
                    },
                    {
                        id: 'other-portal',
                        source: 'def',
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
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: '',
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'def',
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    id: 'test-portal',
                    source: 'abc',
                },
            ]);
        });
    });

    describe('onPortalUpdated', () => {
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
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'different',
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
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'different2',
                },
                {
                    type: 'update_portal_source',
                    portalId: 'test-portal',
                    source: 'different3',
                },
            ]);

            await waitAsync();

            expect(updates).toEqual([
                {
                    oldPortal: {
                        id: 'test-portal',
                        source: 'abc',
                    },
                    portal: {
                        id: 'test-portal',
                        source: 'different3',
                    },
                },
            ]);
        });
    });
});
