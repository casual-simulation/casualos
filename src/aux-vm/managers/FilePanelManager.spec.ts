import { FilePanelManager } from './FilePanelManager';
import { FileHelper } from './FileHelper';
import SelectionManager from './SelectionManager';
import {
    AuxCausalTree,
    AuxFile,
    createFile,
    SandboxResult,
    UpdatedFile,
    createPrecalculatedFile,
    fileAdded,
    PrecalculatedFile,
} from '@casual-simulation/aux-common';
import { Subject } from 'rxjs';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { FileWatcher } from './FileWatcher';
import { RecentFilesManager } from './RecentFilesManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';

describe('FilePanelManager', () => {
    let manager: FilePanelManager;
    let watcher: FileWatcher;
    let helper: FileHelper;
    let selection: SelectionManager;
    let recent: RecentFilesManager;
    let vm: TestAuxVM;
    let userId = 'user';

    beforeEach(async () => {
        vm = new TestAuxVM(userId);
        vm.processEvents = true;
        helper = new FileHelper(vm, userId);
        selection = new SelectionManager(helper);
        recent = new RecentFilesManager(helper);

        watcher = new FileWatcher(helper, vm.stateUpdated);

        await vm.sendEvents([fileAdded(createFile('user'))]);

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
            let files: PrecalculatedFile[];
            let isDiff: boolean = true;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                isDiff = e.isDiff;
            });

            await vm.sendEvents([
                fileAdded(
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
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
            let files: PrecalculatedFile[];
            let isDiff: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                isDiff = e.isDiff;
            });

            await vm.sendEvents([
                fileAdded(
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
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
            let files: PrecalculatedFile[];
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
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = '@hello(true)';
            await waitForPromisesToFinish();

            expect(files).toEqual([helper.filesState['test']]);
            expect(result).toEqual([helper.filesState['test']]);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should handle searches that return non-file values', async () => {
            let files: PrecalculatedFile[];
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
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = '#hello(true).first()';
            await waitForPromisesToFinish();

            expect(files).toEqual([]);
            expect(result).toEqual(true);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should fall back to the selection if the search is cleared', async () => {
            let files: PrecalculatedFile[];
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
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
                        hello: false,
                    })
                ),
            ]);

            await selection.selectFile(helper.filesState['test']);
            // fileUpdated.next([{ file: helper.filesState['test'], tags: [] }]);

            expect(files).toEqual([helper.filesState['test']]);
            expect(result).toEqual(null);

            manager.search = '#hello(true)';
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
            let files: PrecalculatedFile[];
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
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('recent', {
                        hello: false,
                    })
                ),
            ]);

            manager.search = '#hello';
            await waitForPromisesToFinish();

            expect(files).toEqual([]);
            expect(result).toEqual([false, true, true]);
            expect(isSearch).toEqual(true);
        });

        it('should automatically open the panel when selecting a file in single select mode', async () => {
            let files: PrecalculatedFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
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
            let files: PrecalculatedFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
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
            let files: PrecalculatedFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
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

            expect(files).toEqual([createPrecalculatedFile('empty', {})]);
            expect(isOpen).toBe(true);
        });

        it('should keep the panel open when searching and no files', async () => {
            let files: PrecalculatedFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await vm.sendEvents([
                fileAdded(
                    createFile('test', {
                        hello: true,
                    })
                ),
                fileAdded(
                    createFile('test2', {
                        hello: false,
                    })
                ),
                fileAdded(
                    createFile('recent', {
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
