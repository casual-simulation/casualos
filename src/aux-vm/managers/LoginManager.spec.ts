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
import { LoginManager } from './LoginManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { first } from 'rxjs/operators';
import type { ConnectionInfo } from '@casual-simulation/aux-common';
import { firstValueFrom } from 'rxjs';

describe('LoginManager', () => {
    let subject: LoginManager;
    let vm: TestAuxVM;

    beforeEach(() => {
        vm = new TestAuxVM('sim');
        subject = new LoginManager(vm);
    });

    describe('loginStateChanged', () => {
        it('should default to not authenticated or authorized', async () => {
            const state = await firstValueFrom(
                subject.loginStateChanged.pipe(first())
            );

            expect(state).toEqual({
                authenticated: false,
                authorized: null,
            });
        });

        it('should contain the authentication error reason from the events', async () => {
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
                info: {
                    userId: 'username',
                    sessionId: 'sessionId',
                    connectionId: 'connectionId',
                },
            });

            const state = await firstValueFrom(
                subject.loginStateChanged.pipe(first())
            );

            expect(state).toEqual({
                authenticated: true,
                authorized: null,
                authenticationError: 'invalid_token',
                info: {
                    userId: 'username',
                    sessionId: 'sessionId',
                    connectionId: 'connectionId',
                },
            });
        });

        it('should update the authorized state', async () => {
            vm.connectionStateChanged.next({
                type: 'authorization',
                authorized: true,
            });

            const state = await firstValueFrom(
                subject.loginStateChanged.pipe(first())
            );

            expect(state).toEqual({
                authenticated: false,
                authorized: true,
            });
        });

        it('should set authorized to null after authenticated is changed', async () => {
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                info: null,
            });

            const state = await firstValueFrom(
                subject.loginStateChanged.pipe(first())
            );

            expect(state).toEqual({
                authenticated: true,
                authorized: null,
                info: null,
            });
        });

        it('should contain the authorization error reason from the events', async () => {
            vm.connectionStateChanged.next({
                type: 'authorization',
                authorized: false,
                error: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'Not Authorized',
                },
            });

            const state = await firstValueFrom(
                subject.loginStateChanged.pipe(first())
            );

            expect(state).toEqual({
                authenticated: false,
                authorized: false,
                error: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: 'Not Authorized',
                },
            });
        });
    });

    describe('deviceChanged', () => {
        it('should contain the most recent device', async () => {
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
                info: {
                    userId: 'username',
                    sessionId: 'sessionId',
                    connectionId: 'connectionId',
                },
            });

            const device = await firstValueFrom(
                subject.deviceChanged.pipe(first())
            );

            expect(device).toEqual({
                userId: 'username',
                sessionId: 'sessionId',
                connectionId: 'connectionId',
            });
        });

        it('should only resolve when the user changes', async () => {
            let devices: ConnectionInfo[] = [];
            subject.deviceChanged.subscribe((u) => devices.push(u));

            let device: ConnectionInfo = {
                userId: 'username',
                sessionId: 'sessionId',
                connectionId: 'connectionId',
            };
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
                info: device,
            });

            vm.connectionStateChanged.next({
                type: 'authorization',
                authorized: true,
            });

            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: false,
                info: null,
            });

            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                info: device,
            });

            expect(devices).toEqual([null, device, null, device]);
        });
    });
});
