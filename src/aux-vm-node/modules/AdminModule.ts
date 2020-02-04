import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    GUEST_ROLE,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    calculateBotValue,
    AuxBot,
    ShellAction,
    getChannelBotById,
    LocalActions,
    action,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { exec } from 'child_process';
import { isAdminChannel } from './ModuleHelpers';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class AdminModule implements AuxModule {
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

        sub.add(
            channel.onLocalEvents
                .pipe(
                    flatMap(events => events),
                    flatMap(async event => {
                        let local = <LocalActions>event;
                        if (local.type === 'shell') {
                            await shell(info, channel, local);
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
        await setChannelCount(channel, channelId, this._addCount(channelId, 1));
        // await setTotalCount(this._adminChannel, this._totalCount);

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
                auxPlayerActive: true,
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
        await setChannelCount(channel, channelId, count);
        // await setTotalCount(this._adminChannel, this._totalCount);

        if (!channel.tree || channel.tree.weave.atoms.length <= 0) {
            return;
        }

        const userId = device.claims[SESSION_ID_CLAIM];
        let userBot = channel.helper.botsState[userId];
        await channel.helper.updateBot(userBot, {
            tags: {
                auxPlayerActive: false,
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
                auxConnectedSessions: count,
            },
        });
    }
}

async function setChannelCount(
    channel: NodeAuxChannel,
    id: string,
    count: number
) {
    const bot = channel.helper.globalsBot;

    if (bot) {
        await channel.helper.updateBot(bot, {
            tags: {
                auxConnectedSessions: count,
            },
        });
    }
}

function shell(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
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
                auxFinishedTasks: true,
                auxTaskShell: event.script,
                auxTaskOutput: stdout,
                auxTaskError: stderr,
            });

            resolve();
        });
    });
}
