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
import { MessageChannel, MessagePort } from 'deno-vm';
import { DenoSimulationImpl, DenoVM } from '@casual-simulation/aux-vm-deno';
import { SimulationWebhookEnvironment } from '../../../../shared/webhooks/SimulationWebhookEnvironment';
import type { GenericHttpRequest } from '@casual-simulation/aux-common';
import type {
    HandleWebhookOptions,
    WebhookState,
} from '@casual-simulation/aux-records';
import { resolve } from 'path';
import type { HandleWebhookPayload } from '../../../../shared/webhooks/LambdaWebhookPayload';
import { HANDLE_WEBHOOK_PAYLOAD_SCHEMA } from '../../../../shared/webhooks/LambdaWebhookPayload';
import { statSync } from 'fs';
import type { AuxConfigParameters } from '@casual-simulation/aux-vm';

const anyGlobalThis = globalThis as any;
anyGlobalThis.MessageChannel = MessageChannel;
anyGlobalThis.MessagePort = MessagePort;

const script = resolve('./deno.js');
const scriptPath = `file://${script}`;

console.log('[webhooks] Deno Script path:', scriptPath);
console.log('[webhooks] script stat:', statSync(script));

export async function handleWebhook(payload: HandleWebhookPayload | string) {
    let webhookPayload: HandleWebhookPayload;
    if (typeof payload === 'string') {
        try {
            webhookPayload = JSON.parse(payload);
        } catch (e) {
            console.error('[webhooks] Invalid payload JSON:', e);
            throw new Error('Invalid payload!');
        }
    } else {
        webhookPayload = payload;
    }

    const parseResult = HANDLE_WEBHOOK_PAYLOAD_SCHEMA.safeParse(webhookPayload);
    if (parseResult.success === false) {
        console.error('[webhooks] Invalid payload:', parseResult.error);
        throw new Error('Invalid payload!');
    }
    const request = parseResult.data;

    const environment = new SimulationWebhookEnvironment(
        (simId, indicator, origin, config) => {
            const vm = new DenoVM(
                new URL(scriptPath),
                simId,
                origin,
                {
                    ...config,
                    config: {
                        ...config.config,
                        debug: true,
                    },
                },
                {
                    denoBootstrapScriptPath: resolve('./deno-bootstrap.js'),
                }
            );
            const sim = new DenoSimulationImpl(indicator, origin, vm);

            return {
                sim,
                onLogs: vm.onLogs,
                vm,
            };
        },
        {
            configParameters: request.configParameters as AuxConfigParameters,
        }
    );

    const response = await environment.handleHttpRequest({
        recordName: request.recordName,
        inst: request.inst,
        state: request.state as WebhookState,
        request: request.request as GenericHttpRequest,
        sessionKey: request.sessionKey,
        connectionKey: request.connectionKey,
        options: request.options as HandleWebhookOptions,
        requestUserId: request.requestUserId,
        sessionUserId: request.sessionUserId,
    });

    return response;
}
