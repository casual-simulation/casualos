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
    fileChangeObservables,
    hasValue,
} from '@casual-simulation/aux-common';
import { Observable, of, Observer, Subscription, merge } from 'rxjs';
import { FileWatcher, FileHelper } from '@casual-simulation/aux-vm/managers';
import { AuxVMNode } from '../vm';
import { NodeSimulation } from './NodeSimulation';
import {
    filter,
    flatMap,
    map,
    mergeMap,
    switchMap,
    tap,
    skip,
    distinctUntilChanged,
} from 'rxjs/operators';
import { isEqual } from 'lodash';

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

    authenticate(token: DeviceToken): Observable<AuthenticationResult> {
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

        return Observable.create((observer: Observer<AuthenticationResult>) => {
            let sub = new Subscription();

            authenticateUser().then(
                result => {
                    observer.next(result);
                    setup(sub, observer);
                },
                err => {
                    observer.error(err);
                }
            );

            return sub;
        });

        function setup(
            sub: Subscription,
            observer: Observer<AuthenticationResult>
        ) {
            const vm = new AuxVMNode(_this._sim.channel);
            const helper = new FileHelper(vm);
            const watcher = new FileWatcher(
                helper,
                _this._sim.channel.onStateUpdated
            );

            sub.add(watcher);

            const userOrTokenAdded = watcher.filesDiscovered.pipe(
                skip(1),
                filter(files => {
                    return files.some(
                        file =>
                            hasValue(file.tags['aux.username']) ||
                            hasValue(file.tags['aux.token.username'])
                    );
                }),
                map(() => true)
            );

            const userOrTokenUpdated = watcher.filesUpdated.pipe(
                filter(files => {
                    return files.some(
                        file =>
                            hasValue(file.tags['aux.username']) ||
                            hasValue(file.tags['aux.token.username'])
                    );
                }),
                map(() => true)
            );

            const filesRemoved = watcher.filesRemoved.pipe(map(() => true));

            const addedUpdatedOrRemoved = merge(
                userOrTokenAdded,
                userOrTokenUpdated,
                filesRemoved
            );

            sub.add(
                addedUpdatedOrRemoved
                    .pipe(
                        switchMap(() => authenticateUser()),
                        distinctUntilChanged(isEqual),
                        tap(authenticated => observer.next(authenticated))
                    )
                    .subscribe()
            );
        }

        async function authenticateUser(): Promise<AuthenticationResult> {
            const objects = getActiveObjects(_this._sim.tree.value);
            const context = _this._sim.channel.helper.createContext();
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
                userFile = await _this._createUserFile(
                    token.username,
                    admins.length === 0 && !token.isGuest
                );
            }

            if (tokenFile) {
            } else if (tokensForUsername.length === 0) {
                tokenFile = await _this._createTokenFile(token);
            } else if (token.grant) {
                console.log('[AuxUserAuthenticator] Checking grant...');

                const grantFile = findMatchingToken(
                    context,
                    tokensForUsername,
                    token.grant
                );

                if (grantFile) {
                    console.log('[AuxUserAuthenticator] Grant valid!');
                    tokenFile = await _this._createTokenFile(token);
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
