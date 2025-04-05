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
    PushNotificationPayload,
    PushSubscriptionType,
    SendPushNotificationResult,
    WebPushInterface,
} from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import webpush, { WebPushError } from 'web-push';

export const TRACE_NAME = 'WebPushImpl';

export interface WebPushConfig {
    /**
     * The subject for the VAPID keys.
     */
    vapidSubject: string;

    /**
     * The VAPID public key to use.
     */
    vapidPublicKey: string;

    /**
     * The VAPID private key to use.
     */
    vapidPrivateKey: string;
}

/**
 * Defines a basic implementation of the WebPushInterface that uses the browser WebPush API.
 */
export class WebPushImpl implements WebPushInterface {
    private _config: WebPushConfig;

    constructor(config: WebPushConfig) {
        this._config = config;
    }

    @traced(TRACE_NAME)
    async sendNotification(
        pushSubscription: PushSubscriptionType,
        payload: PushNotificationPayload,
        topic?: string
    ): Promise<SendPushNotificationResult> {
        try {
            const result = await webpush.sendNotification(
                pushSubscription as webpush.PushSubscription,
                JSON.stringify(payload),
                {
                    vapidDetails: {
                        subject: this._config.vapidSubject,
                        publicKey: this._config.vapidPublicKey,
                        privateKey: this._config.vapidPrivateKey,
                    },
                    topic,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            const span = trace.getActiveSpan();
            if (span) {
                span.setStatus({
                    code: SpanStatusCode.OK,
                });
            }

            return {
                success: true,
            };
        } catch (err) {
            if (err instanceof WebPushError) {
                if (err.statusCode >= 400) {
                    console.error(
                        `[WebPushImpl] Error while sending notification: `,
                        err
                    );
                    if (err.body) {
                        const span = trace.getActiveSpan();
                        span?.setAttributes({
                            'webpush.error': err.body,
                            'webpush.statusCode': err.statusCode,
                        });
                    }
                    if (err.statusCode === 410) {
                        return {
                            success: false,
                            errorCode: 'subscription_gone',
                        };
                    } else if (err.statusCode === 404) {
                        return {
                            success: false,
                            errorCode: 'subscription_not_found',
                        };
                    } else {
                        return {
                            success: false,
                            errorCode: 'server_error',
                        };
                    }
                }
            }
            throw err;
        }
    }

    getServerApplicationKey(): string {
        return this._config.vapidPublicKey;
    }
}
