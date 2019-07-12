import { AuxUserAuthenticator } from './AuxUserAuthenticator';
import { LoadedChannel } from '@casual-simulation/causal-tree-server';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import {
    NodeSimulation,
    NodeAuxChannel,
    AuxLoadedChannel,
} from '@casual-simulation/aux-vm-node';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';
import { Subscription } from 'rxjs';
import { AuxUser } from '@casual-simulation/aux-vm';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();

describe('AuxUserAuthenticator', () => {
    let authenticator: AuxUserAuthenticator;
    let tree: AuxCausalTree;
    let channel: AuxLoadedChannel;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));

        await tree.root();
        await tree.addFile(createFile('firstFile'));

        const nodeChannel = new NodeAuxChannel(
            tree,
            {
                id: 'user',
                isGuest: false,
                name: 'name',
                token: 'token',
                username: 'username',
                channelId: 'channel',
            },
            {
                config: { isBuilder: false, isPlayer: false },
                host: 'any',
                id: 'test',
                treeName: 'test',
                // user: {
                //     channelId: null,
                //     id: 'server',
                //     isGuest: false,
                //     name: 'Server',
                //     token: 'token',
                //     username: 'server',
                // },
            }
        );

        await nodeChannel.init(() => {}, () => {}, () => {}, () => {});

        channel = {
            info: {
                id: 'test',
                type: 'aux',
            },
            subscription: new Subscription(),
            tree: tree,
            channel: nodeChannel,
        };

        authenticator = new AuxUserAuthenticator(channel);
    });

    it('should search the file state for a file with the given username', async () => {
        await tree.addFile(
            createFile('firstUser', {
                'aux.username': 'test',
                'aux.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('firstToken', {
                'aux.token.username': 'test',
                'aux.token': 'abcdef',
            })
        );

        const result = await authenticator.authenticate({
            username: 'test',
            token: 'abcdef',
        });

        expect(result.success).toBe(true);
        expect(result.info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
        });
    });

    it('should add a file for the first user and give them the admin role', async () => {
        uuidMock.mockReturnValueOnce('testUser').mockReturnValueOnce('test');
        const result = await authenticator.authenticate({
            username: 'test',
            token: 'abcdef',
        });

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.username': 'test',
                'aux.roles': [ADMIN_ROLE],
            },
        });

        expect(tree.value['test']).toMatchObject({
            id: 'test',
            tags: {
                'aux.tokens': true,
                'test.tokens': true,
                'aux.token.username': 'test',
                'aux.token': 'abcdef',
            },
        });

        expect(result.success).toBe(true);
        expect(result.info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
        });
    });

    it('should make a new user an admin if there are no admins', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.username': 'test',
                'aux.roles': [],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValueOnce('testUser').mockReturnValueOnce('test');
        const result = await authenticator.authenticate(<AuxUser>{
            username: 'otherAdmin',
            token: 'abcdef',
        });

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.username': 'otherAdmin',
                'aux.roles': [ADMIN_ROLE],
            },
        });

        expect(tree.value['test']).toMatchObject({
            id: 'test',
            tags: {
                'aux.tokens': true,
                'otherAdmin.tokens': true,
                'aux.token.username': 'otherAdmin',
                'aux.token': 'abcdef',
            },
        });

        expect(result.success).toBe(true);
        expect(result.info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'otherAdmin',
            },
            roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
        });
    });

    it('should not make a new user an admin are at least one admin', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.username': 'test',
                'aux.roles': ['admin'],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValueOnce('testUser').mockReturnValueOnce('test');
        const result = await authenticator.authenticate(<AuxUser>{
            username: 'otherAdmin',
            token: 'abcdef',
        });

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.username': 'otherAdmin',
                'aux.roles': [],
            },
        });

        expect(tree.value['test']).toMatchObject({
            id: 'test',
            tags: {
                'aux.tokens': true,
                'otherAdmin.tokens': true,
                'aux.token.username': 'otherAdmin',
                'aux.token': 'abcdef',
            },
        });

        expect(result.success).toBe(true);
        expect(result.info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'otherAdmin',
            },
            roles: [USER_ROLE],
        });
    });

    it('should not give the first user the admin role if they are a guest', async () => {
        uuidMock.mockReturnValueOnce('testUser').mockReturnValueOnce('test');
        const result = await authenticator.authenticate(<AuxUser>{
            username: 'test',
            token: 'abcdef',
            isGuest: true,
        });

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.username': 'test',
                'aux.roles': [],
            },
        });

        expect(tree.value['test']).toMatchObject({
            id: 'test',
            tags: {
                'aux.tokens': true,
                'test.tokens': true,
                'aux.token.username': 'test',
                'aux.token': 'abcdef',
            },
        });

        expect(result.success).toBe(true);
        expect(result.info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: [USER_ROLE],
        });
    });

    it('should add a token for the user if the grant matches another token', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.username': 'test',
                'aux.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValue('test');
        const result = await authenticator.authenticate({
            username: 'test',
            token: 'other',
            grant: 'abc',
        });

        expect(tree.value['test']).toMatchObject({
            id: 'test',
            tags: {
                'aux.tokens': true,
                'test.tokens': true,
                'aux.token.username': 'test',
                'aux.token': 'other',
            },
        });

        expect(result.success).toBe(true);
        expect(result.info).toEqual({
            claims: {
                [USERNAME_CLAIM]: 'test',
            },
            roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
        });
    });

    it('should throw if the username matches but the token does not', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.username': 'test',
                'aux.roles': [],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abcdef',
            })
        );

        const result = await authenticator.authenticate({
            username: 'test',
            token: 'doesNotMatch',
        });

        expect(result).toEqual({
            success: false,
            error: 'wrong_token',
        });
    });

    it('should reject if the grant is wrong', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.username': 'test',
                'aux.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        const result = await authenticator.authenticate({
            username: 'test',
            token: 'other',
            grant: 'wrong',
        });

        expect(result).toEqual({
            success: false,
            error: 'wrong_grant',
        });
    });

    it('should reject devices which dont have a token', async () => {
        const result = await authenticator.authenticate({
            username: 'test',
            token: null,
        });

        expect(result).toEqual({
            success: false,
            error: 'invalid_token',
        });
    });

    it('should reject devices which dont have a username', async () => {
        const result = await authenticator.authenticate({
            username: null,
            token: 'abc',
        });

        expect(result).toEqual({
            success: false,
            error: 'invalid_username',
        });
    });
});
