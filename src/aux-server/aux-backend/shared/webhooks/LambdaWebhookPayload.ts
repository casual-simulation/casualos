import { addState } from '@casual-simulation/aux-common';
import { WEBHOOK_STATE_SCHEMA } from '@casual-simulation/aux-records';
import { error } from 'console';
import { z } from 'zod';

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
    sessionKey: z.string().optional().nullable(),
    connectionKey: z.string().optional().nullable(),
    options: z
        .object({
            initTimeoutMs: z.number(),
            requestTimeoutMs: z.number(),
            fetchTimeoutMs: z.number(),
            addStateTimeoutMs: z.number(),
        })
        .optional()
        .nullable(),
});

export type HandleWebhookPayload = z.infer<
    typeof HANDLE_WEBHOOK_PAYLOAD_SCHEMA
>;

export const HANDLE_WEBHOOK_RESULT_SCHEMA = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        response: z.object({
            statusCode: z.number(),
            headers: z.record(z.string()),
            body: z.string(),
        }),
        logs: z.array(z.string()),
    }),
    z.object({
        success: z.literal(false),
        errorCode: z.enum([
            'server_error',
            'took_too_long',
            'invalid_webhook_target',
        ]),
        errorMessage: z.string(),
    }),
]);
