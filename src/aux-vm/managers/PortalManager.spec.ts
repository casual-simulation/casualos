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
import {
    asyncResult,
    createPrecalculatedBot,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject, Subscription } from 'rxjs';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import type { PortalBotData, ScriptPrefix } from './PortalManager';
import { DEFAULT_SCRIPT_PREFIXES, PortalManager } from './PortalManager';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

describe('PortalManager', () => {
    let manager: PortalManager;
    let vm: TestAuxVM;
    let sub: Subscription;
    let localEvents: Subject<RuntimeActions[]>;

    beforeEach(() => {
        sub = new Subscription();
        vm = new TestAuxVM('sim');
        localEvents = vm.localEvents = new Subject();
        manager = new PortalManager(vm);
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('prefixes', () => {
        let prefixes = [] as ScriptPrefix[];
        let removedPrefixes = [] as string[];

        beforeEach(() => {
            prefixes = [];
            sub.add(
                manager.prefixesDiscovered.subscribe((p) => prefixes.push(...p))
            );
            sub.add(
                manager.prefixesRemoved.subscribe((p) =>
                    removedPrefixes.push(...p)
                )
            );
        });

        it('should resolve with the default prefixes', async () => {
            await waitAsync();
            expect(prefixes).toEqual(DEFAULT_SCRIPT_PREFIXES);
        });

        it('should resolve when a new prefix is added', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });

        it('should use the language specified on the event', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {
                        language: 'json',
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'json',
                },
            ]);
        });

        it('should use the name specified on the event', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {
                        name: 'test',
                    },
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                    name: 'test',
                },
            ]);
        });

        it('should finish the register_prefix task', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(vm.events).toEqual([asyncResult('task1', undefined)]);
        });

        it('should do nothing when a prefix is registered twice', async () => {
            localEvents.next([
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
                {
                    type: 'register_prefix',
                    taskId: 'task1',
                    prefix: '🐦',
                    options: {},
                },
            ]);

            await waitAsync();

            expect(prefixes.slice(DEFAULT_SCRIPT_PREFIXES.length)).toEqual([
                {
                    prefix: '🐦',
                    language: 'javascript',
                },
            ]);
        });
    });

    describe('portalBotIdUpdated', () => {
        let portals = [] as PortalBotData[];

        beforeEach(() => {
            portals = [];
            sub.add(
                manager.portalBotIdUpdated.subscribe((p) => portals.push(...p))
            );
        });

        it('should resolve when a new global bot is defined', async () => {
            expect(portals).toEqual([]);

            vm.sendState(
                stateUpdatedEvent({
                    test1: createPrecalculatedBot('test1', {
                        script: '🔺console.log("test1");',
                    }),
                })
            );

            localEvents.next([
                {
                    type: 'define_global_bot',
                    botId: 'test',
                    name: 'my',
                    taskId: 'task1',
                },
            ]);

            await waitAsync();

            expect(portals).toEqual([
                {
                    portalId: 'my',
                    botId: 'test',
                },
            ]);
            expect(manager.portalBots).toEqual(
                new Map([
                    [
                        'my',
                        {
                            type: 'define_global_bot',
                            botId: 'test',
                            name: 'my',
                            taskId: 'task1',
                        },
                    ],
                ])
            );
        });
    });
});
