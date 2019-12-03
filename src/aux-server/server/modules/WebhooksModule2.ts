import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    GUEST_ROLE,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, tap } from 'rxjs/operators';
import {
    calculateBotValue,
    getBotRoles,
    getUserAccountBot,
    getTokensForUserAccount,
    findMatchingToken,
    AuxBot,
    ShellAction,
    getChannelBotById,
    LocalActions,
    EchoAction,
    action,
    SendWebhookAction,
    BotAction,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';
import { sendWebhook } from '../../shared/WebhookUtils';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class WebhooksModule2 implements AuxModule2 {
    constructor() {}

    setChannelManager() {}

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    flatMap(async event => {
                        if (event.type === 'send_webhook') {
                            await this._sendWebhook(simulation, event);
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

    private async _sendWebhook(
        simulation: Simulation,
        event: SendWebhookAction
    ) {
        console.log(`[WebhooksModule] Sending Webhook to ${event.options.url}`);
        await sendWebhook(simulation, event);
    }
}
