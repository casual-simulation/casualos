import { RealtimeCausalTree } from './RealtimeCausalTree';
import { AtomOp } from './Atom';
import { CausalTreeStore } from './CausalTreeStore';
import { CausalTreeFactory } from './CausalTreeFactory';
import { RealtimeChannel } from './RealtimeChannel';
import { TestCausalTreeStore } from './test/TestCausalTreeStore';
import { CausalTree } from './CausalTree';
import { AtomReducer } from './AtomReducer';
import { Weave, WeaveReference } from './Weave';
import { TestChannelConnection } from './test/TestChannelConnection';
import { site } from './SiteIdInfo';

interface Op extends AtomOp {

}

class Tree extends CausalTree<Op, number> {

}

class NumberReducer implements AtomReducer<Op, number> {
    eval(weave: Weave<Op>): number {
        return 0;
    }
}

describe('RealtimeCausalTree', () => {
    let tree: RealtimeCausalTree<Op, number>;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let channel: RealtimeChannel<WeaveReference<Op>>;
    let connection: TestChannelConnection;
    
    beforeEach(() => {
        store = new TestCausalTreeStore();
        factory = new CausalTreeFactory({
            'numbers': (tree) => new Tree(tree, new NumberReducer())
        });
        connection = new TestChannelConnection();
        channel = new RealtimeChannel<WeaveReference<Op>>({
            id: 'abc',
            type: 'numbers'
        }, connection);
        tree = new RealtimeCausalTree<Op,number>(factory, store, channel);
    });

    describe('init()', () => {
        it('should have a null tree by default', async () => {
            await tree.init();

            expect(tree.tree).toBe(null);
        });

        it('should load the tree from the store', async () => {
            
            await store.update('abc', {
                site: site(2),
                knownSites: null,
                weave: null
            });

            await tree.init();

            expect(tree.tree).not.toBe(null);
        });
    })

});