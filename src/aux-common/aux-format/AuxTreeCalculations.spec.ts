import { FilesState } from "../Files";
import { RealtimeCausalTree, RealtimeChannel, WeaveReference, AtomOp, storedTree, site } from "../causal-trees";
import { auxCausalTreeFactory } from "./AuxCausalTreeFactory";
import { TestCausalTreeStore } from "../causal-trees/test/TestCausalTreeStore";
import { TestChannelConnection } from "../causal-trees/test/TestChannelConnection";
import { fileChangeObservables } from "./AuxTreeCalculations";
import { AuxCausalTree } from "./AuxCausalTree";
import { TestScheduler } from 'rxjs/testing';
import { AsyncScheduler } from "rxjs/internal/scheduler/AsyncScheduler";

describe('AuxTreeCalculations', () => {
     
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
            
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<WeaveReference<AtomOp>>({
                id: 'test',
                type: 'aux'
            }, connection);
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);
            
            let stored = new AuxCausalTree(storedTree(site(1)));
            stored.root();
            
            await store.update('test', stored.export());
            await tree.init();
            await connection.flushPromises();
            
            const { fileAdded } = fileChangeObservables(tree);
            
            const fileIds: string[] = [];
            
            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            });

            tree.tree.file('abc', 'object');
            tree.tree.file('def', 'object');

            scheduler.flush();

            expect(fileIds).toEqual([
                'abc',
                'def'
            ]);
        });

        it('should send a diff for the current files', async () => {
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<WeaveReference<AtomOp>>({
                id: 'test',
                type: 'aux'
            }, connection); 
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);

            let stored = new AuxCausalTree(storedTree(site(1)));
            stored.root();
            stored.file('test', 'object');
            stored.file('zdf', 'object');

            await store.update('test', stored.export());
            await tree.init();
            await connection.flushPromises();

            const { fileAdded } = fileChangeObservables(tree);

            const fileIds: string[] = [];

            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            });

            scheduler.flush();

            expect(fileIds).toEqual([
                'test',
                'zdf'
            ]);
        });
    });
});