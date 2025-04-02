/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { setForcedOffline } from '@casual-simulation/aux-common';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { ConnectionManager } from './ConnectionManager';

describe('ConnectionManager', () => {
    let vm: TestAuxVM;
    let subject: ConnectionManager;

    beforeEach(() => {
        vm = new TestAuxVM('sim', 'user');
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
            subject.connectionStateChanged.subscribe((status) =>
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
            subject.connectionStateChanged.subscribe((status) =>
                values.push(status)
            );

            expect(values).toEqual([true]);
        });
    });

    describe('syncStateChanged', () => {
        it('should relay sync events', () => {
            let values: boolean[] = [];
            subject.syncStateChanged.subscribe((status) => values.push(status));

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
            subject.syncStateChanged.subscribe((status) => values.push(status));

            expect(values).toEqual([true]);
        });

        it('should remove duplicates', () => {
            let values: boolean[] = [];
            subject.syncStateChanged.subscribe((status) => values.push(status));

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
            subject.syncStateChanged.subscribe((status) => values.push(status));

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
