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

console.log = jest.fn();

describe('BotManager', () => {
    let sim: BotManager;
    let vm: TestAuxVM;
    let localEvents: Subject<LocalActions[]>;

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
