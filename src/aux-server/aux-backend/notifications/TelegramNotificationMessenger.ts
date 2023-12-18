import {
    NotificationMessenger,
    SlackOptions,
    TelegramOptions,
    UserInstReportNotification,
    formatNotificationAsString,
} from '@casual-simulation/aux-records';
import axios from 'axios';

/**
 * Defines a class that implements a notification messenger that sends notifications to Telegram.
 */
export class TelegramNotificationMessenger implements NotificationMessenger {
    private _options: TelegramOptions;

    constructor(options: TelegramOptions) {
        this._options = options;
    }

    async sendRecordNotification(
        notification: UserInstReportNotification
    ): Promise<void> {
        const url = `https://api.telegram.org/bot${this._options.token}/sendMessage`;
        const form = new FormData();
        form.append('chat_id', String(this._options.chatId));
        form.append('text', formatNotificationAsString(notification));
        await axios.post(url, form);
    }
}
