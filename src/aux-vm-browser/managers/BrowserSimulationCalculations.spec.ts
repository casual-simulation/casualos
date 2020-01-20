import { LoginManager, BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    BotIndex,
    createBot,
    createPrecalculatedBot,
    Bot,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { userBotChangedCore } from './BrowserSimulationCalculations';
import { first } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';

console.log = jest.fn();

describe('BrowserSimulationCalculations', () => {
    let login: LoginManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;

    let userId = 'user';

    beforeEach(() => {
        vm = new TestAuxVM();
        vm.processEvents = true;
        login = new LoginManager(vm);
        helper = new BotHelper(vm);
        helper.userId = userId;
        index = new BotIndex();
        watcher = new BotWatcher(helper, index, vm.stateUpdated);
    });

    describe('userBotChangedCore()', () => {
        it('should resolve with the user immediately if it is already created', async () => {
            await helper.createBot(userId, {
                test: 'abc',
            });
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                user: {
                    id: userId,
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
            });

            const user = await userBotChangedCore(login, watcher)
                .pipe(first())
                .toPromise();

            expect(user).toEqual(
                createPrecalculatedBot(userId, {
                    test: 'abc',
                })
            );
        });

        it('should resolve with the user once it is created', async () => {
            let user: Bot = null;
            userBotChangedCore(login, watcher)
                .pipe(first())
                .subscribe(u => (user = u));

            await helper.createBot(userId, {
                test: 'abc',
            });
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                user: {
                    id: userId,
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
            });

            await waitAsync();

            expect(user).toEqual(
                createPrecalculatedBot(userId, {
                    test: 'abc',
                })
            );
        });

        it('should resolve with the user once it is created', async () => {
            let user: Bot = null;
            userBotChangedCore(login, watcher)
                .pipe(first())
                .subscribe(u => (user = u));

            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                user: {
                    id: userId,
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
            });

            await waitAsync();

            expect(user).toEqual(null);

            await helper.createBot(userId, {
                test: 'abc',
            });

            await waitAsync();

            expect(user).toEqual(
                createPrecalculatedBot(userId, {
                    test: 'abc',
                })
            );
        });
    });
});
