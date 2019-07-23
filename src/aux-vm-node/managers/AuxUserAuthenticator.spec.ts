import { AuxUserAuthenticator } from './AuxUserAuthenticator';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxLoadedChannel } from './AuxChannelManager';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { storedTree, site } from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';
import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuxUser } from '@casual-simulation/aux-vm';
import { AuthenticationResult } from '@casual-simulation/causal-tree-server';
import { NodeSimulation } from './NodeSimulation';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();

describe('AuxUserAuthenticator', () => {
    let authenticator: AuxUserAuthenticator;
    let tree: AuxCausalTree;
    let channel: AuxLoadedChannel;
    let sim: NodeSimulation;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));

        await tree.root();
        await tree.addFile(createFile('firstFile'));

        const config = { isBuilder: false, isPlayer: false };
        const nodeChannel = new NodeAuxChannel(
            tree,
            {
                id: 'user',
                isGuest: false,
                name: 'name',
                token: 'token',
                username: 'username',
            },
            {
                config: config,
                host: 'any',
                id: 'test',
                treeName: 'test',
            }
        );

        sim = new NodeSimulation(nodeChannel, 'test', config);

        await sim.init();

        channel = {
            info: {
                id: 'test',
                type: 'aux',
            },
            subscription: new Subscription(),
            tree: tree,
            channel: nodeChannel,
            simulation: sim,
        };

        authenticator = new AuxUserAuthenticator(channel);
    });

    it('should search the file state for a file with the given username', async () => {
        await tree.addFile(
            createFile('firstUser', {
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('firstToken', {
                'aux.token.username': 'test',
                'aux.token': 'abcdef',
            })
        );

        const result = await authenticator
            .authenticate({
                username: 'test',
                token: 'abcdef',
            })
            .pipe(first())
            .toPromise();

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
        const result = await authenticator
            .authenticate({
                username: 'test',
                token: 'abcdef',
            })
            .pipe(first())
            .toPromise();

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
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
                'aux.account.username': 'test',
                'aux.account.roles': [],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValueOnce('testUser').mockReturnValueOnce('test');
        const result = await authenticator
            .authenticate(<AuxUser>{
                username: 'otherAdmin',
                token: 'abcdef',
            })
            .pipe(first())
            .toPromise();

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.account.username': 'otherAdmin',
                'aux.account.roles': [ADMIN_ROLE],
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
                'aux.account.username': 'test',
                'aux.account.roles': ['admin'],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValueOnce('testUser').mockReturnValueOnce('test');
        const result = await authenticator
            .authenticate(<AuxUser>{
                username: 'otherAdmin',
                token: 'abcdef',
            })
            .pipe(first())
            .toPromise();

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.account.username': 'otherAdmin',
                'aux.account.roles': [],
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
        const result = await authenticator
            .authenticate(<AuxUser>{
                username: 'test',
                token: 'abcdef',
                isGuest: true,
            })
            .pipe(first())
            .toPromise();

        expect(tree.value['testUser']).toMatchObject({
            id: 'testUser',
            tags: {
                'aux.users': true,
                'aux.account.username': 'test',
                'aux.account.roles': [],
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
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValue('test');
        const result = await authenticator
            .authenticate({
                username: 'test',
                token: 'other',
                grant: 'abc',
            })
            .pipe(first())
            .toPromise();

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
                'aux.account.username': 'test',
                'aux.account.roles': [],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abcdef',
            })
        );

        const result = await authenticator
            .authenticate({
                username: 'test',
                token: 'doesNotMatch',
            })
            .pipe(first())
            .toPromise();

        expect(result).toEqual({
            success: false,
            error: 'wrong_token',
        });
    });

    it('should reject if the grant is wrong', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        const result = await authenticator
            .authenticate({
                username: 'test',
                token: 'other',
                grant: 'wrong',
            })
            .pipe(first())
            .toPromise();

        expect(result).toEqual({
            success: false,
            error: 'wrong_grant',
        });
    });

    it('should reject if the user is locked', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
                'aux.locked': true,
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        const result = await authenticator
            .authenticate({
                username: 'test',
                token: 'other',
                grant: 'wrong',
            })
            .pipe(first())
            .toPromise();

        expect(result).toEqual({
            success: false,
            error: 'account_locked',
        });
    });

    it('should reject when given null', async () => {
        const result = await authenticator
            .authenticate(null)
            .pipe(first())
            .toPromise();

        expect(result).toEqual({
            success: false,
            error: 'invalid_token',
        });
    });

    it('should reject devices which dont have a token', async () => {
        const result = await authenticator
            .authenticate({
                username: 'test',
                token: null,
            })
            .pipe(first())
            .toPromise();

        expect(result).toEqual({
            success: false,
            error: 'invalid_token',
        });
    });

    it('should reject devices which dont have a username', async () => {
        const result = await authenticator
            .authenticate({
                username: null,
                token: 'abc',
            })
            .pipe(first())
            .toPromise();

        expect(result).toEqual({
            success: false,
            error: 'invalid_username',
        });
    });

    it('should update when a token is updated', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValue('test');
        const results: AuthenticationResult[] = [];
        authenticator
            .authenticate({
                username: 'test',
                token: 'abc',
            })
            .subscribe(r => results.push(r));

        await tree.updateFile(tree.value['tokenFile'], {
            tags: {
                'aux.token': 'other',
            },
        });

        await tree.addFile(
            createFile('tokenFile2', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        expect(results).toEqual([
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
                },
            },
            {
                success: false,
                error: 'wrong_token',
            },
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
                },
            },
        ]);
    });

    it('should update when a users roles are updated', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        uuidMock.mockReturnValue('test');
        const results: AuthenticationResult[] = [];
        authenticator
            .authenticate({
                username: 'test',
                token: 'abc',
            })
            .subscribe(r => results.push(r));

        await tree.updateFile(tree.value['userFile'], {
            tags: {
                'aux.account.roles': [ADMIN_ROLE, 'other'],
            },
        });

        expect(results).toEqual([
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([USER_ROLE, ADMIN_ROLE]),
                },
            },
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([
                        USER_ROLE,
                        ADMIN_ROLE,
                        'other',
                    ]),
                },
            },
        ]);
    });

    it('should update if a users account becomes locked', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.account.username': 'test',
                'aux.account.roles': [ADMIN_ROLE],
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        let results: AuthenticationResult[] = [];
        authenticator
            .authenticate({
                username: 'test',
                token: 'abc',
            })
            .subscribe(r => results.push(r));

        await tree.updateFile(tree.value['userFile'], {
            tags: {
                'aux.locked': true,
            },
        });

        expect(results).toEqual([
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([ADMIN_ROLE, USER_ROLE]),
                },
            },
            {
                success: false,
                error: 'account_locked',
            },
        ]);
    });

    it('should react to formulas', async () => {
        await tree.addFile(
            createFile('userFile', {
                'aux.account.username': 'test',
                'aux.account.roles': <any>(
                    '=getTag(this, "isAdmin") ? "admin" : ""'
                ),
                isAdmin: false,
            })
        );

        await tree.addFile(
            createFile('tokenFile', {
                'aux.token.username': 'test',
                'aux.token': 'abc',
            })
        );

        let results: AuthenticationResult[] = [];
        authenticator
            .authenticate({
                username: 'test',
                token: 'abc',
            })
            .subscribe(r => results.push(r));

        await tree.updateFile(tree.value['userFile'], {
            tags: {
                isAdmin: true,
            },
        });

        expect(results).toEqual([
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([USER_ROLE]),
                },
            },
            {
                success: true,
                info: {
                    claims: {
                        [USERNAME_CLAIM]: 'test',
                    },
                    roles: expect.arrayContaining([ADMIN_ROLE, USER_ROLE]),
                },
            },
        ]);
    });
});
