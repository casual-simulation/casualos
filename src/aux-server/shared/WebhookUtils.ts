/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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
