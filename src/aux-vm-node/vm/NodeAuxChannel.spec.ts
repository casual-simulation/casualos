import { NodeAuxChannel } from './NodeAuxChannel';
import { AuxCausalTree, GLOBALS_FILE_ID } from '@casual-simulation/aux-common';
import { storedTree, site, ADMIN_ROLE } from '@casual-simulation/causal-trees';

console.log = jest.fn();

describe('NodeAuxChannel', () => {
    let tree: AuxCausalTree;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();
    });

    function createChannel(id: string) {
        return new NodeAuxChannel(tree, {
            config: { isBuilder: false, isPlayer: false },
            host: 'any',
            id: id,
            treeName: id,
            // user: {
            //     channelId: null,
            //     id: 'server',
            //     isGuest: false,
            //     name: 'Server',
            //     token: 'token',
            //     username: 'server',
            // },
        });
    }

    it('should create the globals file with aux.whitelist.roles set to admin if the channel is the admin channel', async () => {
        const channel = createChannel('aux-admin');

        await channel.init(() => {}, () => {}, () => {}, () => {});

        const globals = channel.helper.filesState[GLOBALS_FILE_ID];
        expect(globals.tags['aux.whitelist.roles']).toEqual([ADMIN_ROLE]);
    });
});
