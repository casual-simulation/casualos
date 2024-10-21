import {
    SystemNotificationMessenger,
    SlackOptions,
    TelegramOptions,
    UserInstReportNotification,
    formatNotificationAsString,
} from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanKind, SpanOptions } from '@opentelemetry/api';
import axios from 'axios';

const TRACE_NAME = 'TelegramNotificationMessenger';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'telegram',
        'service.name': 'telegram',
    },
};

/**
 * Defines a class that implements a notification messenger that sends notifications to Telegram.
 */
export class TelegramNotificationMessenger
    implements SystemNotificationMessenger
{
    private _options: TelegramOptions;

    constructor(options: TelegramOptions) {
        this._options = options;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
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
