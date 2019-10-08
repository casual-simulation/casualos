import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    GUEST_ROLE,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    GrantRoleAction,
    calculateBotValue,
    getBotRoles,
    getUserAccountBot,
    getTokensForUserAccount,
    findMatchingToken,
    AuxBot,
    RevokeRoleAction,
    ShellAction,
    getChannelBotById,
    LocalActions,
    EchoAction,
    action,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { exec } from 'child_process';
import { isAdminChannel } from './ModuleHelpers';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class AdminModule implements AuxModule {
    private _adminChannel: NodeAuxChannel;
    private _channelCounts: Map<string, number>;
    private _totalCount: number;

    constructor() {
        this._channelCounts = new Map();
        this._totalCount = 0;
    }

    async setup(
        info: RealtimeChannelInfo,
        channel: NodeAuxChannel
    ): Promise<Subscription> {
        let sub = new Subscription();

        if (isAdminChannel(info)) {
            this._adminChannel = <NodeAuxChannel>channel;
        }

        sub.add(
            channel.onDeviceEvents
                .pipe(
                    flatMap(events => events),
                    flatMap(async event => {
                        if (event.event) {
                            let local = <LocalActions>event.event;
                            if (local.type === 'say_hello') {
                                sayHelloTo(event.device.claims[USERNAME_CLAIM]);
                            } else if (local.type === 'echo') {
                                await echo(info, channel, event.device, local);
                            } else if (
                                event.device.roles.indexOf(ADMIN_ROLE) >= 0
                            ) {
                                if (local.type === 'grant_role') {
                                    await grantRole(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local
                                    );
                                } else if (local.type === 'revoke_role') {
                                    await revokeRole(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local
                                    );
                                } else if (local.type === 'shell') {
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
                                        local.type
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
        channel: NodeAuxChannel,
        device: DeviceInfo
    ): Promise<void> {
        console.log('[AdminModule] Device Connected!');

        let channelId = info.id.substring(4);
        this._totalCount += 1;
        await setChannelCount(
            this._adminChannel,
            channelId,
            this._addCount(channelId, 1)
        );
        await setTotalCount(this._adminChannel, this._totalCount);

        if (!channel.tree || channel.tree.weave.atoms.length <= 0) {
            return;
        }

        const userId = device.claims[SESSION_ID_CLAIM];
        const username = device.claims[USERNAME_CLAIM];
        if (!getUserBot()) {
            await channel.helper.createOrUpdateUserBot(
                {
                    id: userId,
                    token: null,
                    isGuest: device.roles.indexOf(GUEST_ROLE) > 0,
                    username: username,
                    name: username,
                },
                getUserBot()
            );
        }

        await channel.helper.updateBot(getUserBot(), {
            tags: {
                'aux.user.active': true,
            },
        });

        function getUserBot() {
            return channel.helper.botsState[userId];
        }
    }

    async deviceDisconnected(
        info: RealtimeChannelInfo,
        channel: NodeAuxChannel,
        device: DeviceInfo
    ): Promise<void> {
        console.log('[AdminModule] Device Disconnected.');
        let channelId = info.id.substring(4);

        const count = this._addCount(channelId, -1);
        this._totalCount += -1;
        await setChannelCount(this._adminChannel, channelId, count);
        await setTotalCount(this._adminChannel, this._totalCount);

        if (!channel.tree || channel.tree.weave.atoms.length <= 0) {
            return;
        }

        const userId = device.claims[SESSION_ID_CLAIM];
        let userBot = channel.helper.botsState[userId];
        await channel.helper.updateBot(userBot, {
            tags: {
                'aux.user.active': false,
            },
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

async function setTotalCount(channel: NodeAuxChannel, count: number) {
    const context = channel.helper.createContext();
    const globals = channel.helper.globalsBot;
    if (globals) {
        await channel.helper.updateBot(globals, {
            tags: {
                'aux.connectedSessions': count,
            },
        });
    }
}

async function setChannelCount(
    channel: NodeAuxChannel,
    id: string,
    count: number
) {
    const context = channel.helper.createContext();

    const bot = <AuxBot>getChannelBotById(context, id);

    if (bot) {
        await channel.helper.updateBot(bot, {
            tags: {
                'aux.channel.connectedSessions': count,
            },
        });
    }
}

async function grantRole(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: GrantRoleAction
) {
    let allowed =
        isAdminChannel(info) || isGrantValid(channel, device, event.grant);
    if (!allowed) {
        return;
    }
    const context = channel.helper.createContext();
    let userBot = <AuxBot>getUserAccountBot(context, event.username);

    if (!userBot) {
        const token = findMatchingToken(
            context,
            context.objects,
            event.username
        );
        if (token) {
            const username = calculateBotValue(
                context,
                token,
                'aux.token.username'
            );
            userBot = <AuxBot>getUserAccountBot(context, username);
        }
    }

    if (userBot) {
        console.log(
            `[AdminModule] Granting ${event.role} role to ${event.username}.`
        );
        const roles = getBotRoles(context, userBot);

        const finalRoles = new Set(roles || []);
        finalRoles.add(event.role);

        await channel.helper.updateBot(userBot, {
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
    event: RevokeRoleAction
) {
    let allowed =
        isAdminChannel(info) || isGrantValid(channel, device, event.grant);
    if (!allowed) {
        return;
    }
    const context = channel.helper.createContext();
    let userBot = <AuxBot>getUserAccountBot(context, event.username);

    if (!userBot) {
        const token = findMatchingToken(
            context,
            context.objects,
            event.username
        );
        if (token) {
            const username = calculateBotValue(
                context,
                token,
                'aux.token.username'
            );
            userBot = <AuxBot>getUserAccountBot(context, username);
        }
    }

    if (userBot) {
        console.log(
            `[AdminModule] Revoking ${event.role} role from ${event.username}.`
        );
        const roles = getBotRoles(context, userBot);

        const finalRoles = new Set(roles || []);
        finalRoles.delete(event.role);

        await channel.helper.updateBot(userBot, {
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

function echo(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: EchoAction
) {
    return channel.sendEvents([
        remote(action(event.message), {
            sessionId: device.claims[SESSION_ID_CLAIM],
        }),
    ]);
}

function shell(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: ShellAction
) {
    console.log(`[AdminModule] Running '${event.script}'...`);
    return new Promise<void>((resolve, reject) => {
        exec(event.script, async (err, stdout, stderr) => {
            if (err) {
                reject(err);
            }

            if (stdout) {
                console.log(`[Shell] ${stdout}`);
            }
            if (stderr) {
                console.error(`[Shell] ${stderr}`);
            }
            await channel.helper.createBot(undefined, {
                'aux.finishedTasks': true,
                'aux.task.shell': event.script,
                'aux.task.output': stdout,
                'aux.task.error': stderr,
            });

            resolve();
        });
    });
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
