import {
    NotificationMessenger,
    SlackOptions,
    UserInstReportNotification,
    formatNotificationAsString,
} from '@casual-simulation/aux-records';
import axios from 'axios';

/**
 * Defines a class that implements a notification messenger that sends notifications to Slack.
 */
export class SlackNotificationMessenger implements NotificationMessenger {
    private _options: SlackOptions;

    constructor(options: SlackOptions) {
        this._options = options;
    }

    async sendRecordNotification(
        notification: UserInstReportNotification
    ): Promise<void> {
        await axios.post(this._options.webhookUrl, {
            text: formatNotificationAsString(notification),
        });
    }
}
