import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import { SendWebhookAction } from '@casual-simulation/aux-common';
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
