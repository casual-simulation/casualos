import { FilesState, createFile, fileAdded } from '../Files';
import {
    SyncedRealtimeCausalTree,
    AtomOp,
    storedTree,
    site,
    Atom,
    CausalTreeFactory,
    RealtimeChannelImpl,
    RealtimeChannel,
} from '@casual-simulation/causal-trees';
import { auxCausalTreeFactory } from './AuxCausalTreeFactory';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { TestChannelConnection } from '@casual-simulation/causal-trees/test/TestChannelConnection';
import {
    fileChangeObservables,
    UpdatedFile,
} from './AuxRealtimeTreeCalculations';
import { AuxCausalTree } from './AuxCausalTree';
import { TestScheduler } from 'rxjs/testing';
import { AsyncScheduler } from 'rxjs/internal/scheduler/AsyncScheduler';
import { tap, flatMap } from 'rxjs/operators';

describe('AuxRealtimeTreeCalculations', () => {
    let factory: CausalTreeFactory;
    let store: TestCausalTreeStore;
    let connection: TestChannelConnection;
    let channel: RealtimeChannel;
    let tree: SyncedRealtimeCausalTree<AuxCausalTree>;

    beforeEach(async () => {
        factory = auxCausalTreeFactory();
        store = new TestCausalTreeStore();
        connection = new TestChannelConnection({
            id: 'test',
            type: 'aux',
        });
        channel = new RealtimeChannelImpl(connection);
        tree = new SyncedRealtimeCausalTree<AuxCausalTree>(
            factory,
            store,
            channel
        );
    });

    describe('fileChangeObservables()', () => {
        let scheduler: TestScheduler;

        beforeEach(() => {
            scheduler = new TestScheduler((actual, expected) => {
                expect(actual).toEqual(expected);
            });
            AsyncScheduler.delegate = scheduler;
        });

        afterEach(() => {
            AsyncScheduler.delegate = null;
        });

        it('should sort added files so workspaces are first', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            const { filesAdded } = fileChangeObservables(tree);

            const fileIds: string[] = [];
            const errorHandler = jest.fn();
            filesAdded.subscribe(files => {
                files.forEach(file => fileIds.push(file.id));
            }, errorHandler);

            await tree.tree.addEvents([
                fileAdded(createFile('abc', {})),
                fileAdded(
                    createFile('def', {
                        'aux.context': 'context',
                    })
                ),
                fileAdded(createFile('111', {})),
            ]);

            scheduler.flush();

            expect(fileIds).toEqual(['def', '111', 'abc']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send a diff for the current files', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            await stored.file('test');
            await stored.file('zdf');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();
            scheduler.flush();

            const fileIds: string[] = [];
            const { filesAdded } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            filesAdded.subscribe(files => {
                files.forEach(file => fileIds.push(file.id));
            }, errorHandler);

            expect(fileIds).toEqual(['test', 'zdf']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should handle multiple files with the same ID getting added', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const test1 = await stored.file('test');
            const test2 = await stored.file('test');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();
            scheduler.flush();

            const fileIds: string[] = [];
            const { filesAdded } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            filesAdded.subscribe(files => {
                files.forEach(file => fileIds.push(file.id));
            }, errorHandler);

            expect(fileIds).toEqual(['test']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should handle deleted files', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: file } = await stored.file('test');
            const { added: update } = await stored.tag('abc', file);
            const { added: deleted } = await stored.delete(file);

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();
            scheduler.flush();

            const fileIds: string[] = [];
            const updatedFiles: string[] = [];
            const { filesAdded, filesUpdated } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            filesAdded
                .pipe(
                    flatMap(files => files),
                    tap(file => fileIds.push(file.id))
                )
                .subscribe(null, errorHandler);
            filesUpdated
                .pipe(
                    flatMap(files => files),
                    tap(file => updatedFiles.push(file.file.id))
                )
                .subscribe(null, errorHandler);

            expect(fileIds).toEqual([]);
            expect(updatedFiles).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send file deleted events', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: file } = await stored.file('test');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            scheduler.flush();

            const fileIds: string[] = [];
            const updatedFiles: string[] = [];
            const removedFiles: string[] = [];
            const {
                filesAdded,
                filesUpdated,
                filesRemoved,
            } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            filesAdded
                .pipe(
                    flatMap(files => files),
                    tap(file => fileIds.push(file.id))
                )
                .subscribe(null, errorHandler);
            filesUpdated
                .pipe(
                    flatMap(files => files),
                    tap(file => updatedFiles.push(file.file.id))
                )
                .subscribe(null, errorHandler);
            filesRemoved
                .pipe(
                    flatMap(files => files),
                    tap(file => removedFiles.push(file))
                )
                .subscribe(null, errorHandler);

            const del = await tree.tree.delete(file);

            expect(fileIds).toEqual(['test']);
            expect(updatedFiles).toEqual([]);
            expect(removedFiles).toEqual(['test']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send file updated events', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: file } = await stored.file('test');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            scheduler.flush();

            const fileIds: string[] = [];
            const updatedFiles: UpdatedFile[] = [];
            const removedFiles: string[] = [];
            const {
                filesAdded,
                filesUpdated,
                filesRemoved,
            } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            filesAdded
                .pipe(
                    flatMap(files => files),
                    tap(file => fileIds.push(file.id))
                )
                .subscribe(null, errorHandler);
            filesUpdated
                .pipe(
                    flatMap(files => files),
                    tap(update => updatedFiles.push(update))
                )
                .subscribe(null, errorHandler);
            filesRemoved
                .pipe(
                    flatMap(files => files),
                    tap(file => removedFiles.push(file))
                )
                .subscribe(null, errorHandler);

            await tree.tree.updateFile(tree.tree.value['test'], {
                tags: {
                    abc: 'def',
                    ghi: 123,
                },
            });

            expect(fileIds).toEqual(['test']);
            expect(updatedFiles).toEqual([
                {
                    file: tree.tree.value['test'],
                    tags: ['abc', 'ghi'],
                },
            ]);
            expect(removedFiles).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should include tags set to null in updates', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: file } = await stored.file('test');
            const { added: tag } = await stored.tag('nullable', file);
            await stored.val('my value', tag);

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            scheduler.flush();

            const fileIds: string[] = [];
            const updatedFiles: UpdatedFile[] = [];
            const removedFiles: string[] = [];
            const {
                filesAdded,
                filesUpdated,
                filesRemoved,
            } = fileChangeObservables(tree);
            const errorHandler = jest.fn();
            filesAdded
                .pipe(
                    flatMap(files => files),
                    tap(file => fileIds.push(file.id))
                )
                .subscribe(null, errorHandler);
            filesUpdated
                .pipe(
                    flatMap(files => files),
                    tap(update => updatedFiles.push(update))
                )
                .subscribe(null, errorHandler);
            filesRemoved
                .pipe(
                    flatMap(files => files),
                    tap(file => removedFiles.push(file))
                )
                .subscribe(null, errorHandler);

            await tree.tree.updateFile(tree.tree.value['test'], {
                tags: {
                    abc: 'def',
                    ghi: 123,
                    nullable: null,
                },
            });

            expect(fileIds).toEqual(['test']);
            expect(updatedFiles).toEqual([
                {
                    file: tree.tree.value['test'],
                    tags: ['abc', 'ghi', 'nullable'],
                },
            ]);
            expect(removedFiles).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });
    });
});
