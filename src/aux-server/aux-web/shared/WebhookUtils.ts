import { SendWebhookAction } from '@casual-simulation/aux-common';
import { Simulation } from '@casual-simulation/aux-vm';
import axios from 'axios';

/**
 * Processes webhook event for the given simulation.
 * @param simulation The simulation.
 * @param event The event.
 */
export async function sendWebhook(
    simulation: Simulation,
    event: SendWebhookAction
) {
    const { responseShout, ...axiosOptions } = event.options;

    try {
        const response = await axios(axiosOptions);
        if (responseShout) {
            const { request, config, ...responseData } = response;
            await simulation.helper.action(responseShout, null, {
                request: axiosOptions,
                response: responseData,
                success: true,
            });
        }
    } catch (err) {
        if (responseShout) {
            await simulation.helper.action(responseShout, null, {
                request: axiosOptions,
                error: err,
                success: false,
            });
        } else {
            console.error(err);
        }
    }
}
