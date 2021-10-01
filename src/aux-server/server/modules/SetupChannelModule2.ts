import { AuxModule2, AuxUser, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { concatMap, flatMap, map } from 'rxjs/operators';
import {
    action,
    SetupChannelAction,
    isBot,
    CREATE_ACTION_NAME,
    hasValue,
} from '@casual-simulation/aux-common';
import { nodeSimulationForBranch } from '@casual-simulation/aux-vm-node';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';

/**
 * Defines an AuxModule2 that adds setup channel functionality.
 */
export class SetupChannelModule2 implements AuxModule2 {
    private _client: CausalRepoClient;
    private _user: AuxUser;

    constructor(user: AuxUser, client: CausalRepoClient) {
        this._user = user;
        this._client = client;
    }

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    concatMap(async (event) => {
                        if (event.type === 'setup_server') {
                            await this._setupChannel(simulation, event);
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
    ): Promise<void> {}

    async deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}

    private async _setupChannel(
        currentSim: Simulation,
        event: SetupChannelAction
    ) {
        try {
            const hasChannel = await this._client
                .branchInfo(event.channel)
                .pipe(map((e) => e.exists))
                .toPromise();
            if (!hasChannel) {
                console.log(
                    `[SetupChannelModule2] Setting up new channel ${event.channel}`
                );

                // TODO: Rework so that other modules can be used like webhooks.
                // TODO: Also rework to support Deno
                const simulation = nodeSimulationForBranch(
                    this._user,
                    this._client,
                    event.channel
                );
                try {
                    await simulation.init();

                    if (event.botOrMod) {
                        console.log(`[SetupChannelModule2] Creating new bot`);
                        const botId = await simulation.helper.createBot(
                            undefined,
                            isBot(event.botOrMod)
                                ? event.botOrMod.tags
                                : event.botOrMod
                        );
                        console.log(
                            `[SetupChannelModule2] Created bot ${botId}`
                        );
                        await simulation.helper.transaction(
                            action(
                                CREATE_ACTION_NAME,
                                [botId],
                                simulation.helper.userId
                            )
                        );
                    }

                    if (hasValue(event.taskId) && hasValue(event.playerId)) {
                        await currentSim.helper.transaction(
                            remoteResult(
                                undefined,
                                {
                                    sessionId: event.playerId,
                                },
                                event.taskId
                            )
                        );
                    }
                } finally {
                    simulation.unsubscribe();
                }
            } else {
                if (hasValue(event.taskId) && hasValue(event.playerId)) {
                    await currentSim.helper.transaction(
                        remoteError(
                            {
                                error: 'failure',
                                exception: 'The inst already exists.',
                            },
                            {
                                sessionId: event.playerId,
                            },
                            event.taskId
                        )
                    );
                }
            }
        } catch (err) {
            console.error('[SetupChannelModule2]', err);
            if (hasValue(event.taskId) && hasValue(event.playerId)) {
                await currentSim.helper.transaction(
                    remoteError(
                        {
                            error: 'failure',
                            exception: err.toString(),
                        },
                        {
                            sessionId: event.playerId,
                        },
                        event.taskId
                    )
                );
            }
        }
    }
}
