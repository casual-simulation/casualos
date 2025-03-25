import type {
    SendWebhookAction,
    BotAction,
    BotsState,
    StoredAuxVersion1,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    asyncError,
    convertErrorToCopiableValue,
} from '@casual-simulation/aux-common';
import type { Simulation } from '@casual-simulation/aux-vm/managers';
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

export async function createStaticHtml(state: BotsState, url: string) {
    try {
        const stored: StoredAuxVersion1 = {
            version: 1,
            state,
        };
        const json = JSON.stringify(stored);

        // const url = templateUrl
        //     ? templateUrl
        //     : new URL('/static.html', window.location.href).href;
        const result = await fetch(url);

        if (result.ok) {
            const html = await result.text();
            const parsed = new DOMParser().parseFromString(html, 'text/html');

            const script = parsed.createElement('script');
            script.setAttribute('type', 'text/aux');
            script.textContent = json;
            parsed.body.appendChild(script);
            return `<!DOCTYPE html>\n` + parsed.documentElement.outerHTML;
        } else {
            console.error(`Unable to fetch`, url);
            console.error(result);
            console.error(
                'It is possible that static HTML builds are not supported on this server.'
            );
            return null;
        }
    } catch (err) {
        console.error(err);
        return null;
    }
}
