import { DenoSimulationImpl, DenoVM } from '@casual-simulation/aux-vm-deno';
import { SimulationWebhookEnvironment } from '../../../../shared/webhooks/SimulationWebhookEnvironment';
import { GenericHttpRequest } from '@casual-simulation/aux-common';
import {
    WEBHOOK_STATE_SCHEMA,
    WebhookState,
} from '@casual-simulation/aux-records';
import { z } from 'zod';

const environment = new SimulationWebhookEnvironment(
    (simId, indicator, origin, config) =>
        new DenoSimulationImpl(
            indicator,
            origin,
            new DenoVM(simId, origin, config)
        )
);

export const HANDLE_WEBHOOK_PAYLOAD_SCHEMA = z.object({
    recordName: z.string(),
    inst: z.string().optional().nullable(),
    request: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']),
        path: z.string(),
        query: z.record(z.string()),
        pathParams: z.record(z.string()),
        headers: z.record(z.string()),
        body: z.string().nullable(),
        ipAddress: z.string(),
    }),
    state: WEBHOOK_STATE_SCHEMA,
});

export type HandleWebhookPayload = z.infer<
    typeof HANDLE_WEBHOOK_PAYLOAD_SCHEMA
>;

export async function handleWebhook(payload: HandleWebhookPayload) {
    const response = await environment.handleHttpRequest({
        recordName: payload.recordName,
        inst: payload.inst,
        state: payload.state as WebhookState,
        request: payload.request as GenericHttpRequest,
    });

    return response;
}
