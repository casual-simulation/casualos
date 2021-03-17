import {
    SendWebhookAction,
    BotAction,
    asyncResult,
    asyncError,
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

function convertErrorToCopiableValue(err: unknown) {
    if (err instanceof Error) {
        let obj: any = {
            message: err.message,
            name: err.name,
            stack: err.stack,
        };

        if ((<any>err).response) {
            let response = (<any>err).response;
            obj.response = {
                data: response.data,
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
            };
        }

        return obj;
    } else {
        return err;
    }
}
