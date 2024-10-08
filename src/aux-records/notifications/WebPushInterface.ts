import { ServerError } from '@casual-simulation/aux-common';
import { z } from 'zod';

/**
 * Defines a basic interface that is able to send notifications using web push.
 */
export interface WebPushInterface {
    /**
     * Sends a notification to the given push subscription.
     * @param pushSubscription The push subscription to send the notification to.
     * @param payload The payload to send.
     */
    sendNotification(
        pushSubscription: PushSubscriptionType,
        payload: PushNotificationPayload
    ): Promise<SendPushNotificationResult>;

    /**
     * Gets the [VAPID](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid) public key that the server is using.
     */
    getServerApplicationKey(): string;
}

/**
 * The schema for a [PushSubscription](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription).
 */
export const PUSH_SUBSCRIPTION_SCHEMA = z.object({
    endpoint: z.string(),
    expirationTime: z.number().optional(),
    keys: z.record(z.string()),
});

export type PushSubscriptionType = z.infer<typeof PUSH_SUBSCRIPTION_SCHEMA>;

export const PUSH_NOTIFICATION_PAYLOAD_ACTION = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('open_url'),
        url: z.string(),
    }),
    z.object({
        type: z.literal('webhook'),
        method: z.enum(['GET', 'POST']),
        url: z.string(),
        headers: z.record(z.string()).optional().nullable(),
    }),
]);

export const PUSH_NOTIFICATION_PAYLOAD = z.object({
    title: z.string(),
    body: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    badge: z.string().optional().nullable(),
    silent: z.boolean().optional().nullable(),
    tag: z.string().optional().nullable(),
    timestamp: z.number().optional().nullable(),

    action: PUSH_NOTIFICATION_PAYLOAD_ACTION.optional().nullable(),

    actions: z.array(
        z.object({
            title: z.string(),
            icon: z.string().optional().nullable(),
            action: PUSH_NOTIFICATION_PAYLOAD_ACTION,
        })
    ),
});

export type PushNotificationPayload = z.infer<typeof PUSH_NOTIFICATION_PAYLOAD>;

export type SendPushNotificationResult =
    | SendPushNotificationSuccess
    | SendPushNotificationFailure;

export interface SendPushNotificationSuccess {
    success: true;
}

export interface SendPushNotificationFailure {
    success: false;

    /**
     * The error code that occurred.
     * If the error code is 'subscription_not_found' or 'subscription_gone' then the subscription is no longer valid and should automatically be removed.
     */
    errorCode: ServerError | 'subscription_not_found' | 'subscription_gone';
}
