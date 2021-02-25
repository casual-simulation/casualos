import {
    LoginManager,
    BotHelper,
    BotWatcher,
    UpdatedBotInfo,
    PortalManager,
    CodeBundle,
    ScriptPrefix,
    LibraryModule,
} from '@casual-simulation/aux-vm';
import {
    BotIndex,
    createBot,
    createPrecalculatedBot,
    Bot,
    PrecalculatedBot,
    botUpdated,
    BotsState,
    stateUpdatedEvent,
    openCustomPortal,
    LocalActions,
    registerBuiltinPortal,
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
import { Subject } from 'rxjs';

console.log = jest.fn();

describe('BrowserSimulationCalculations', () => {
    let login: LoginManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let portals: PortalManager;
    let index: BotIndex;
    let vm: TestAuxVM;
    let bundler: {
        bundleTag: jest.Mock<
            Promise<CodeBundle>,
            [BotsState, string, ScriptPrefix[]]
        >;
        addLibrary: jest.Mock<void, [LibraryModule]>;
    };
    let localEvents: Subject<LocalActions[]>;

    let userId = 'user';

    beforeEach(() => {
        vm = new TestAuxVM();
        vm.processEvents = true;
        localEvents = vm.localEvents = new Subject();
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
        bundler = {
            bundleTag: jest.fn(),
            addLibrary: jest.fn(),
        };
        portals = new PortalManager(vm, helper, watcher, bundler);
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
            await helper.createBot(userId, {});
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

            localEvents.next([openCustomPortal('auxPortal', 'test', null, {})]);

            const update = await watchPortalConfigBotCore(
                watcher,
                portals,
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
                watcher,
                portals,
                helper,
                'auxPortal'
            ).subscribe((bot) => (update = bot));

            await helper.createBot(userId, {});
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

            localEvents.next([openCustomPortal('auxPortal', 'test', null, {})]);

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
                watcher,
                portals,
                helper,
                'auxPortal'
            ).subscribe((bot) => (update = bot));

            await helper.createBot(userId, {});
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

            localEvents.next([openCustomPortal('auxPortal', 'test', null, {})]);

            await waitAsync();

            expect(update).toBe(null);

            await helper.createBot('test', {
                abc: 'def',
            });

            await waitAsync();

            expect(update).not.toEqual(null);

            localEvents.next([openCustomPortal('auxPortal', null, null, {})]);

            await waitAsync();

            expect(update).toEqual(null);
        });

        it('should send a register_builtin_portal event', async () => {
            watchPortalConfigBotCore(watcher, portals, helper, 'auxPortal');

            expect(vm.events).toEqual([registerBuiltinPortal('auxPortal')]);
        });
    });
});
