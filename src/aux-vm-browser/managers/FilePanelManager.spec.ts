import { FilePanelManager } from './FilePanelManager';
import { BotHelper, FileWatcher } from '@casual-simulation/aux-vm';
import SelectionManager from './SelectionManager';
import {
    createBot,
    createPrecalculatedBot,
    fileAdded,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import { RecentFilesManager } from './RecentFilesManager';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';

describe('FilePanelManager', () => {
    let manager: FilePanelManager;
    let watcher: FileWatcher;
    let helper: BotHelper;
    let selection: SelectionManager;
    let recent: RecentFilesManager;
    let vm: TestAuxVM;
    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM(userId);
        vm.processEvents = true;
        helper = new BotHelper(vm);
        helper.userId = userId;
        selection = new SelectionManager(helper);
        recent = new RecentFilesManager(helper);

        watcher = new FileWatcher(helper, vm.stateUpdated);

        await vm.sendEvents([fileAdded(createBot('user'))]);

        manager = new FilePanelManager(watcher, helper, selection, recent);
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

    describe('filesUpdated', () => {
        it('should resolve whenever the selected files update', async () => {
            let files: PrecalculatedBot[];
            let isDiff: boolean = true;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                isDiff = e.isDiff;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.filesState['test']);

            await selection.selectFile(helper.filesState['test2'], true);

            expect(files).toEqual([
                helper.filesState['test'],
                helper.filesState['test2'],
            ]);
            expect(isDiff).toBeFalsy();
        });

        it('should resolve with the selected recent file', async () => {
            let files: PrecalculatedBot[];
            let isDiff: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                isDiff = e.isDiff;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.filesState['test']);

            await selection.selectFile(helper.filesState['test2'], true);

            recent.selectedRecentFile = helper.filesState['recent'];

            await waitForPromisesToFinish();

            expect(files).toEqual([helper.filesState['recent']]);
            expect(isDiff).toBe(true);
        });

        it('should update based on the search', async () => {
            let files: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = 'getBots("hello", true)';
            await waitForPromisesToFinish();

            expect(files).toEqual([helper.filesState['test']]);
            expect(result).toEqual([helper.filesState['test']]);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should handle searches that return non-file values', async () => {
            let files: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = 'getBotTagValues("hello", true).first()';
            await waitForPromisesToFinish();

            expect(files).toEqual([]);
            expect(result).toEqual(true);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should fall back to the selection if the search is cleared', async () => {
            let files: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.filesState['test']);
            // fileUpdated.next([{ file: helper.filesState['test'], tags: [] }]);

            expect(files).toEqual([helper.filesState['test']]);
            expect(result).toEqual(null);

            manager.search = 'getBotTagValues("hello", true)';
            await Promise.resolve();
            await Promise.resolve();

            expect(files).toEqual([]);
            expect(result).toEqual([true]);
            expect(isSearch).toEqual(true);

            manager.search = '';
            await waitForPromisesToFinish();

            expect(files).toEqual([helper.filesState['test']]);
            expect(result).toEqual(null);
            expect(isSearch).toBeFalsy();
        });

        it('should handle normal arrays', async () => {
            let files: PrecalculatedBot[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = 'getBotTagValues("hello")';
            await waitForPromisesToFinish();

            expect(files).toEqual([]);
            expect(result).toEqual([false, true, true]);
            expect(isSearch).toEqual(true);
        });

        it('should automatically open the panel when selecting a file in single select mode', async () => {
            let files: PrecalculatedBot[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(
                helper.filesState['test'],
                false,
                manager
            );

            // Need to re-trigger the selection changed event
            // because the file update doesn't trigger the refresh.
            await selection.selectFile(
                helper.filesState['test'],
                false,
                manager
            );

            expect(files).toEqual([helper.filesState['test']]);
            expect(isOpen).toBe(true);
        });

        it('should automatically close the panel if the user deselects a file and there are none left', async () => {
            let files: PrecalculatedBot[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.isOpen = true;

            await selection.selectFile(helper.filesState['test']);
            await selection.clearSelection();

            expect(isOpen).toBe(false);
        });

        it('should not automatically close the panel if there are no files and a file update happens', async () => {
            let files: PrecalculatedBot[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(
                helper.filesState['test'],
                true,
                manager
            );
            await selection.selectFile(
                helper.filesState['test'],
                true,
                manager
            );

            manager.isOpen = true;

            // fileUpdated.next([{ file: helper.filesState['test'], tags: [] }]);

            expect(files).toEqual([createPrecalculatedBot('empty', {})]);
            expect(isOpen).toBe(true);
        });

        it('should keep the panel open when searching and no files', async () => {
            let files: PrecalculatedBot[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createBot('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createBot('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createBot('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.isOpen = true;

            manager.search = ' ';
            await waitForPromisesToFinish();

            expect(files).toEqual([]);
            expect(isOpen).toBe(true);
        });
    });
});

async function waitForPromisesToFinish() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}
