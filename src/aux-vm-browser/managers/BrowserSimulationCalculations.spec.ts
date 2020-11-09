import {
    LoginManager,
    BotHelper,
    BotWatcher,
    UpdatedBotInfo,
} from '@casual-simulation/aux-vm';
import {
    BotIndex,
    createBot,
    createPrecalculatedBot,
    Bot,
    PrecalculatedBot,
    botUpdated,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import {
    userBotChangedCore,
    watchPortalConfigBot,
    watchPortalConfigBotCore,
} from './BrowserSimulationCalculations';
import { first } from 'rxjs/operators';
import {
    waitAsync,
    wait,
} from '@casual-simulation/aux-common/test/TestHelpers';

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
        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );
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

            const update = await userBotChangedCore(login, watcher)
                .pipe(first())
                .toPromise();

            expect(update).toEqual({
                bot: createPrecalculatedBot(userId, {
                    test: 'abc',
                }),
                tags: new Set(['test']),
            });
        });

        it('should resolve with the user once it is created', async () => {
            let update: UpdatedBotInfo = null;
            userBotChangedCore(login, watcher)
                .pipe(first())
                .subscribe((u) => (update = u));

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

            expect(update).toEqual({
                bot: createPrecalculatedBot(userId, {
                    test: 'abc',
                }),
                tags: new Set(['test']),
            });
        });

        it('should resolve with the user once it is created', async () => {
            let update: UpdatedBotInfo = null;
            userBotChangedCore(login, watcher)
                .pipe(first())
                .subscribe((u) => (update = u));

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

            expect(update).toEqual(null);

            await helper.createBot(userId, {
                test: 'abc',
            });

            await waitAsync();

            expect(update).toEqual({
                bot: createPrecalculatedBot(userId, {
                    test: 'abc',
                }),
                tags: new Set(['test']),
            });
        });
    });

    describe('watchPortalConfigBot()', () => {
        it('should resolve with the bot immediately if it is already created', async () => {
            await helper.createBot(userId, {
                auxPortalConfigBot: 'test',
            });
            await helper.createBot('test', {
                abc: 'def',
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

            const update = await watchPortalConfigBotCore(
                login,
                watcher,
                helper,
                'auxPortal'
            )
                .pipe(first())
                .toPromise();

            expect(update).toEqual(
                createPrecalculatedBot('test', {
                    abc: 'def',
                })
            );
        });

        it('should resolve with the bot once it is created', async () => {
            let update: PrecalculatedBot = null;
            watchPortalConfigBotCore(
                login,
                watcher,
                helper,
                'auxPortal'
            ).subscribe((bot) => (update = bot));

            await helper.createBot(userId, {
                auxPortalConfigBot: 'test',
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

            expect(update).toBe(null);

            await helper.createBot('test', {
                abc: 'def',
            });

            await waitAsync();

            expect(update).toEqual(
                createPrecalculatedBot('test', {
                    abc: 'def',
                })
            );
        });

        it('should resolve with null if the bot is cleared', async () => {
            let update: PrecalculatedBot = null;
            watchPortalConfigBotCore(
                login,
                watcher,
                helper,
                'auxPortal'
            ).subscribe((bot) => (update = bot));

            await helper.createBot(userId, {
                auxPortalConfigBot: 'test',
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

            expect(update).toBe(null);

            await helper.createBot('test', {
                abc: 'def',
            });

            await waitAsync();

            expect(update).not.toEqual(null);

            await helper.transaction(
                botUpdated(userId, {
                    tags: {
                        auxPortalConfigBot: null,
                    },
                })
            );

            await waitAsync();

            expect(update).toEqual(null);
        });
    });
});
