import { AuxModule2, AuxChannel, Simulation } from '@casual-simulation/aux-vm';
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
export class AdminModule2 implements AuxModule2 {
    private _channelCounts: Map<string, number>;
    private _totalCount: number;

    constructor() {
        this._channelCounts = new Map();
        this._totalCount = 0;
    }

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    flatMap(async event => {
                        let local = <LocalActions>event;
                        if (local.type === 'shell') {
                            await shell(simulation, local);
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    async deviceConnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {
        console.log('[AdminModule] Device Connected!');

        this._totalCount += 1;
        await setChannelCount(simulation, this._addCount(simulation.id, 1));

        const userId = device.claims[SESSION_ID_CLAIM];
        const username = device.claims[USERNAME_CLAIM];
        if (!getUserBot()) {
            return;
        }

        await simulation.helper.updateBot(getUserBot(), {
            tags: {
                auxPlayerActive: true,
            },
        });

        function getUserBot() {
            return simulation.helper.botsState[userId];
        }
    }

    async deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {
        console.log('[AdminModule] Device Disconnected.');

        const count = this._addCount(simulation.id, -1);
        this._totalCount += -1;
        await setChannelCount(simulation, count);

        const userId = device.claims[SESSION_ID_CLAIM];
        let userBot = simulation.helper.botsState[userId];
        if (!userBot) {
            return;
        }

        await simulation.helper.updateBot(userBot, {
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

async function setChannelCount(simulation: Simulation, count: number) {
    const bot = simulation.helper.globalsBot;

    if (bot) {
        await simulation.helper.updateBot(bot, {
            tags: {
                auxConnectedSessions: count,
            },
        });
    }
}

function shell(simulation: Simulation, event: ShellAction) {
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
            await simulation.helper.createBot(undefined, {
                auxFinishedTasks: true,
                auxTaskShell: event.script,
                auxTaskOutput: stdout,
                auxTaskError: stderr,
            });

            resolve();
        });
    });
}
