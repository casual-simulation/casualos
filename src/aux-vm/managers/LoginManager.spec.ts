import { LoginManager } from './LoginManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { first } from 'rxjs/operators';
import { AuxUser } from '../AuxUser';
import {
    USERNAME_CLAIM,
    DeviceInfo,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    User,
} from '@casual-simulation/causal-trees';
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
                user: {
                    id: 'id',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
            });

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

            expect(state).toEqual({
                authenticated: true,
                authorized: null,
                authenticationError: 'invalid_token',
                user: {
                    id: 'id',
                    name: 'name',
                    token: 'token',
                    username: 'username',
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
                user: null,
                info: null,
            });

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

            expect(state).toEqual({
                authenticated: true,
                authorized: null,
                user: null,
                info: null,
            });
        });

        it('should contain the authorization error reason from the events', async () => {
            vm.connectionStateChanged.next({
                type: 'authorization',
                authorized: false,
                reason: 'channel_doesnt_exist',
            });

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

            expect(state).toEqual({
                authenticated: false,
                authorized: false,
                authorizationError: 'channel_doesnt_exist',
            });
        });
    });

    describe('userChanged', () => {
        it('should contain the most recent user', async () => {
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
                user: {
                    id: 'id',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
            });

            let user1: User;
            let user2: User;
            let sub1 = subject.userChanged.subscribe(user => (user1 = user));
            let sub2 = subject.userChanged.subscribe(user => (user2 = user));

            expect(user1).toEqual({
                id: 'id',
                name: 'name',
                token: 'token',
                username: 'username',
            });
            expect(user2).toEqual({
                id: 'id',
                name: 'name',
                token: 'token',
                username: 'username',
            });
        });

        it('should only resolve when the user changes', async () => {
            let users: AuxUser[] = [];
            subject.userChanged.subscribe(u => users.push(u));

            let user = {
                id: 'id',
                name: 'name',
                token: 'token',
                username: 'username',
            };
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
                user: user,
            });

            vm.connectionStateChanged.next({
                type: 'authorization',
                authorized: true,
            });

            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: false,
                user: null,
            });

            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                user: user,
            });

            expect(users).toEqual([null, user, null, user]);
        });
    });

    describe('deviceChanged', () => {
        it('should contain the most recent device', async () => {
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
                user: {
                    id: 'id',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                        [DEVICE_ID_CLAIM]: 'deviceId',
                        [SESSION_ID_CLAIM]: 'sessionId',
                    },
                    roles: [],
                },
            });

            const device = await subject.deviceChanged
                .pipe(first())
                .toPromise();

            expect(device).toEqual({
                claims: {
                    [USERNAME_CLAIM]: 'test',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            });
        });

        it('should only resolve when the user changes', async () => {
            let devices: DeviceInfo[] = [];
            subject.deviceChanged.subscribe(u => devices.push(u));

            let device: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'test',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
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

    describe('setUser()', () => {
        it('should pipe the call to the VM', async () => {
            const user: AuxUser = {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            };
            await subject.setUser(user);
            expect(vm.user).toBe(user);
        });
    });

    describe('setGrant()', () => {
        it('should pipe the call to the VM', async () => {
            await subject.setGrant('abc');
            expect(vm.grant).toBe('abc');
        });
    });
});
