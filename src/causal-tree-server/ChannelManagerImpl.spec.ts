import { ChannelManager } from './ChannelManager';
import { ChannelManagerImpl } from './ChannelManagerImpl';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import {
    CausalTree,
    AtomOp,
    AtomReducer,
    storedTree,
    site,
    Weave,
    CausalTreeFactory,
} from '@casual-simulation/causal-trees';
import { TestCryptoImpl } from '@casual-simulation/crypto/test/TestCryptoImpl';
import { Subscription } from 'rxjs';

console.log = jest.fn();

describe('ChannelManager', () => {
    let manager: ChannelManager;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let crypto: TestCryptoImpl;
    let stored: Tree;

    beforeEach(async () => {
        store = new TestCausalTreeStore();
        factory = new CausalTreeFactory({
            number: (stored, options) =>
                new Tree(stored, new NumberReducer(), options),
        });
        crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
        crypto.valid = true;
        manager = new ChannelManagerImpl(store, factory, crypto);

        stored = new Tree(storedTree(site(1)), new NumberReducer());
        await stored.create(new Op(), null);
        store.put('test', stored.export());
    });

    describe('loadChannel()', () => {
        it('should load the given channel from the store', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            expect(channel.tree).toBeInstanceOf(Tree);
            expect(channel.tree.weave.atoms).toEqual(stored.weave.atoms);
        });

        it('should create a new tree if it is not in the store', async () => {
            const channel = await manager.loadChannel({
                id: 'notTest',
                type: 'number',
            });

            expect(channel.tree).toBeInstanceOf(Tree);
            expect(channel.tree.weave.atoms).not.toEqual([]);
            expect(channel.tree.weave.atoms).not.toEqual(stored.weave.atoms);
        });

        it('should throw an error if unable to add a root atom to the tree', async () => {
            crypto.valid = false;

            expect(
                manager.loadChannel({
                    id: 'notTest',
                    type: 'number',
                })
            ).rejects.toBeTruthy();
        });

        it('should reload the channel after disposing it', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            channel.subscription.unsubscribe();

            const channel2 = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            expect(channel2.tree).not.toBe(channel.tree);
        });
    });

    describe('whileCausalTreeLoaded()', () => {
        it('should unload the channel when the last subscription is disposed', async () => {
            const sub = new Subscription();
            manager.whileCausalTreeLoaded(() => [sub]);

            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            channel.subscription.unsubscribe();
            expect(sub.closed).toBe(true);
        });
    });
});

class Op implements AtomOp {
    type: number;
}

class Tree extends CausalTree<Op, number, any> {
    root() {
        return this.create(new Op(), null);
    }
}

class NumberReducer implements AtomReducer<Op, number, any> {
    eval(weave: Weave<Op>): [number, any] {
        return [0, null];
    }
}
