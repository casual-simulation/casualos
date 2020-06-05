import { AuxModule2, AuxUser, Simulation } from '@casual-simulation/aux-vm';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, map } from 'rxjs/operators';
import {
    action,
    SetupChannelAction,
    isBot,
    CREATE_ACTION_NAME,
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
                    flatMap(async event => {
                        if (event.type === 'setup_story') {
                            await this._setupChannel(event);
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

    private async _setupChannel(event: SetupChannelAction) {
        try {
            const hasChannel = await this._client
                .branchInfo(event.channel)
                .pipe(map(e => e.exists))
                .toPromise();
            if (!hasChannel) {
                console.log(
                    `[SetupChannelModule2] Setting up new channel ${
                        event.channel
                    }`
                );

                // TODO: Rework so that other modules can be used like webhooks.
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
                } finally {
                    simulation.unsubscribe();
                }
            }
        } catch (err) {
            console.error('[SetupChannelModule2]', err);
        }
    }
}
