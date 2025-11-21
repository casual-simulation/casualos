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
import type { StudioComIdRequest } from './RecordsStore';
import type { UserInstReport } from './ModerationStore';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { ModerationFileScanLabel } from './ModerationJobProvider';
import {
    formatVersionNumber,
    type ResourceKinds,
} from '@casual-simulation/aux-common';
import type { PackageRecordVersion } from './packages/version';

/**
 * Defines an interface for a class that is able to send records notifications.
 */
export interface SystemNotificationMessenger {
    /**
     * Sends a notification to the user.
     * @param notification The notification to send.
     */
    sendRecordNotification(notification: RecordsNotification): Promise<void>;
}

/**
 * Defines a class that is able to send notifications to multiple messengers.
 */
export class MultiNotificationMessenger implements SystemNotificationMessenger {
    private _messengers: SystemNotificationMessenger[];
    private _options: NotificationOptions;

    constructor(options: NotificationOptions) {
        this._options = options;
        this._messengers = [];
    }

    addMessenger(messenger: SystemNotificationMessenger) {
        this._messengers.push(messenger);
    }

    async sendRecordNotification(
        notification: UserInstReportNotification
    ): Promise<void> {
        if (this._options.filter) {
            const filter = this._options.filter;
            if (
                filter.resources &&
                !filter.resources.includes(notification.resource)
            ) {
                return;
            }

            if (
                filter.actions &&
                !filter.actions.includes(notification.action)
            ) {
                return;
            }
        }

        await Promise.all(
            this._messengers.map((m) => m.sendRecordNotification(notification))
        );
    }
}

export type RecordsNotification =
    | UserInstReportNotification
    | ModerationResourceScanNotification
    | StudioComIdRequestNotification
    | PackageVersionPublishNotification;

/**
 * Defines a base interface for a notification that is related to a record.
 */
export interface RecordsNotificationBase {
    /**
     * The name of the record that the notification is for.
     * Null or undefined if the notification is not for a specific record.
     */
    recordName?: string;

    /**
     * The unix time in milliseconds that the notification was sent.
     */
    timeMs: number;
}

export interface ResourceNotification extends RecordsNotificationBase {
    /**
     * The action that was taken on the resource.
     */
    action: NotificationResourceActions;

    /**
     * The ID of the resource.
     */
    resourceId: string;

    /**
     * The markers that are present on the resource.
     */
    markers?: string[];
}

/**
 * Defines a notification that is for a user inst report.
 */
export interface UserInstReportNotification extends ResourceNotification {
    resource: 'user_inst_report';

    /**
     * The report that was created.
     */
    report: UserInstReport;
}

/**
 * Defines a notification that is for a user inst report.
 */
export interface PackageVersionPublishNotification
    extends ResourceNotification {
    resource: 'package_version_publish';

    /**
     * The package version that was created.
     */
    package: PackageRecordVersion;
}

/**
 * Defines a notification that is for a user inst report.
 */
export interface ModerationResourceScanNotification
    extends ResourceNotification {
    resource: 'moderation_scan';

    /**
     * The kind of the resource that was scanned.
     */
    resourceKind: ResourceKinds;

    /**
     * The name of the record that the resource was scanned in.
     */
    recordName: string | null;

    /**
     * The ID of the resource that was scanned.
     */
    resourceId: string;

    /**
     * The ID of the moderation result that was created for the resource.
     */
    resultId: string;

    /**
     * The labels that were detected in the file.
     */
    labels: ModerationFileScanLabel[];

    /**
     * The time of the scan in unix time in milliseconds.
     */
    timeMs: number;

    /**
     * The message that should be sent with the notification.
     */
    message: string;

    /**
     * The label that caused the resource to be banned.
     */
    bannedLabel?: ModerationFileScanLabel;
}

export interface StudioComIdRequestNotification extends ResourceNotification {
    resource: 'studio_com_id_request';

    /**
     * The request that this notification is for.
     */
    request: StudioComIdRequest;
}

export type NotificationResourceActions =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'scanned';

export const slackSchema = z.object({
    webhookUrl: z
        .url()
        .describe(
            'The Slack webhook URL that should be used to send records notification messages.'
        ),
});

export type SlackOptions = z.infer<typeof slackSchema>;

export const telegramSchema = z.object({
    chatId: z
        .number()
        .describe(
            'The ID of the Telegram chat that messages should be sent to.'
        ),
    token: z
        .string()
        .describe(
            'The Telegram bot token that should be used to send messages.'
        ),
});

export type TelegramOptions = z.infer<typeof telegramSchema>;

export const notificationFilterSchema = z.object({
    resources: z
        .array(z.string())
        .describe(
            'The resources that match the filter. If omitted, then all resources are matched.'
        )
        .optional(),
    actions: z
        .array(z.string())
        .describe(
            'The actions that match the filter. If omitted, then all actions are matched.'
        )
        .optional(),
});

export const notificationsSchema = z.object({
    slack: slackSchema
        .describe(
            'The Slack configuration that should be used for notifications. If omitted, then notifications will not be sent via Slack.'
        )
        .optional(),
    telegram: telegramSchema
        .describe(
            'The Telegram configuration that should be used for notifications. If omitted, then notifications will not be sent via Telegram.'
        )
        .optional(),
    filter: notificationFilterSchema
        .describe(
            'The filter that should be used to determine which notifications should be sent. If omitted, then all are sent'
        )
        .optional()
        .prefault({}),
});

export type NotificationOptions = z.infer<typeof notificationsSchema>;

export function formatNotificationAsString(
    notification: RecordsNotification
): string {
    switch (notification.resource) {
        case 'user_inst_report':
            return formatUserInstReportNotificationAsString(notification);
        case 'studio_com_id_request':
            return formatStudioComIdRequestNotificationAsString(notification);
        case 'moderation_scan':
            return formatModerationResourceScanNotificationAsString(
                notification
            );
        case 'package_version_publish':
            return formatPackageVersionPublishNotification(notification);
        default:
            return JSON.stringify(notification, undefined, 2);
    }
}

export function formatUserInstReportNotificationAsString(
    notification: UserInstReportNotification
): string {
    const time = DateTime.fromMillis(notification.timeMs, {
        zone: 'utc',
    }).toISO();
    return `A user inst report was ${notification.action} for ${
        notification.recordName ?? '(null)'
    }/${notification.resourceId}:
Report ID: ${notification.report.id}
Time: ${time}
Reporting User: ${notification.report.reportingUserId ?? '(null)'}
Reporting IP: ${notification.report.reportingIpAddress ?? '(null)'}
Reported URL: ${notification.report.reportedUrl}
Reported Permalink: ${notification.report.reportedPermalink}
Is Automatic Report?: ${notification.report.automaticReport}

Reason: ${notification.report.reportReason}

Text:
${notification.report.reportReasonText}`;
}

export function formatStudioComIdRequestNotificationAsString(
    notification: StudioComIdRequestNotification
): string {
    const time = DateTime.fromMillis(notification.timeMs, {
        zone: 'utc',
    }).toISO();
    return `A comId request was ${notification.action} for ${
        notification.resourceId
    }:
Request ID: ${notification.request.id}
Studio ID: ${notification.request.studioId}
Requested comID: ${notification.request.requestedComId}
Time: ${time}
Reporting User: ${notification.request.userId ?? '(null)'}
Requesting IP: ${notification.request.requestingIpAddress ?? '(null)'}`;
}

export function formatModerationResourceScanNotificationAsString(
    notification: ModerationResourceScanNotification
): string {
    const time = DateTime.fromMillis(notification.timeMs, {
        zone: 'utc',
    }).toISO();
    return `A ${notification.resourceKind} was ${
        notification.action
    } for moderation labels.

Message: ${notification.message}
RecordName: ${notification.recordName}
FileName: ${notification.resourceId}
ResultId: ${notification.resultId}
BannedLabel: ${
        notification.bannedLabel
            ? formatLabel(notification.bannedLabel)
            : '(null)'
    }
Labels: 
${notification.labels.map(formatLabel).join('\n')}
Time: ${time}`;

    function formatLabel(label: ModerationFileScanLabel): string {
        return `- ${label.name}${label.category ? ':' + label.category : ''} (${
            label.confidence
        })`;
    }
}

export function formatPackageVersionPublishNotification(
    notification: PackageVersionPublishNotification
): string {
    const time = DateTime.fromMillis(notification.timeMs, {
        zone: 'utc',
    }).toISO();

    let version = formatVersionNumber(
        notification.package.key.major,
        notification.package.key.minor,
        notification.package.key.patch,
        notification.package.key.tag
    );

    return `A ${notification.resource} was ${notification.action}.

RecordName: ${notification.recordName}
Address: ${notification.resourceId}
Version: ${version}
RequiresReview: ${notification.package.requiresReview}
Entitlements: [${notification.package.entitlements
        .map((e) => `${e.feature}:${e.scope}`)
        .join(', ')}]
Markers: [${notification.package.markers.join(', ')}]
Time: ${time}`;
}
