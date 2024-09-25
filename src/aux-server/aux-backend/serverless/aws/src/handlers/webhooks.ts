import { DenoSimulationImpl, DenoVM } from '@casual-simulation/aux-vm-deno';
import { SimulationWebhookEnvironment } from '../../../../shared/webhooks/SimulationWebhookEnvironment';
import { GenericHttpRequest } from '@casual-simulation/aux-common';
import {
    HandleWebhookOptions,
    WEBHOOK_STATE_SCHEMA,
    WebhookState,
} from '@casual-simulation/aux-records';
import { resolve } from 'path';
import {
    HANDLE_WEBHOOK_PAYLOAD_SCHEMA,
    HandleWebhookPayload,
} from '../../../../shared/webhooks/LambdaWebhookPayload';

const scriptPath = `file://${resolve('./deno.js')}`;

console.log('[webhooks] Deno Script path:', scriptPath);

const environment = new SimulationWebhookEnvironment(
    (simId, indicator, origin, config) => {
        const vm = new DenoVM(new URL(scriptPath), simId, origin, config);
        const sim = new DenoSimulationImpl(indicator, origin, vm);

        return {
            sim,
            onLogs: vm.onLogs,
            vm,
        };
    }
);

export async function handleWebhook(payload: HandleWebhookPayload) {
    const parseResult = HANDLE_WEBHOOK_PAYLOAD_SCHEMA.safeParse(payload);
    if (!parseResult.success) {
        throw new Error('Invalid payload!');
    }
    const request = parseResult.data;

    const response = await environment.handleHttpRequest({
        recordName: request.recordName,
        inst: request.inst,
        state: request.state as WebhookState,
        request: request.request as GenericHttpRequest,
        sessionKey: request.sessionKey,
        connectionKey: request.connectionKey,
        options: request.options as HandleWebhookOptions,
    });

    return response;
}
