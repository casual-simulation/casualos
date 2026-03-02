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
import { asyncResult, hasValue } from '@casual-simulation/aux-common';
import type { PostHog } from 'posthog-js';

export type SimpleAnalyticsRecordEvent = {
    (...args: [name: string, metadata: any, callback: () => void]): void;
    (...args: [name: string, callback: () => void]): void;
};

type PostHogRecordEvent = Pick<PostHog, 'capture' | 'has_opted_out_capturing'>;

interface RecordAnalyticsEventOptions {
    event: {
        name: string;
        metadata?: any;
        taskId?: number | string;
    };
    transaction: (...actions: any[]) => void;
    simpleAnalytics?: SimpleAnalyticsRecordEvent;
    posthog?: PostHogRecordEvent;
    posthogApiKey?: string;
    isDev: boolean;
}

export function recordAnalyticsEvent(options: RecordAnalyticsEventOptions) {
    const {
        event,
        transaction,
        simpleAnalytics,
        posthog,
        posthogApiKey,
        isDev,
    } = options;

    const hasSimpleAnalytics = typeof simpleAnalytics === 'function';
    const hasPosthog =
        hasValue(posthogApiKey) &&
        !isDev &&
        !!posthog &&
        typeof posthog.capture === 'function' &&
        !(
            typeof posthog.has_opted_out_capturing === 'function' &&
            posthog.has_opted_out_capturing()
        );

    if (!hasSimpleAnalytics && !hasPosthog) {
        throw new Error('Analytics are not supported on this inst.');
    }

    let posthogError: unknown = null;
    if (hasPosthog) {
        try {
            if (hasValue(event.metadata)) {
                posthog.capture(event.name, event.metadata as any);
            } else {
                posthog.capture(event.name);
            }
        } catch (err) {
            posthogError = err;
            console.error('[PlayerApp] Unable to record PostHog event:', err);
        }
    }

    if (hasSimpleAnalytics) {
        const callback = () => {
            if (hasValue(event.taskId)) {
                transaction(asyncResult(event.taskId, null));
            }
        };
        if (hasValue(event.metadata)) {
            simpleAnalytics(event.name, event.metadata, callback);
        } else {
            simpleAnalytics(event.name, callback);
        }
        return;
    }

    if (posthogError) {
        throw posthogError;
    }

    if (hasValue(event.taskId)) {
        transaction(asyncResult(event.taskId, null));
    }
}
