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
});
