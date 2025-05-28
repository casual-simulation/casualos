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
    SystemNotificationMessenger,
    TelegramOptions,
    UserInstReportNotification,
} from '@casual-simulation/aux-records';
import { formatNotificationAsString } from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';
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
