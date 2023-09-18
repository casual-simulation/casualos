import { LoginManager } from './LoginManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { first } from 'rxjs/operators';
import { ConnectionInfo } from '@casual-simulation/aux-common';
import { Bot } from '@casual-simulation/aux-common';

describe('LoginManager', () => {
    let subject: LoginManager;
    let vm: TestAuxVM;

    beforeEach(() => {
        vm = new TestAuxVM();
        subject = new LoginManager(vm);
    });

    describe('loginStateChanged', () => {
        it('should default to not authenticated or authorized', async () => {
            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

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

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

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

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

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

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

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
                reason: 'invalid_token',
            });

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

            expect(state).toEqual({
                authenticated: false,
                authorized: false,
                authorizationError: 'invalid_token',
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

            const device = await subject.deviceChanged
                .pipe(first())
                .toPromise();

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
