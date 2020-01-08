import { BotPanelManager } from './BotPanelManager';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    PrecalculatedBot,
    BotIndex,
    botUpdated,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';

describe('BotPanelManager', () => {
    let manager: BotPanelManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let index: BotIndex;
    let vm: TestAuxVM;
    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM(userId);
        vm.processEvents = true;
        helper = new BotHelper(vm);
        helper.userId = userId;
        index = new BotIndex();

        watcher = new BotWatcher(helper, index, vm.stateUpdated);

        await vm.sendEvents([botAdded(createBot('user'))]);

        manager = new BotPanelManager(watcher, helper, 'hello');
    });

    describe('botsUpdated', () => {
        it('should resolve whenever a bot in the given dimension updates', async () => {
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
            ]);

            expect(bots).toEqual([helper.botsState['test']]);

            await vm.sendEvents([
                botUpdated('test2', {
                    tags: {
                        hello: true,
                    },
                }),
            ]);

            expect(bots).toEqual([
                helper.botsState['test'],
                helper.botsState['test2'],
            ]);
        });

        it('should include all bots when the dimension is set to a falsy value', async () => {
            manager = new BotPanelManager(watcher, helper, null);
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
            ]);

            expect(bots).toEqual(helper.objects);
        });
    });
});

async function waitForPromisesToFinish() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}
