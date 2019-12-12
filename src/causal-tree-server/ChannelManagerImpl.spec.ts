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
    RealtimeChannelInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    atom,
    atomId,
    StoredCausalTree,
    AtomBatch,
} from '@casual-simulation/causal-trees';
import { TestCryptoImpl } from '@casual-simulation/crypto/test/TestCryptoImpl';
import { Subscription, Subject } from 'rxjs';

console.log = jest.fn();
console.warn = jest.fn();

jest.useFakeTimers();

class BrokenTree extends CausalTree<AtomOp, any, any> {
    async import(tree: StoredCausalTree<AtomOp>): Promise<AtomBatch<AtomOp>> {
        throw new Error('This tree is broken');
    }
}

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
            broken: (stored, options) =>
                new BrokenTree(stored, new NumberReducer(), options),
        });
        crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
        crypto.valid = true;
        manager = new ChannelManagerImpl(store, factory, crypto);

        stored = new Tree(storedTree(site(1)), new NumberReducer());
        await stored.create(new Op(), null);
        store.put('test', stored.export());

        stored = new Tree(storedTree(site(1)), new NumberReducer());
        await stored.create(new Op(), null);
        store.put('test02', stored.export());

        store.put(
            'broken',
            storedTree(
                site(1),
                [site(1)],
                [
                    atom(atomId(1, 1), null, new Op()),
                    atom(atomId(1, 2), atomId(1, 1), new Op()),
                    atom(atomId(2, 3), atomId(2, 1), new Op()),
                ]
            )
        );
    });

    describe('hasChannel()', () => {
        it('should determine if the store has the given channel', async () => {
            let exists = await manager.hasChannel({
                id: 'test',
                type: 'number',
            });

            expect(exists).toBe(true);

            exists = await manager.hasChannel({
                id: 'not-exists',
                type: 'number',
            });

            expect(exists).toBe(false);
        });
    });

    describe('loadChannel()', () => {
        it('should load the given channel from the store', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            expect(channel.tree).toBeInstanceOf(Tree);
            expect(channel.events).toBeInstanceOf(Subject);
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

            expect.assertions(1);
            try {
                await manager.loadChannel({
                    id: 'notTest',
                    type: 'number',
                });
            } catch (ex) {
                expect(ex).toBeTruthy();
            }
        });

        it('should throw an error if unable load the tree', async () => {
            expect.assertions(1);
            try {
                await manager.loadChannel({
                    id: 'broken',
                    type: 'broken',
                });
            } catch (ex) {
                expect(ex).toBeTruthy();
            }
        });

        it('should reload the channel after disposing it', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            channel.subscription.unsubscribe();

            jest.runOnlyPendingTimers();

            const channel2 = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            expect(channel2.tree).not.toBe(channel.tree);
        });

        it('should not create a new tree if automaticallyCreateTrees is set to false', async () => {
            manager.automaticallyCreateTrees = false;

            const channel = await manager.loadChannel({
                id: 'notTest',
                type: 'number',
            });

            expect(channel).toBe(null);
        });

        it('should be able to load an existing tree if automaticallyCreateTrees is set to false', async () => {
            manager.automaticallyCreateTrees = false;

            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            expect(channel.tree).toBeInstanceOf(Tree);
            expect(channel.events).toBeInstanceOf(Subject);
            expect(channel.tree.weave.atoms).toEqual(stored.weave.atoms);
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

            jest.runOnlyPendingTimers();
            expect(sub.closed).toBe(true);
        });

        it('should be called once when there are multiple loads of the same channel', async () => {
            let count = 0;
            manager.whileCausalTreeLoaded(() => {
                count += 1;
                return [];
            });

            await manager.loadChannel({
                id: 'test',
                type: 'number',
            });
            await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            expect(count).toBe(1);
        });

        it('should be called once for each already loaded causal tree', async () => {
            let channels: RealtimeChannelInfo[] = [];

            await manager.loadChannel({
                id: 'test',
                type: 'number',
            });
            await manager.loadChannel({
                id: 'test',
                type: 'number',
            });
            await manager.loadChannel({
                id: 'test02',
                type: 'number',
            });

            manager.whileCausalTreeLoaded((tree, info) => {
                channels.push(info);
                return [];
            });

            expect(channels).toEqual([
                {
                    id: 'test',
                    type: 'number',
                },
                {
                    id: 'test02',
                    type: 'number',
                },
            ]);
        });
    });

    describe('updateVersionInfo()', () => {
        it('should add the known sites from the given version', async () => {
            const info: RealtimeChannelInfo = {
                id: 'test',
                type: 'number',
            };
            const channel = await manager.loadChannel(info);

            stored.registerSite(site(100));
            stored.registerSite(site(200));

            const result = await manager.updateVersionInfo(
                channel,
                stored.getVersion()
            );

            expect(result.knownSites).toEqual([
                stored.site,
                site(100),
                site(200),
            ]);
        });

        it('should update the stored tree in the causal tree store', async () => {
            const info: RealtimeChannelInfo = {
                id: 'test',
                type: 'number',
            };
            const channel = await manager.loadChannel(info);

            stored.registerSite(site(100));
            stored.registerSite(site(200));

            const result = await manager.updateVersionInfo(
                channel,
                stored.getVersion()
            );

            const updated = await store.get('test');

            expect(updated.knownSites).toEqual([
                stored.site,
                site(100),
                site(200),
            ]);
        });
    });

    describe('addAtoms()', () => {
        it('should add the given atoms to the tree', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            const { added: added1 } = await stored.create(
                new Op(),
                stored.weave.atoms[0]
            );
            const { added: added2 } = await stored.create(
                new Op(),
                stored.weave.atoms[0]
            );

            await manager.addAtoms(channel, [added1, added2]);

            expect(channel.tree.weave.atoms).toEqual(stored.weave.atoms);
        });
    });

    describe('requestSiteId()', () => {
        it('should approve the request if it is not used', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            const approved = await manager.requestSiteId(channel, site(2));

            expect(approved).toBe(true);
        });
    });

    describe('exchangeWeaves()', () => {
        it('should import the atoms from the other tree', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            const { added: added1 } = await stored.create(
                new Op(),
                stored.weave.atoms[0]
            );
            const { added: added2 } = await stored.create(
                new Op(),
                stored.weave.atoms[0]
            );

            const combined = await manager.exchangeWeaves(
                channel,
                stored.export()
            );

            expect(combined.weave).toEqual(stored.weave.atoms);
            expect(channel.tree.weave.atoms).toEqual(stored.weave.atoms);
        });

        it('should add the imported atoms to the store', async () => {
            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            const { added: added1 } = await stored.create(
                new Op(),
                stored.weave.atoms[0]
            );
            const { added: added2 } = await stored.create(
                new Op(),
                stored.weave.atoms[0]
            );

            const combined = await manager.exchangeWeaves(
                channel,
                stored.export()
            );

            const updated = await store.get('test');

            expect(updated.weave).toEqual([
                stored.weave.atoms[0],
                added2,
                added1,
            ]);
        });
    });

    describe('connect()', () => {
        it('should return a subscription that keeps the channel open until it is disposed', async () => {
            let loaded: boolean;
            manager.whileCausalTreeLoaded(() => {
                loaded = true;
                return [
                    new Subscription(() => {
                        loaded = false;
                    }),
                ];
            });

            const channel = await manager.loadChannel({
                id: 'test',
                type: 'number',
            });

            const sub = await manager.connect(channel, {
                claims: {
                    [USERNAME_CLAIM]: 'username',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            });

            channel.subscription.unsubscribe();
            jest.runOnlyPendingTimers();

            expect(loaded).toBe(true);

            sub.unsubscribe();
            jest.runOnlyPendingTimers();

            expect(loaded).toBe(false);
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
        for (let a of weave.atoms) {
            weave.referenceChain(a);
        }

        return [0, null];
    }
}
