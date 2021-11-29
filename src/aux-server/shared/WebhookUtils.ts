import {
    SendWebhookAction,
    BotAction,
    asyncResult,
    asyncError,
    convertErrorToCopiableValue,
} from '@casual-simulation/aux-common';
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
        const response = await axios(axiosOptions as any);
        const { request, config, ...responseData } = response;
        let actions: BotAction[] = [asyncResult(event.taskId, responseData)];
        if (responseShout) {
            actions.push(
                ...simulation.helper.actions([
                    {
                        eventName: responseShout,
                        bots: null,
                        arg: {
                            request: axiosOptions,
                            response: responseData,
                            success: true,
                        },
                    },
                ])
            );
        }
        await simulation.helper.transaction(...actions);
    } catch (err) {
        let actions: BotAction[] = [
            asyncError(event.taskId, convertErrorToCopiableValue(err)),
        ];
        if (responseShout) {
            actions.push(
                ...simulation.helper.actions([
                    {
                        eventName: responseShout,
                        bots: null,
                        arg: {
                            request: axiosOptions,
                            error: err,
                            success: false,
                        },
                    },
                ])
            );
        } else {
            console.error(err);
        }
        await simulation.helper.transaction(...actions);
    }
}
