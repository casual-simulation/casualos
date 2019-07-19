import {
    DeviceAuthenticator,
    LoadedChannel,
    AuthenticationResult,
} from '@casual-simulation/causal-tree-server';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
    DeviceToken,
} from '@casual-simulation/causal-trees';
import { AuxLoadedChannel } from './AuxChannelManager';
import {
    calculateFileValue,
    getFileUsernameList,
    FileCalculationContext,
    PrecalculatedFile,
    File,
    createFile,
    filesInContext,
    getActiveObjects,
    createCalculationContext,
    AuxCausalTree,
    getUserAccountFile,
    getTokensForUserAccount,
    findMatchingToken,
    getFileRoles,
} from '@casual-simulation/aux-common';

/**
 * Defines an authenticator that determines if a user is authenticated based on files in a simulation.
 */
export class AuxUserAuthenticator implements DeviceAuthenticator {
    private _sim: AuxLoadedChannel;
    private _tree: AuxCausalTree;

    /**
     * Creates a new AuxUserAuthenticator for the given channel.
     * @param adminChannel The channel that users should be looked up in.
     */
    constructor(adminChannel: AuxLoadedChannel) {
        this._sim = adminChannel;
        this._tree = adminChannel.tree;
    }

    async authenticate(token: DeviceToken): Promise<AuthenticationResult> {
        if (!token.token) {
            return {
                success: false,
                error: 'invalid_token',
            };
        }

        if (!token.username) {
            return {
                success: false,
                error: 'invalid_username',
            };
        }

        const objects = getActiveObjects(this._sim.tree.value);
        const context = this._sim.channel.helper.createContext();
        const users = objects.filter(o =>
            calculateFileValue(context, o, 'aux.username')
        );
        let userFile = getUserAccountFile(context, token.username);
        const tokensForUsername = getTokensForUserAccount(
            context,
            token.username
        );
        let tokenFile = findMatchingToken(
            context,
            tokensForUsername,
            token.token
        );

        if (!userFile) {
            const admins = users.filter(o => {
                const roles = getFileRoles(context, o);
                return roles.has(ADMIN_ROLE);
            });
            userFile = await this._createUserFile(
                token.username,
                admins.length === 0 && !token.isGuest
            );
        }

        if (tokenFile) {
        } else if (tokensForUsername.length === 0) {
            tokenFile = await this._createTokenFile(token);
        } else if (token.grant) {
            console.log('[AuxUserAuthenticator] Checking grant...');

            const grantFile = findMatchingToken(
                context,
                tokensForUsername,
                token.grant
            );

            if (grantFile) {
                console.log('[AuxUserAuthenticator] Grant valid!');
                tokenFile = await this._createTokenFile(token);
            } else {
                console.log('[AuxUserAuthenticator] Grant invalid');
                return {
                    success: false,
                    error: 'wrong_grant',
                };
            }
        }

        if (tokenFile) {
            const roles = getFileRoles(context, userFile);
            const username = calculateFileValue(
                context,
                tokenFile,
                'aux.token.username'
            );

            roles.add(USER_ROLE);

            const info = {
                claims: {
                    [USERNAME_CLAIM]: username,
                },
                roles: [...roles],
            };

            return {
                success: true,
                info: info,
            };
        }

        return {
            success: false,
            error: 'wrong_token',
        };
    }

    private async _createTokenFile(token: DeviceToken): Promise<File> {
        console.log('[AuxUserAuthenticator] Creating token for user...');
        const file = createFile(undefined, {
            'aux.tokens': true,
            [`${token.username}.tokens`]: true,
            'aux.token.username': token.username,
            'aux.token': token.token,
        });
        await this._tree.addFile(file);

        return this._tree.value[file.id];
    }

    private async _createUserFile(
        username: string,
        firstUser: boolean
    ): Promise<File> {
        console.log('[AuxUserAuthenticator] Creating file for user...');
        if (firstUser) {
            console.log('[AuxUserAuthenticator] Granting Admin Role.');
        }
        const file = createFile(undefined, {
            'aux.users': true,
            'aux.username': username,
            'aux.roles': firstUser ? [ADMIN_ROLE] : [],
        });
        await this._tree.addFile(file);

        return this._tree.value[file.id];
    }
}
