import { UserInstReport } from 'ModerationStore';

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
     * The name of the inst that the notification is for.
     * Null or undefined if the notification is not for a specific record.
     */
    inst?: string;

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
