import { setForcedOffline } from '@casual-simulation/aux-common';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { ConnectionManager } from './ConnectionManager';

describe('ConnectionManager', () => {
    let vm: TestAuxVM;
    let subject: ConnectionManager;

    beforeEach(() => {
        vm = new TestAuxVM('user');
        subject = new ConnectionManager(vm);
    });

    describe('toggleForceOffline()', () => {
        it('should issue an event to force the system offline', async () => {
            await subject.toggleForceOffline();
            await subject.toggleForceOffline();
            await subject.toggleForceOffline();

            expect(vm.events).toEqual([
                setForcedOffline(true),
                setForcedOffline(false),
                setForcedOffline(true),
            ]);
        });
    });

    describe('connectionStateChanged', () => {
        it('should be a direct pipe from the vm', () => {
            let values: boolean[] = [];
            subject.connectionStateChanged.subscribe(status =>
                values.push(status)
            );

            vm.connectionStateChanged.next({
                type: 'connection',
                connected: false,
            });
            vm.connectionStateChanged.next({
                type: 'connection',
                connected: true,
            });

            expect(values).toEqual([false, true]);
        });

        it('should replay the last connection state from the VM', () => {
            vm.connectionStateChanged.next({
                type: 'connection',
                connected: false,
            });
            vm.connectionStateChanged.next({
                type: 'connection',
                connected: true,
            });

            let values: boolean[] = [];
            subject.connectionStateChanged.subscribe(status =>
                values.push(status)
            );

            expect(values).toEqual([true]);
        });
    });

    describe('syncStateChanged', () => {
        it('should relay sync events', () => {
            let values: boolean[] = [];
            subject.syncStateChanged.subscribe(status => values.push(status));

            vm.connectionStateChanged.next({
                type: 'init',
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: false,
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: true,
            });

            expect(values).toEqual([false, true]);
        });

        it('should replay the last sync state from the VM', () => {
            vm.connectionStateChanged.next({
                type: 'init',
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: false,
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: true,
            });

            let values: boolean[] = [];
            subject.syncStateChanged.subscribe(status => values.push(status));

            expect(values).toEqual([true]);
        });

        it('should remove duplicates', () => {
            let values: boolean[] = [];
            subject.syncStateChanged.subscribe(status => values.push(status));

            vm.connectionStateChanged.next({
                type: 'init',
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: false,
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: true,
            });
            vm.connectionStateChanged.next({
                type: 'sync',
                synced: true,
            });

            expect(values).toEqual([false, true]);
        });

        it('should not emit events until the init event', () => {
            let values: boolean[] = [];
            subject.syncStateChanged.subscribe(status => values.push(status));

            vm.connectionStateChanged.next({
                type: 'sync',
                synced: false,
            });

            vm.connectionStateChanged.next({
                type: 'sync',
                synced: true,
            });

            expect(values).toEqual([]);

            vm.connectionStateChanged.next({
                type: 'init',
            });

            expect(values).toEqual([true]);
        });
    });
});
