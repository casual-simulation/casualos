import { AuxUserAuthenticator } from './AuxUserAuthenticator';
import {
    LoadedChannel,
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
} from '@casual-simulation/causal-tree-server';
import { NodeSimulation } from '@casual-simulation/aux-vm-node';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();

describe('AuxUserAuthenticator', () => {
    let authenticator: AuxUserAuthenticator;
    let tree: AuxCausalTree;
    let simulation: NodeSimulation;
    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();
        await tree.addFile(createFile('firstFile'));

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
            'aux.roles': [ADMIN_ROLE],
        });

        const info = await authenticator.authenticate({
            username: 'test',
            token: 'abcdef',
        });

        expect(info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
        });
    });

    it('should add a file for the first user and give them the admin role', async () => {
        uuidMock.mockReturnValue('test');
        const info = await authenticator.authenticate({
            username: 'test',
            token: 'abcdef',
        });

        expect(simulation.helper.filesState['test']).toEqual({
            id: 'test',
            precalculated: true,
            tags: {
                'aux.users': true,
                'aux.username': 'test',
                'aux.token': 'abcdef',
                'aux.roles': [ADMIN_ROLE],
            },
            values: {
                'aux.users': true,
                'aux.username': 'test',
                'aux.token': 'abcdef',
                'aux.roles': [ADMIN_ROLE],
            },
        });

        expect(info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
        });
    });

    it('should return null if the username matches but the token does not', async () => {
        await simulation.helper.createFile(undefined, {
            'aux.username': 'test',
            'aux.token': 'abcdef',
            'aux.roles': [ADMIN_ROLE],
        });

        const info = await authenticator.authenticate({
            username: 'test',
            token: 'doesNotMatch',
        });

        expect(info).toBe(null);
    });
});
