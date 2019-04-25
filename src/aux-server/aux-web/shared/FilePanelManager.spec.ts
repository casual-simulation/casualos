import FilePanelManager from './FilePanelManager';
import { FileHelper } from './FileHelper';
import SelectionManager from './SelectionManager';
import {
    AuxCausalTree,
    AuxFile,
    createFile,
    SandboxResult,
} from '@casual-simulation/aux-common';
import { Subject } from 'rxjs';
import { storedTree, site } from '@casual-simulation/causal-trees';
import FileWatcher from './FileWatcher';
import { RecentFilesManager } from './RecentFilesManager';

describe('FilePanelManager', () => {
    let manager: FilePanelManager;
    let watcher: FileWatcher;
    let helper: FileHelper;
    let selection: SelectionManager;
    let recent: RecentFilesManager;
    let tree: AuxCausalTree;
    let fileUpdated: Subject<AuxFile[]>;
    let fileRemoved: Subject<string[]>;
    let fileAdded: Subject<AuxFile[]>;
    let userId = 'user';

    beforeEach(async () => {
        fileAdded = new Subject<AuxFile[]>();
        fileRemoved = new Subject<string[]>();
        fileUpdated = new Subject<AuxFile[]>();
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, userId);
        selection = new SelectionManager(helper);
        recent = new RecentFilesManager(helper);

        await tree.root();
        await tree.file(userId);

        watcher = new FileWatcher(fileAdded, fileRemoved, fileUpdated);
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
            let files: AuxFile[];
            let isDiff: boolean = true;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                isDiff = e.isDiff;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await selection.selectFile(tree.value['test']);
            fileUpdated.next([tree.value['test']]);

            await selection.selectFile(tree.value['test2'], true);
            fileUpdated.next([tree.value['test2']]);

            expect(files).toEqual([tree.value['test2'], tree.value['test']]);
            expect(isDiff).toBeFalsy();
        });

        it('should resolve with the selected recent file', async () => {
            let files: AuxFile[];
            let isDiff: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                isDiff = e.isDiff;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            await selection.selectFile(tree.value['test']);
            fileUpdated.next([tree.value['test']]);

            await selection.selectFile(tree.value['test2'], true);
            fileUpdated.next([tree.value['test2']]);

            recent.selectedRecentFile = tree.value['recent'];

            expect(files).toEqual([tree.value['recent']]);
            expect(isDiff).toBe(true);
        });

        it('should update based on the search', async () => {
            let files: AuxFile[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            manager.search = '@hello(true)';

            expect(files).toEqual([tree.value['test']]);
            expect(result).toEqual(tree.value['test']);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should handle searches that return non-file values', async () => {
            let files: AuxFile[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            manager.search = '#hello(true)';

            expect(files).toEqual([]);
            expect(result).toEqual(true);
            expect(isSearch).toBe(true);
            expect(isDiff).toBeFalsy();
        });

        it('should fall back to the selection if the search is cleared', async () => {
            let files: AuxFile[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            await selection.selectFile(tree.value['test']);
            fileUpdated.next([tree.value['test']]);

            expect(files).toEqual([tree.value['test']]);
            expect(result).toEqual(null);

            manager.search = '#hello(true)';

            expect(files).toEqual([]);
            expect(result).toEqual(true);
            expect(isSearch).toEqual(true);

            manager.search = '';

            expect(files).toEqual([tree.value['test']]);
            expect(result).toEqual(null);
            expect(isSearch).toBeFalsy();
        });

        it('should handle normal arrays', async () => {
            let files: AuxFile[];
            let result: any;
            let isDiff: boolean;
            let isSearch: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
                result = e.searchResult;
                isDiff = e.isDiff;
                isSearch = e.isSearch;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            manager.search = '#hello';

            expect(files).toEqual([]);
            expect(result).toEqual([true, true]);
            expect(isSearch).toEqual(true);
        });

        it('should automatically open the panel when selecting a file in single select mode', async () => {
            let files: AuxFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            await selection.selectFile(tree.value['test']);
            fileUpdated.next([tree.value['test']]);

            // Need to re-trigger the selection changed event
            // because the file update doesn't trigger the refresh.
            await selection.selectFile(tree.value['test']);

            expect(files).toEqual([tree.value['test']]);
            expect(isOpen).toBe(true);
        });

        it('should automatically close the panel if the user deselects a file and there are none left', async () => {
            let files: AuxFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            manager.isOpen = true;

            await selection.selectFile(tree.value['test']);
            await selection.selectFile(tree.value['test']);

            expect(isOpen).toBe(false);
            expect(files).toEqual([]);
        });

        it('should not automatically close the panel if there are no files and a file update happens', async () => {
            let files: AuxFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            await selection.selectFile(tree.value['test']);
            await selection.selectFile(tree.value['test']);

            manager.isOpen = true;

            fileUpdated.next([tree.value['test']]);

            expect(files).toEqual([]);
            expect(isOpen).toBe(true);
        });

        it('should keep the panel open when searching and no files', async () => {
            let files: AuxFile[];
            let isOpen: boolean;
            manager.filesUpdated.subscribe(e => {
                files = e.files;
            });

            manager.isOpenChanged.subscribe(open => {
                isOpen = open;
            });

            await tree.addFile(
                createFile('test', {
                    hello: true,
                })
            );

            await tree.addFile(
                createFile('test2', {
                    hello: false,
                })
            );

            await tree.addFile(
                createFile('recent', {
                    hello: false,
                })
            );

            manager.isOpen = true;

            manager.search = ' ';

            expect(files).toEqual([]);
            expect(isOpen).toBe(true);
        });
    });
});
