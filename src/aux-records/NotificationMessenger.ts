import { UserInstReport } from './ModerationStore';
import { DateTime } from 'luxon';
import { z } from 'zod';

/**
 * Defines an interface for a class that is able to send records notifications.
 */
export interface NotificationMessenger {
    /**
     * Sends a notification to the user.
     * @param notification The notification to send.
     */
    sendRecordNotification(notification: RecordsNotification): Promise<void>;
}

/**
 * Defines a class that is able to send notifications to multiple messengers.
 */
export class MultiNotificationMessenger implements NotificationMessenger {
    private _messengers: NotificationMessenger[];
    private _options: NotificationOptions;

    constructor(options: NotificationOptions) {
        this._options = options;
        this._messengers = [];
    }

    addMessenger(messenger: NotificationMessenger) {
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

export type RecordsNotification = UserInstReportNotification;

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

export type NotificationResourceActions = 'created' | 'updated' | 'deleted';

export const slackSchema = z.object({
    webhookUrl: z
        .string()
        .describe(
            'The Slack webhook URL that should be used to send records notification messages.'
        )
        .url(),
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
        .default({}),
});

export type NotificationOptions = z.infer<typeof notificationsSchema>;

export function formatNotificationAsString(
    notification: RecordsNotification
): string {
    switch (notification.resource) {
        case 'user_inst_report':
            return formatUserInstReportNotificationAsString(notification);
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
