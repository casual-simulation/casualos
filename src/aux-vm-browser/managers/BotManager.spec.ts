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
import { BotManager } from './BotManager';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { Subject } from 'rxjs';
import type { LocalActions } from '@casual-simulation/aux-common';
import {
    createPrecalculatedBot,
    defineGlobalBot,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import {
    wait,
    waitAsync,
} from '@casual-simulation/aux-common/test/TestHelpers';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

console.log = jest.fn();

describe('BotManager', () => {
    let sim: BotManager;
    let vm: TestAuxVM;
    let localEvents: Subject<RuntimeActions[]>;

    beforeEach(() => {
        vm = new TestAuxVM('sim');
        localEvents = vm.localEvents = new Subject();
        sim = new BotManager(
            {
                recordName: null,
                inst: 'sim',
            },
            {
                version: 'v1.0.0',
                versionHash: 'hash',
                vmOrigin: 'http://example.com',
            },
            vm
        );
    });

    describe('init()', () => {
        it('should register PortalManager listeners before the VM is initialized', async () => {
            const initFunc = (vm.init = jest.fn());
            const unresolvedPromise = new Promise(() => {});
            initFunc.mockReturnValueOnce(unresolvedPromise);

            const simPromise = sim.init();

            localEvents.next([defineGlobalBot('myPortal', 'botId')]);

            await waitAsync();

            expect(sim.portals?.portalBots).toEqual(
                new Map([['myPortal', defineGlobalBot('myPortal', 'botId')]])
            );
        });
    });
});
