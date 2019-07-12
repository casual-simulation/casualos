import { LoginManager } from './LoginManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { first } from 'rxjs/operators';

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
                authorized: false,
            });
        });

        it('should contain the authentication error reason from the events', async () => {
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                reason: 'invalid_token',
            });

            const state = await subject.loginStateChanged
                .pipe(first())
                .toPromise();

            expect(state).toEqual({
                authenticated: true,
                authorized: false,
                authenticationError: 'invalid_token',
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
    });
});
