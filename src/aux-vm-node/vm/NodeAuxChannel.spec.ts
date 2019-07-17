import { NodeAuxChannel } from './NodeAuxChannel';
import { AuxCausalTree, GLOBALS_FILE_ID } from '@casual-simulation/aux-common';
import { storedTree, site, ADMIN_ROLE } from '@casual-simulation/causal-trees';
import { first } from 'rxjs/operators';

console.log = jest.fn();

describe('NodeAuxChannel', () => {
    let tree: AuxCausalTree;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();
    });

    function createChannel(id: string) {
        return new NodeAuxChannel(
            tree,
            {
                id: 'server',
                isGuest: false,
                name: 'Server',
                token: 'token',
                username: 'server',
            },
            {
                config: { isBuilder: false, isPlayer: false },
                host: 'any',
                id: id,
                treeName: id,
            }
        );
    }

    it('should create the globals file with aux.whitelist.roles set to admin if the channel is the admin channel', async () => {
        const channel = createChannel('aux-admin');

        await channel.initAndWait();

        const globals = channel.helper.filesState[GLOBALS_FILE_ID];
        expect(globals.tags['aux.whitelist.roles']).toEqual([ADMIN_ROLE]);
    });
});
