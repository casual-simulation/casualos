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
import type { UpdatedBotInfo } from '@casual-simulation/aux-vm';
import {
    BotHelper,
    BotWatcher,
    PortalManager,
} from '@casual-simulation/aux-vm';
import type { PrecalculatedBot } from '@casual-simulation/aux-common';
import {
    BotIndex,
    createPrecalculatedBot,
    registerBuiltinPortal,
    defineGlobalBot,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import {
    userBotChangedCore,
    watchPortalConfigBotCore,
} from './BrowserSimulationCalculations';
import { first } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject, firstValueFrom } from 'rxjs';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

console.log = jest.fn();

describe('BrowserSimulationCalculations', () => {
    let watcher: BotWatcher;
    let helper: BotHelper;
    let portals: PortalManager;
    let index: BotIndex;
    let vm: TestAuxVM;
    let localEvents: Subject<RuntimeActions[]>;
    let userId = 'user';

    beforeEach(() => {
        vm = new TestAuxVM('sim');
        vm.processEvents = true;
        localEvents = vm.localEvents = new Subject();
        helper = new BotHelper(vm);
        helper.userId = userId;
        index = new BotIndex();
        watcher = new BotWatcher(
            helper,
            index,
            vm.stateUpdated,
            vm.versionUpdated
        );
        portals = new PortalManager(vm);
    });

    describe('userBotChangedCore()', () => {
        it('should resolve with the user immediately if it is already created', async () => {
            await helper.createBot(userId, {
                test: 'abc',
            });
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                info: {
                    userId: 'username',
                    connectionId: userId,
                    sessionId: 'sessionId',
                },
            });

            const update = await firstValueFrom(
                userBotChangedCore(userId, watcher).pipe(first())
            );

            expect(update).toEqual({
                bot: createPrecalculatedBot(userId, {
                    test: 'abc',
                }),
                tags: new Set(['test']),
            });
        });

        it('should resolve with the user once it is created', async () => {
            let update: UpdatedBotInfo = null;
            userBotChangedCore(userId, watcher)
                .pipe(first())
                .subscribe((u) => (update = u));

            await helper.createBot(userId, {
                test: 'abc',
            });
            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                info: {
                    userId: 'username',
                    connectionId: userId,
                    sessionId: 'sessionId',
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
            userBotChangedCore(userId, watcher)
                .pipe(first())
                .subscribe((u) => (update = u));

            vm.connectionStateChanged.next({
                type: 'authentication',
                authenticated: true,
                info: {
                    userId: 'username',
                    connectionId: userId,
                    sessionId: 'sessionId',
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
                info: {
                    userId: 'username',
                    connectionId: userId,
                    sessionId: 'sessionId',
                },
            });

            localEvents.next([defineGlobalBot('auxPortal', 'test')]);

            const update = await firstValueFrom(
                watchPortalConfigBotCore(
                    watcher,
                    portals,
                    helper,
                    'auxPortal'
                ).pipe(first())
            );

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
                info: {
                    userId: 'username',
                    connectionId: userId,
                    sessionId: 'sessionId',
                },
            });

            localEvents.next([defineGlobalBot('auxPortal', 'test')]);

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
                info: {
                    userId: 'username',
                    connectionId: userId,
                    sessionId: 'sessionId',
                },
            });

            localEvents.next([defineGlobalBot('auxPortal', 'test')]);

            await waitAsync();

            expect(update).toBe(null);

            await helper.createBot('test', {
                abc: 'def',
            });

            await waitAsync();

            expect(update).not.toEqual(null);

            localEvents.next([defineGlobalBot('auxPortal', null)]);

            await waitAsync();

            expect(update).toEqual(null);
        });

        it('should send a register_builtin_portal event', async () => {
            watchPortalConfigBotCore(watcher, portals, helper, 'auxPortal');

            expect(vm.events).toEqual([registerBuiltinPortal('auxPortal')]);
        });
    });
});
