import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, tap } from 'rxjs/operators';
import {
    GrantRoleEvent,
    calculateFileValue,
    getFileRoles,
    getUserAccountFile,
    getTokensForUserAccount,
    findMatchingToken,
    AuxFile,
    RevokeRoleEvent,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class AdminModule implements AuxModule {
    private _adminChannel: NodeAuxChannel;

    async setup(
        info: RealtimeChannelInfo,
        channel: AuxChannel
    ): Promise<Subscription> {
        let sub = new Subscription();

        if (isInAdminChannel(info)) {
            this._adminChannel = <NodeAuxChannel>channel;
        }

        sub.add(
            channel.onDeviceEvents
                .pipe(
                    flatMap(events => events),
                    flatMap(async event => {
                        if (event.event && event.event.type === 'local') {
                            let local = event.event;
                            if (local.name === 'say_hello') {
                                sayHelloTo(event.device.claims[USERNAME_CLAIM]);
                            } else if (
                                event.device.roles.indexOf(ADMIN_ROLE) >= 0
                            ) {
                                if (local.name === 'grant_role') {
                                    await grantRole(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local
                                    );
                                } else if (local.name === 'revoke_role') {
                                    await revokeRole(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local
                                    );
                                }
                            }
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }
}

async function grantRole(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: GrantRoleEvent
) {
    let allowed =
        isInAdminChannel(info) || isGrantValid(channel, device, event.grant);
    if (!allowed) {
        return;
    }
    const context = channel.helper.createContext();
    let userFile = <AuxFile>getUserAccountFile(context, event.username);

    if (!userFile) {
        const token = findMatchingToken(
            context,
            context.objects,
            event.username
        );
        if (token) {
            const username = calculateFileValue(
                context,
                token,
                'aux.token.username'
            );
            userFile = <AuxFile>getUserAccountFile(context, username);
        }
    }

    if (userFile) {
        console.log(
            `[AdminModule] Granting ${event.role} role to ${event.username}.`
        );
        const roles = getFileRoles(context, userFile);

        const finalRoles = new Set(roles || []);
        finalRoles.add(event.role);

        await channel.helper.updateFile(userFile, {
            tags: {
                'aux.account.roles': [...finalRoles],
            },
        });
    } else {
        console.log(
            `[AdminModule] Cannot grant role ${event.role} to user ${
                event.username
            } because the user was not found.`
        );
    }
}

async function revokeRole(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: RevokeRoleEvent
) {
    let allowed =
        isInAdminChannel(info) || isGrantValid(channel, device, event.grant);
    if (!allowed) {
        return;
    }
    const context = channel.helper.createContext();
    let userFile = <AuxFile>getUserAccountFile(context, event.username);

    if (!userFile) {
        const token = findMatchingToken(
            context,
            context.objects,
            event.username
        );
        if (token) {
            const username = calculateFileValue(
                context,
                token,
                'aux.token.username'
            );
            userFile = <AuxFile>getUserAccountFile(context, username);
        }
    }

    if (userFile) {
        console.log(
            `[AdminModule] Revoking ${event.role} role from ${event.username}.`
        );
        const roles = getFileRoles(context, userFile);

        const finalRoles = new Set(roles || []);
        finalRoles.delete(event.role);

        await channel.helper.updateFile(userFile, {
            tags: {
                'aux.account.roles': [...finalRoles],
            },
        });
    } else {
        console.log(
            `[AdminModule] Cannot revoke role ${event.role} from user ${
                event.username
            } because the user was not found.`
        );
    }
}

function isInAdminChannel(info: RealtimeChannelInfo): boolean {
    return info.id === 'aux-admin';
}

function isGrantValid(
    channel: NodeAuxChannel,
    device: DeviceInfo,
    grant: string
): boolean {
    if (!grant) {
        return false;
    }
    const context = channel.helper.createContext();
    const tokens = getTokensForUserAccount(
        context,
        device.claims[USERNAME_CLAIM]
    );
    const match = findMatchingToken(context, tokens, grant);

    return !!match;
}

function sayHelloTo(username: string) {
    console.log(`User ${username} says "Hello!"`);
}
