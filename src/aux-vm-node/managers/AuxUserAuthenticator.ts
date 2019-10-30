import {
    DeviceAuthenticator,
    AuthenticationResult,
} from '@casual-simulation/causal-tree-server';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    GUEST_ROLE,
    DeviceToken,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
} from '@casual-simulation/causal-trees';
import { AuxLoadedChannel } from './AuxChannelManager';
import {
    calculateBotValue,
    BotCalculationContext,
    Bot,
    createBot,
    AuxCausalTree,
    getBotRoles,
    hasValue,
    calculateBooleanTagValue,
} from '@casual-simulation/aux-common';
import { Observable, of, Subscription, Subject } from 'rxjs';
import { NodeSimulation } from './NodeSimulation';
import {
    filter,
    tap,
    distinctUntilChanged,
    startWith,
    concatMap,
} from 'rxjs/operators';
import isEqual from 'lodash/isEqual';

/**
 * Defines an authenticator that determines if a user is authenticated based on bots in a simulation.
 */
export class AuxUserAuthenticator implements DeviceAuthenticator {
    private _channel: AuxLoadedChannel;
    private _sim: NodeSimulation;
    private _tree: AuxCausalTree;
    private _sub: Subscription;

    /**
     * A subject that is triggered with the username of the user that was updated.
     */
    private _userUpdated: Subject<string>;

    /**
     * A map of usernames to user info.
     */
    private _users: Map<string, UserAccountInfo>;

    /**
     * A map of token values to token info.
     */
    private _tokens: Map<string, UserTokenInfo>;

    /**
     * A map of usernames to token values.
     */
    private _userTokens: Map<string, Set<string>>;

    /**
     * A map of Bot IDs to user account info.
     */
    private _botAccountMap: Map<string, UserAccountInfo>;

    /**
     * A map of Bot IDs to user token info.
     */
    private _botTokenMap: Map<string, UserTokenInfo>;

    /**
     * Creates a new AuxUserAuthenticator for the given channel.
     * @param adminChannel The channel that users should be looked up in.
     */
    constructor(adminChannel: AuxLoadedChannel) {
        this._users = new Map();
        this._tokens = new Map();
        this._userTokens = new Map();
        this._botAccountMap = new Map();
        this._botTokenMap = new Map();
        this._userUpdated = new Subject<string>();

        this._channel = adminChannel;
        this._sim = adminChannel.simulation;
        this._tree = adminChannel.tree;

        this._sub = new Subscription();

        this._sub.add(
            this._sim.watcher.botsDiscovered
                .pipe(tap(bot => this._botsAdded(bot)))
                .subscribe()
        );

        this._sub.add(
            this._sim.watcher.botsRemoved
                .pipe(tap(bot => this._botsRemoved(bot)))
                .subscribe()
        );

        this._sub.add(
            this._sim.watcher.botsUpdated
                .pipe(tap(bot => this._botsUpdated(bot)))
                .subscribe()
        );
    }

    private _botsAdded(bots: Bot[]) {
        const context = this._sim.helper.createContext();

        for (let bot of bots) {
            if (hasValue(bot.tags['aux.account.username'])) {
                let user: UserAccountInfo = this._calculateUserAccountInfo(
                    context,
                    bot
                );

                this._users.set(user.username, user);
                this._botAccountMap.set(bot.id, user);

                this._userUpdated.next(user.username);
            }

            if (hasValue(bot.tags['aux.token.username'])) {
                let token: UserTokenInfo = this._calculateUserTokenInfo(
                    context,
                    bot
                );
                let tokens = this._getTokensForUsername(token.username);

                tokens.add(token.token);
                this._tokens.set(token.token, token);
                this._botTokenMap.set(bot.id, token);

                this._userUpdated.next(token.username);
            }
        }
    }

    private _botsRemoved(ids: string[]) {
        for (let id of ids) {
            const user = this._botAccountMap.get(id);
            if (user) {
                this._userTokens.delete(user.username);
                this._botAccountMap.delete(id);
                this._users.delete(user.username);

                this._userUpdated.next(user.username);
            }

            const token = this._botTokenMap.get(id);
            if (token) {
                let tokens = this._userTokens.get(token.username);
                if (tokens) {
                    tokens.delete(token.token);
                }
                this._botTokenMap.delete(id);
                this._tokens.delete(token.token);

                this._userUpdated.next(token.username);
            }
        }
    }

    private _botsUpdated(bots: Bot[]) {
        const context = this._sim.helper.createContext();

        for (let bot of bots) {
            this._updateUserInfo(context, bot);
            this._updateTokenInfo(context, bot);
        }
    }

    private _updateUserInfo(context: BotCalculationContext, bot: Bot) {
        const user = this._botAccountMap.get(bot.id);
        if (user) {
            // We had a user
            if (hasValue(bot.tags['aux.account.username'])) {
                // Update user
                this._users.delete(user.username);

                const newUser = this._calculateUserAccountInfo(context, bot);
                this._botAccountMap.set(bot.id, newUser);
                this._users.set(newUser.username, newUser);

                if (newUser.username === user.username) {
                    this._userUpdated.next(newUser.username);
                } else {
                    this._userUpdated.next(user.username);
                    this._userUpdated.next(newUser.username);
                }
            } else {
                // Remove user
                this._userTokens.delete(user.username);
                this._users.delete(user.username);
                this._botAccountMap.delete(bot.id);

                this._userUpdated.next(user.username);
            }
        } else {
            // We might have a new user
            if (hasValue(bot.tags['aux.account.username'])) {
                // We have a new user
                const newUser = this._calculateUserAccountInfo(context, bot);
                this._botAccountMap.set(bot.id, newUser);
                this._users.set(newUser.username, newUser);

                this._userUpdated.next(newUser.username);
            } else {
                // Do nothing
            }
        }
    }

    private _updateTokenInfo(context: BotCalculationContext, bot: Bot) {
        const token = this._botTokenMap.get(bot.id);
        if (token) {
            // We had a token

            if (hasValue(bot.tags['aux.token.username'])) {
                let oldUserTokens = this._getTokensForUsername(token.username);

                // Update token
                this._tokens.delete(token.token);
                oldUserTokens.delete(token.token);

                const newToken = this._calculateUserTokenInfo(context, bot);
                let newUserTokens = this._getTokensForUsername(
                    newToken.username
                );

                newUserTokens.add(newToken.token);
                this._botTokenMap.set(bot.id, newToken);
                this._tokens.set(newToken.token, newToken);

                if (newToken.username === token.username) {
                    this._userUpdated.next(newToken.username);
                } else {
                    this._userUpdated.next(token.username);
                    this._userUpdated.next(newToken.username);
                }
            } else {
                // Remove token
                this._tokens.delete(token.token);
                this._botTokenMap.delete(bot.id);

                this._userUpdated.next(token.username);
            }
        } else {
            // We might have a new token

            if (hasValue(bot.tags['aux.token.username'])) {
                // We have a new token
                const newToken = this._calculateUserTokenInfo(context, bot);
                let tokens = this._getTokensForUsername(newToken.username);
                tokens.add(newToken.token);
                this._botTokenMap.set(bot.id, newToken);
                this._tokens.set(newToken.token, newToken);

                this._userUpdated.next(newToken.username);
            } else {
                // Do nothing
            }
        }
    }

    private _getTokensForUsername(username: string): Set<string> {
        let tokens = this._userTokens.get(username);
        if (!tokens) {
            tokens = new Set();
            this._userTokens.set(username, tokens);
        }
        return tokens;
    }

    private _calculateUserAccountInfo(
        context: BotCalculationContext,
        bot: Bot
    ): UserAccountInfo {
        return {
            username: calculateBotValue(context, bot, 'aux.account.username'),
            roles: getBotRoles(context, bot),
            locked: calculateBooleanTagValue(
                context,
                bot,
                'aux.account.locked',
                false
            ),
        };
    }

    private _calculateUserTokenInfo(
        context: BotCalculationContext,
        bot: Bot
    ): UserTokenInfo {
        return {
            id: bot.id,
            token: calculateBotValue(context, bot, 'aux.token'),
            username: calculateBotValue(context, bot, 'aux.token.username'),
            locked: calculateBooleanTagValue(
                context,
                bot,
                'aux.token.locked',
                false
            ),
        };
    }

    authenticate(token: DeviceToken): Observable<AuthenticationResult> {
        if (!token) {
            return of({
                success: false,
                error: 'invalid_token',
            });
        }

        if (!token.token) {
            return of({
                success: false,
                error: 'invalid_token',
            });
        }

        if (!token.username) {
            return of({
                success: false,
                error: 'invalid_username',
            });
        }

        const _this = this;

        return this._userUpdated.pipe(
            startWith(token.username),
            filter(username => username === token.username),
            concatMap(u => authenticateUser()),
            distinctUntilChanged((a, b) => isEqual(a, b))
        );

        async function authenticateUser(): Promise<AuthenticationResult> {
            let userInfo = _this._users.get(token.username);
            const context = _this._sim.helper.createContext();

            if (!userInfo) {
                const admins = [..._this._users.values()].filter(u =>
                    u.roles.has(ADMIN_ROLE)
                );

                let userBot = await _this._createUserBot(
                    token.username,
                    admins.length === 0,
                    token.isGuest
                );

                userInfo = _this._calculateUserAccountInfo(context, userBot);
            }

            if (userInfo.locked) {
                return {
                    success: false,
                    error: 'account_locked',
                };
            }

            let tokensForUsername = _this._getTokensForUsername(
                userInfo.username
            );
            let tokenInfo = _this._tokens.get(token.token);

            if (tokensForUsername.has(token.token)) {
            } else if (tokensForUsername.size === 0) {
                let tokenBot = await _this._createTokenBot(token);
                tokenInfo = _this._calculateUserTokenInfo(context, tokenBot);
            } else if (token.grant) {
                console.log('[AuxUserAuthenticator] Checking grant...');

                let grantInfo = _this._tokens.get(token.grant);
                if (grantInfo) {
                    if (grantInfo.locked) {
                        console.log('[AuxUserAuthenticator] Grant invalid');
                        return {
                            success: false,
                            error: 'wrong_grant',
                        };
                    }

                    console.log('[AuxUserAuthenticator] Grant valid!');
                    let tokenBot = await _this._createTokenBot(token);
                    tokenInfo = _this._calculateUserTokenInfo(
                        context,
                        tokenBot
                    );
                } else {
                    console.log('[AuxUserAuthenticator] Grant invalid');
                    return {
                        success: false,
                        error: 'wrong_grant',
                    };
                }
            }

            if (tokenInfo) {
                if (tokenInfo.locked) {
                    return {
                        success: false,
                        error: 'token_locked',
                    };
                }

                const roles = userInfo.roles;
                const username = userInfo.username;
                const id = tokenInfo.id;

                roles.add(USER_ROLE);

                const info = {
                    claims: {
                        [USERNAME_CLAIM]: username,
                        [DEVICE_ID_CLAIM]: id,
                        [SESSION_ID_CLAIM]: token.id,
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
    }

    private async _createTokenBot(token: DeviceToken): Promise<Bot> {
        console.log('[AuxUserAuthenticator] Creating token for user...');
        const bot = createBot(undefined, {
            'aux.tokens': true,
            [`${token.username}.tokens`]: true,
            'aux.token.username': token.username,
            'aux.token': token.token,
        });
        await this._tree.addBot(bot);

        return this._tree.value[bot.id];
    }

    private async _createUserBot(
        username: string,
        firstUser: boolean,
        isGuest: boolean
    ): Promise<Bot> {
        console.log('[AuxUserAuthenticator] Creating bot for user...');
        let roles: string[] = [];
        if (firstUser && !isGuest) {
            console.log('[AuxUserAuthenticator] Granting Admin Role.');
            roles.push(ADMIN_ROLE);
        }
        if (isGuest) {
            console.log('[AuxUserAuthenticator] Granting Guest Role.');
            roles.push(GUEST_ROLE);
        }
        const bot = createBot(undefined, {
            'aux-users': true,
            'aux.account.username': username,
            'aux.account.roles': roles,
        });
        await this._tree.addBot(bot);

        return this._tree.value[bot.id];
    }
}

interface UserAccountInfo {
    username: string;
    roles: Set<string>;
    locked: boolean;
}

interface UserTokenInfo {
    id: string;
    token: string;
    username: string;
    locked: boolean;
}

// interface UserLoginInfo {
//     token: string;
// }
