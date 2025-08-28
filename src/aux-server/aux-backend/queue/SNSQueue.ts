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

import type { IQueue } from '@casual-simulation/aux-records/queue';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';
import type { SNSClient } from '@aws-sdk/client-sns';
import { PublishCommand } from '@aws-sdk/client-sns';

export class SNSQueue<T> implements IQueue<T>, SubscriptionLike {
    private _sub: Subscription;
    private _client: SNSClient;
    private _topicArn: string;

    constructor(client: SNSClient, topicArn: string) {
        this._sub = new Subscription();
        this._client = client;
        this._topicArn = topicArn;

        this._sub.add(() => {
            this._client?.destroy();
            this._client = null;
        });
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    async add(name: string, data: T): Promise<void> {
        await this._client.send(
            new PublishCommand({
                TopicArn: this._topicArn,
                Message: JSON.stringify({
                    name,
                    data,
                }),
                MessageAttributes: {
                    'Content-Type': {
                        DataType: 'String',
                        StringValue: 'application/json',
                    },
                },
            })
        );
    }
}

/**
 * Parses a SNS
 * @param message
 * @returns
 */
export function parseSnsMessage(message: string): { name: string; data: any } {
    return JSON.parse(message);
}
