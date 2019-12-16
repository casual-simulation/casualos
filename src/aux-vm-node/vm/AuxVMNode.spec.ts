import { AuxVMNode } from './AuxVMNode';
import { AuxCausalTree, GLOBALS_BOT_ID } from '@casual-simulation/aux-common';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import {
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from './NodeAuxChannel';

console.log = jest.fn();

describe('AuxVMNode', () => {
    let tree: AuxCausalTree;
    let config: AuxConfig;
    let user: AuxUser;
    let device: DeviceInfo;
    let vm: AuxVMNode;
    let channel: NodeAuxChannel;
    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            partitions: {
                shared: {
                    type: 'causal_tree',
                    tree: tree,
                    id: 'id',
                },
            },
        };
        user = {
            id: 'server',
            isGuest: false,
            name: 'Server',
            token: 'token',
            username: 'server',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'server',
                [DEVICE_ID_CLAIM]: 'serverDeviceId',
                [SESSION_ID_CLAIM]: 'serverSessionId',
            },
            roles: [SERVER_ROLE],
        };

        channel = new NodeAuxChannel(tree, user, device, config);
        vm = new AuxVMNode(channel);
    });

    it('initialize the channel', async () => {
        await vm.init();

        const globals = tree.value[GLOBALS_BOT_ID];
        expect(globals).toBeTruthy();
    });
});
