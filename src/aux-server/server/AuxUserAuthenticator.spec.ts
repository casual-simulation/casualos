import { AuxUserAuthenticator } from './AuxUserAuthenticator';
import {
    LoadedChannel,
    USERNAME_CLAIM,
} from '@casual-simulation/causal-tree-server';
import { NodeSimulation } from '@casual-simulation/aux-vm-node';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';

describe('AuxUserAuthenticator', () => {
    let authenticator: AuxUserAuthenticator;
    let tree: AuxCausalTree;
    let simulation: NodeSimulation;
    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        simulation = new NodeSimulation(
            {
                username: 'server',
                channelId: 'server',
                email: 'blah',
                id: 'serverId',
                isGuest: false,
                name: 'Server',
                token: 'token',
            },
            'aux-server',
            {
                isBuilder: false,
                isPlayer: false,
            },
            tree
        );

        await simulation.init();

        authenticator = new AuxUserAuthenticator(simulation);
    });

    it('should search the file state for a file with the given username', async () => {
        await simulation.helper.createFile(undefined, {
            'aux.username': 'test',
            'aux.token': 'abcdef',
            'aux.roles': ['admin'],
        });

        const info = await authenticator.authenticate({
            username: 'test',
            token: 'abcdef',
        });

        expect(info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: ['admin'],
        });
    });
});
