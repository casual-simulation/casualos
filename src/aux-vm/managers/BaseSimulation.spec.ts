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
import { BaseSimulation } from './BaseSimulation';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { Subject } from 'rxjs';
import type { LocalActions } from '@casual-simulation/aux-common';
import {
    createPrecalculatedBot,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

console.log = jest.fn();

describe('BaseSimulation', () => {
    let sim: BaseSimulation;
    let vm: TestAuxVM;
    let localEvents: Subject<RuntimeActions[]>;

    beforeEach(() => {
        vm = new TestAuxVM('sim');
        localEvents = vm.localEvents = new Subject();
        sim = new BaseSimulation(vm);
    });

    describe('init()', () => {
        it('should register BotWatcher listeners before the VM is initialized', async () => {
            const initFunc = (vm.init = jest.fn());
            const unresolvedPromise = new Promise(() => {});
            initFunc.mockReturnValueOnce(unresolvedPromise);

            const simPromise = sim.init();

            vm.sendState(
                stateUpdatedEvent({
                    abc: createPrecalculatedBot('abc', {
                        def: 123,
                    }),
                })
            );

            await waitAsync();

            expect(sim.helper.botsState).toEqual({
                abc: createPrecalculatedBot('abc', {
                    def: 123,
                }),
            });
        });
    });
});
