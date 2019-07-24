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
    ShellEvent,
    isFileInContext,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { exec } from 'child_process';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class AdminModule implements AuxModule {
    private _adminChannel: NodeAuxChannel;
    private _channelCounts: Map<string, number>;

    constructor() {
        this._channelCounts = new Map();
    }

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
                                } else if (local.name === 'shell') {
                                    await shell(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local
                                    );
                                }
                            } else {
                                console.log(
                                    `[AdminModule] Cannot run event ${
                                        local.name
                                    } because the user is not an admin.`
                                );
                            }
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    async deviceConnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<Subscription> {
        await setChannelCount(
            this._adminChannel,
            info.id,
            this._addCount(info.id, 1)
        );

        return new Subscription(() => {
            const count = this._addCount(info.id, -1);
            setChannelCount(this._adminChannel, info.id, count);
        });
    }

    private _addCount(id: string, amount: number): number {
        let count = this._channelCounts.get(id);
        if (!count) {
            count = 0;
        }

        count += amount;
        this._channelCounts.set(id, count);
        return count;
    }
}

async function setChannelCount(
    channel: NodeAuxChannel,
    id: string,
    count: number
) {
    const context = channel.helper.createContext();

    const channelFiles = context.objects.filter(o => {
        return (
            isFileInContext(context, o, 'aux.channels') &&
            calculateFileValue(context, o, 'aux.channel') === id
        );
    });

    if (channelFiles.length > 0) {
        const file = <AuxFile>channelFiles[0];
        await channel.helper.updateFile(file, {
            tags: {
                'aux.channel.connectedDevices': count,
            },
        });
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

function shell(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: ShellEvent
) {
    console.log(`[AdminModule] Running '${event.script}'...`);
    return new Promise<void>((resolve, reject) => {
        exec(event.script, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            }

            if (stdout) {
                console.log(`[Shell] ${stdout}`);
            }
            if (stderr) {
                console.error(`[Shell] ${stderr}`);
            }

            resolve();
        });
    });
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
