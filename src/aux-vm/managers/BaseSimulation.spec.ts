import { BaseSimulation } from './BaseSimulation';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { Subject } from 'rxjs';
import {
    createPrecalculatedBot,
    LocalActions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

console.log = jest.fn();

describe('BaseSimulation', () => {
    let sim: BaseSimulation;
    let vm: TestAuxVM;
    let localEvents: Subject<LocalActions[]>;

    beforeEach(() => {
        vm = new TestAuxVM();
        localEvents = vm.localEvents = new Subject();
        sim = new BaseSimulation(
            'sim',
            {
                version: 'v1.0.0',
                versionHash: 'hash',
            },
            {
                shared: {
                    type: 'memory',
                    initialState: {},
                },
            },
            (config) => vm
        );
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
