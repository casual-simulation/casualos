import {
    CausalTreeFactory,
    storedTree,
    site,
} from '@casual-simulation/causal-trees';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { TestCryptoImpl } from '@casual-simulation/crypto/test/TestCryptoImpl';
import { AuxChannelManager } from './AuxChannelManager';
import { AuxChannelManagerImpl } from './AuxChannelManagerImpl';
import { AuxUser } from '@casual-simulation/aux-vm/AuxUser';
import {
    auxCausalTreeFactory,
    AuxCausalTree,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';

console.log = jest.fn();

describe('AuxChannelManager', () => {
    let manager: AuxChannelManager;
    let user: AuxUser;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let crypto: TestCryptoImpl;
    let stored: AuxCausalTree;

    beforeEach(async () => {
        user = {
            id: 'userId',
            name: 'Server',
            channelId: 'channelId',
            username: 'server',
            token: 'token',
            isGuest: false,
        };
        store = new TestCausalTreeStore();
        factory = auxCausalTreeFactory();
        crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
        crypto.valid = true;
        manager = new AuxChannelManagerImpl(user, store, factory, crypto);

        stored = new AuxCausalTree(storedTree(site(1)));
        await stored.root();
        store.put('test', stored.export());
    });

    it('should return a NodeAuxChannel', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const returned = await manager.loadChannel(info);

        expect(returned).toMatchObject({
            info: info,
            tree: expect.any(AuxCausalTree),
            channel: expect.any(NodeAuxChannel),
        });
    });

    it('should initialize the NodeAuxChannel and wait for complete initialization', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const returned = await manager.loadChannel(info);

        // The NodeAuxChannel should create the globals file
        // during initialization
        const globals = returned.tree.value[GLOBALS_FILE_ID];
        expect(globals).toBeTruthy();
    });
});
