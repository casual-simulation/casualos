import {
    NotificationMessenger,
    SlackOptions,
    UserInstReportNotification,
    formatNotificationAsString,
} from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanKind, SpanOptions } from '@opentelemetry/api';
import axios from 'axios';

const TRACE_NAME = 'SlackNotificationMessenger';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        'peer.service': 'slack',
        'service.name': 'slack',
    },
};

/**
 * Defines a class that implements a notification messenger that sends notifications to Slack.
 */
export class SlackNotificationMessenger implements NotificationMessenger {
    private _options: SlackOptions;

    constructor(options: SlackOptions) {
        this._options = options;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async sendRecordNotification(
        notification: UserInstReportNotification
    ): Promise<void> {
        await axios.post(this._options.webhookUrl, {
            text: formatNotificationAsString(notification),
        });
    }
}
