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
import { Subscription } from 'rxjs';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();

describe('AuxUserAuthenticator', () => {
    let authenticator: AuxUserAuthenticator;
    let tree: AuxCausalTree;
    let channel: LoadedChannel;
    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();
        await tree.addFile(createFile('firstFile'));

        channel = {
            info: {
                id: 'test',
                type: 'aux',
            },
            subscription: new Subscription(),
            tree: tree,
        };

        authenticator = new AuxUserAuthenticator(channel);
    });

    it('should search the file state for a file with the given username', async () => {
        await tree.addFile(
            createFile(undefined, {
                'aux.username': 'test',
                'aux.token': 'abcdef',
                'aux.roles': [ADMIN_ROLE],
            })
        );

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

        expect(tree.value['test']).toMatchObject({
            id: 'test',
            tags: {
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
        await tree.addFile(
            createFile(undefined, {
                'aux.username': 'test',
                'aux.token': 'abcdef',
                'aux.roles': [ADMIN_ROLE],
            })
        );

        const info = await authenticator.authenticate({
            username: 'test',
            token: 'doesNotMatch',
        });

        expect(info).toBe(null);
    });
});
