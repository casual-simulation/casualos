import { BotPanelManager } from './BotPanelManager';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    PrecalculatedBot,
    BotIndex,
    botUpdated,
    botRemoved,
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

        await vm.sendEvents([
            botAdded(
                createBot('user', {
                    auxSheetPortal: 'hello',
                })
            ),
        ]);

        manager = new BotPanelManager(watcher, helper, false);
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

        it('should resolve with no bots when there is no user', async () => {
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botRemoved('user'),
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

            expect(bots).toEqual([]);
        });

        it('should include all bots when the dimension is set to true', async () => {
            manager = new BotPanelManager(watcher, helper, false);
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: true,
                    },
                }),
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

        it('should include all bots when the dimension is set to id', async () => {
            manager = new BotPanelManager(watcher, helper, false);
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: 'id',
                    },
                }),
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

        it('should update when the user bot changes the viewed dimension', async () => {
            let bots: PrecalculatedBot[];
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: 'wow',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(bots).toEqual([helper.botsState['test2']]);
        });

        it('should indicate whether the portal has a value', async () => {
            let hasPortal: boolean;
            manager.botsUpdated.subscribe(e => {
                hasPortal = e.hasPortal;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: 'wow',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(hasPortal).toBe(true);

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: null,
                    },
                }),
            ]);

            expect(hasPortal).toBe(false);
        });

        it('should indicate the dimension that the portal is using', async () => {
            let dimension: string;
            manager.botsUpdated.subscribe(e => {
                dimension = e.dimension;
            });

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: 'wow',
                    },
                }),
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: false,
                        wow: true,
                    })
                ),
            ]);

            expect(dimension).toBe('wow');

            await vm.sendEvents([
                botUpdated('user', {
                    tags: {
                        auxSheetPortal: null,
                    },
                }),
            ]);

            expect(dimension).toBe(null);
        });
    });
});
