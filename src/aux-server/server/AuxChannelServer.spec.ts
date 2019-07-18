import {
    auxCausalTreeFactory,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import {
    AuxChannelManagerImpl,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';
import {
    storedTree,
    site,
    CausalTreeFactory,
} from '@casual-simulation/causal-trees';
import { AuxUser } from '@casual-simulation/aux-vm';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { TestCryptoImpl } from '@casual-simulation/crypto/test/TestCryptoImpl';
import { AuxChannelServer } from './AuxChannelServer';
import {
    DeviceManager,
    DeviceManagerImpl,
} from '@casual-simulation/causal-tree-server';

describe('AuxChannelServer', () => {
    let subject: AuxChannelServer;
    let deviceManager: DeviceManager;
    let channelManager: AuxChannelManager;
    let user: AuxUser;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let crypto: TestCryptoImpl;
    let stored: AuxCausalTree;

    beforeEach(async () => {
        user = {
            id: 'userId',
            name: 'Server',
            username: 'server',
            token: 'token',
            isGuest: false,
        };
        store = new TestCausalTreeStore();
        factory = auxCausalTreeFactory();
        crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
        crypto.valid = true;
        deviceManager = new DeviceManagerImpl();
        channelManager = new AuxChannelManagerImpl(
            user,
            store,
            factory,
            crypto
        );
        subject = new AuxChannelServer(deviceManager, channelManager);

        stored = new AuxCausalTree(storedTree(site(1)));
        await stored.root();
        store.put('test', stored.export());
    });
});
