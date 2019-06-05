import { FileWatcher } from './FileWatcher';
import {
    AuxFile,
    AuxCausalTree,
    createFile,
    UpdatedFile,
} from '@casual-simulation/aux-common';
import { Subject } from 'rxjs';
import { FileHelper } from './FileHelper';
import { storedTree, site } from '@casual-simulation/causal-trees';
import SelectionManager from './SelectionManager';

describe('FileWatcher', () => {
    let watcher: FileWatcher;
    let helper: FileHelper;
    let selection: SelectionManager;
    let tree: AuxCausalTree;
    let fileUpdated: Subject<UpdatedFile[]>;
    let fileRemoved: Subject<string[]>;
    let fileAdded: Subject<AuxFile[]>;
    let userId = 'user';

    beforeEach(async () => {
        fileAdded = new Subject<AuxFile[]>();
        fileRemoved = new Subject<string[]>();
        fileUpdated = new Subject<UpdatedFile[]>();
        tree = new AuxCausalTree(storedTree(site(1)));
        helper = new FileHelper(tree, userId);
        selection = new SelectionManager(helper);

        await tree.root();
        await tree.file(userId);

        watcher = new FileWatcher(fileAdded, fileRemoved, fileUpdated);
    });

    describe('filesDiscovered', () => {
        it('should resolve with the added files', async () => {
            let files: AuxFile[] = [];
            watcher.filesDiscovered.subscribe(f => files.push(...f));

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

            fileAdded.next([tree.value['test']]);

            fileAdded.next([tree.value['test2']]);

            expect(files).toEqual([tree.value['test'], tree.value['test2']]);
        });

        it('should start with the updated versions of added files', async () => {
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

            fileAdded.next([tree.value['test']]);
            fileAdded.next([tree.value['test2']]);

            await tree.updateFile(tree.value['test'], {
                tags: {
                    hello: 'world',
                },
            });

            await tree.updateFile(tree.value['test2'], {
                tags: {
                    hello: 123,
                },
            });

            fileUpdated.next([
                {
                    file: tree.value['test'],
                    tags: [],
                },
            ]);
            fileUpdated.next([
                {
                    file: tree.value['test2'],
                    tags: [],
                },
            ]);

            let files: AuxFile[] = [];
            watcher.filesDiscovered.subscribe(f => files.push(...f));

            expect(files).toEqual([tree.value['test'], tree.value['test2']]);
        });

        it('should not start with files that were removed', async () => {
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

            fileAdded.next([tree.value['test']]);
            fileAdded.next([tree.value['test2']]);
            fileRemoved.next(['test2']);

            let files: AuxFile[] = [];
            watcher.filesDiscovered.subscribe(f => files.push(...f));

            expect(files).toEqual([tree.value['test']]);
        });
    });

    describe('filesRemoved', () => {
        it('should resolve with the removed file IDs', async () => {
            let files: string[] = [];
            watcher.filesRemoved.subscribe(f => files.push(...f));

            fileRemoved.next(['test']);

            fileRemoved.next(['test2']);

            expect(files).toEqual(['test', 'test2']);
        });
    });

    describe('filesUpdated', () => {
        it('should resolve with the updated files', async () => {
            let files: UpdatedFile[] = [];
            watcher.filesUpdated.subscribe(f => files.push(...f));

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

            fileUpdated.next([
                {
                    file: tree.value['test'],
                    tags: [],
                },
            ]);

            fileUpdated.next([{ file: tree.value['test2'], tags: [] }]);

            expect(files).toEqual([
                { file: tree.value['test'], tags: [] },
                { file: tree.value['test2'], tags: [] },
            ]);
        });
    });

    describe('fileChanged()', () => {
        it('should return an observable that only resolved when the given file changes', async () => {
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

            let files: UpdatedFile[] = [];
            watcher
                .fileChanged(tree.value['test'])
                .subscribe(f => files.push(f));

            fileUpdated.next([{ file: tree.value['test2'], tags: [] }]);
            fileUpdated.next([{ file: tree.value['test'], tags: [] }]);
            fileUpdated.next([{ file: tree.value['test2'], tags: [] }]);

            expect(files).toEqual([
                { file: tree.value['test'], tags: ['hello'] },
                { file: tree.value['test'], tags: [] },
            ]);
        });
    });
});
