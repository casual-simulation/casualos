import { AuxVMNode } from './AuxVMNode';
import { AuxCausalTree, GLOBALS_FILE_ID } from '@casual-simulation/aux-common';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from './NodeAuxChannel';

console.log = jest.fn();

describe('AuxVMNode', () => {
    let tree: AuxCausalTree;
    let config: AuxConfig;
    let user: AuxUser;
    let vm: AuxVMNode;
    let channel: NodeAuxChannel;
    beforeEach(async () => {
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            host: 'test',
            id: 'id',
            treeName: 'treeName',
        };
        user = {
            id: 'server',
            isGuest: false,
            name: 'Server',
            token: 'token',
            username: 'server',
        };
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        channel = new NodeAuxChannel(tree, user, config);
        vm = new AuxVMNode(channel);
    });

    it('initialize the channel', async () => {
        await vm.init();

        const globals = tree.value[GLOBALS_FILE_ID];
        expect(globals).toBeTruthy();
    });
});
