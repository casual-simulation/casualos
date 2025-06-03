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
import type { ServerError } from '@casual-simulation/aux-common';
import { z } from 'zod';

/**
 * Defines a basic interface that is able to send notifications using web push.
 */
export interface WebPushInterface {
    /**
     * Sends a notification to the given push subscription.
     * @param pushSubscription The push subscription to send the notification to.
     * @param payload The payload to send.
     * @param topic The topic that the notification is for. Topics can be used to replace existing notifications with a new notification.
     */
    sendNotification(
        pushSubscription: PushSubscriptionType,
        payload: PushNotificationPayload,
        topic?: string
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
    expirationTime: z.number().optional().nullable(),
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
    title: z.string().min(1),
    body: z.string().min(2),
    icon: z.string().min(1).optional().nullable(),
    badge: z.string().min(1).optional().nullable(),
    silent: z.boolean().optional().nullable(),
    tag: z.string().min(1).optional().nullable(),
    timestamp: z.number().optional().nullable(),

    action: PUSH_NOTIFICATION_PAYLOAD_ACTION.optional().nullable(),

    actions: z
        .array(
            z.object({
                title: z.string().min(1),
                icon: z.string().min(1).optional().nullable(),
                action: PUSH_NOTIFICATION_PAYLOAD_ACTION,
            })
        )
        .optional()
        .nullable(),
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
