import { BotPanelManager } from './BotPanelManager';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import SelectionManager from './SelectionManager';
import {
    createBot,
    createPrecalculatedBot,
    botAdded,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import { RecentBotManager } from './RecentBotManager';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';

describe('BotPanelManager', () => {
    let manager: BotPanelManager;
    let watcher: BotWatcher;
    let helper: BotHelper;
    let selection: SelectionManager;
    let recent: RecentBotManager;
    let vm: TestAuxVM;
    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM(userId);
        vm.processEvents = true;
        helper = new BotHelper(vm);
        helper.userId = userId;
        selection = new SelectionManager(helper);
        recent = new RecentBotManager(helper);

        watcher = new BotWatcher(helper, vm.stateUpdated);

        await vm.sendEvents([botAdded(createBot('user'))]);

        manager = new BotPanelManager(watcher, helper, selection, recent);
    });

    describe('isOpen', () => {
        it('should be closed by default', () => {
            expect(manager.isOpen).toBe(false);
        });

        it('should send an event when the panel gets toggled open', () => {
            let changes: boolean[] = [];
            manager.isOpenChanged.subscribe(c => changes.push(c));

            expect(changes).toEqual([false]);

            manager.toggleOpen();
            manager.toggleOpen();

            expect(changes).toEqual([false, true, false]);
        });
    });

    describe('botsUpdated', () => {
        it('should resolve whenever the selected bots update', async () => {
            let bots: PrecalculatedBot[];
            let isDiff: boolean = true;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
                isDiff = e.isDiff;
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

            await selection.selectFile(helper.botsState['test']);

            await selection.selectFile(helper.botsState['test2'], true);

            expect(bots).toEqual([
                helper.botsState['test'],
                helper.botsState['test2'],
            ]);
            expect(isDiff).toBeFalsy();
        });

        it('should resolve with the selected recent bot', async () => {
            let bots: PrecalculatedBot[];
            let isDiff: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
                isDiff = e.isDiff;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.botsState['test']);

            await selection.selectFile(helper.botsState['test2'], true);

            recent.selectedRecentBot = helper.botsState['recent'];

            await waitForPromisesToFinish();

            expect(bots).toEqual([helper.botsState['recent']]);
            expect(isDiff).toBe(true);
        });

        it('should update based on the search', async () => {
            let bots: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = 'getBots("hello", true)';
            await waitForPromisesToFinish();

            expect(bots).toEqual([helper.botsState['test']]);
            expect(result).toEqual([helper.botsState['test']]);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should handle searches that return non-bot values', async () => {
            let bots: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = 'getBotTagValues("hello", true).first()';
            await waitForPromisesToFinish();

            expect(bots).toEqual([]);
            expect(result).toEqual(true);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should fall back to the selection if the search is cleared', async () => {
            let bots: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.botsState['test']);
            // botUpdated.next([{ bot: helper.botsState['test'], tags: [] }]);

            expect(bots).toEqual([helper.botsState['test']]);
            expect(result).toEqual(null);

            manager.search = 'getBotTagValues("hello", true)';
            await Promise.resolve();
            await Promise.resolve();

            expect(bots).toEqual([]);
            expect(result).toEqual([true]);
            expect(isSearch).toEqual(true);

            manager.search = '';
            await waitForPromisesToFinish();

            expect(bots).toEqual([helper.botsState['test']]);
            expect(result).toEqual(null);
            expect(isSearch).toBeFalsy();
        });

        it('should handle normal arrays', async () => {
            let bots: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        hello: true,
                    })
                ),
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = 'getBotTagValues("hello")';
            await waitForPromisesToFinish();

            expect(bots).toEqual([]);
            expect(result).toEqual([false, true, true]);
            expect(isSearch).toEqual(true);
        });

        it('should automatically open the panel when selecting a bot in single select mode', async () => {
            let bots: PrecalculatedBot[];
            let isOpen: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(
                helper.botsState['test'],
                false,
                manager
            );

            // Need to re-trigger the selection changed event
            // because the bot update doesn't trigger the refresh.
            await selection.selectFile(
                helper.botsState['test'],
                false,
                manager
            );

            expect(bots).toEqual([helper.botsState['test']]);
            expect(isOpen).toBe(true);
        });

        it('should automatically close the panel if the user deselects a bot and there are none left', async () => {
            let bots: PrecalculatedBot[];
            let isOpen: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.isOpen = true;

            await selection.selectFile(helper.botsState['test']);
            await selection.clearSelection();

            expect(isOpen).toBe(false);
        });

        it('should not automatically close the panel if there are no bots and a bot update happens', async () => {
            let bots: PrecalculatedBot[];
            let isOpen: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.botsState['test'], true, manager);
            await selection.selectFile(helper.botsState['test'], true, manager);

            manager.isOpen = true;

            // botUpdated.next([{ bot: helper.botsState['test'], tags: [] }]);

            expect(bots).toEqual([createPrecalculatedBot('empty', {})]);
            expect(isOpen).toBe(true);
        });

        it('should keep the panel open when searching and no bots', async () => {
            let bots: PrecalculatedBot[];
            let isOpen: boolean;
            manager.botsUpdated.subscribe(e => {
                bots = e.bots;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
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
                botAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.isOpen = true;

            manager.search = ' ';
            await waitForPromisesToFinish();

            expect(bots).toEqual([]);
            expect(isOpen).toBe(true);
        });
    });
});

async function waitForPromisesToFinish() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}
