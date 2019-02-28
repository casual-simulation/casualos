import { FilesState } from "../Files";
import { RealtimeCausalTree, RealtimeChannel, WeaveReference, AtomOp, storedTree, site } from "../causal-trees";
import { auxCausalTreeFactory } from "./AuxCausalTreeFactory";
import { TestCausalTreeStore } from "../causal-trees/test/TestCausalTreeStore";
import { TestChannelConnection } from "../causal-trees/test/TestChannelConnection";
import { fileChangeObservables } from "./AuxTreeCalculations";
import { AuxCausalTree } from "./AuxCausalTree";

describe('AuxTreeCalculations', () => {
     
    describe('fileChangeObservables()', () => {
        it('should sort added files so workspaces are first', async () => {
            const factory = auxCausalTreeFactory();
            const store = new TestCausalTreeStore();
            const connection = new TestChannelConnection();
            const channel = new RealtimeChannel<WeaveReference<AtomOp>>({
                id: 'test',
                type: 'aux'
            }, connection);
            const tree = new RealtimeCausalTree<AuxCausalTree>(factory, store, channel);

            const { fileAdded } = fileChangeObservables(tree);

            const fileIds: string[] = [];

            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            });

            let stored = new AuxCausalTree(storedTree(site(1)));
            stored.root();
            stored.file('test', 'object');
            stored.file('zdf', 'object');

            await store.update('test', stored.export());

            await tree.init();
            await connection.flushPromises();

            tree.tree.root();
            tree.tree.file('test', 'object');
            tree.tree.file('zdf', 'object');

            expect(fileIds).toEqual([
                'zdf',
                'test'
            ]);
        });
    });
});