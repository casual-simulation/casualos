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
import type { PresignFileUploadResult } from '../FileRecordsStore';
import type { WebsocketEvent } from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import type { WebsocketMessenger } from './WebsocketMessenger';

export class MemoryWebsocketMessenger implements WebsocketMessenger {
    private _messages = new Map<string, any[]>();
    private _events = new Map<string, WebsocketEvent[]>();
    private _disconnections = new Map<string, boolean>();
    private _messageUploadUrl: string = null;

    uploadedMessages: Map<string, string> = null;

    get messageUploadUrl() {
        return this._messageUploadUrl;
    }

    set messageUploadUrl(value: string) {
        this._messageUploadUrl = value;
    }

    getMessages(connectionId: string) {
        return this._getMessages(connectionId);
    }

    getEvents(connectionId: string) {
        return this._getEvents(connectionId);
    }

    isDisconnected(connectionId: string) {
        return this._disconnections.get(connectionId) || false;
    }

    reset() {
        this._messages = new Map();
        this._events = new Map();
        this._disconnections = new Map();
        this.uploadedMessages = null;
    }

    async sendMessage(
        connectionIds: string[],
        data: any,
        excludeConnection?: string
    ): Promise<void> {
        for (let id of connectionIds) {
            if (id === excludeConnection) {
                continue;
            }
            const list = this._getMessages(id);
            list.push(JSON.parse(JSON.stringify(data)));
        }
    }

    async sendEvent(
        connectionId: string,
        event: WebsocketEvent
    ): Promise<void> {
        const events = this._getEvents(connectionId);
        events.push(JSON.parse(JSON.stringify(event)));
    }

    async presignMessageUpload(): Promise<PresignFileUploadResult> {
        if (!this._messageUploadUrl) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Message uploads are not supported.',
            };
        }
        return {
            success: true,
            uploadMethod: 'POST',
            uploadUrl: this._messageUploadUrl,
            uploadHeaders: {},
        };
    }

    async downloadMessage(url: string): Promise<string | null | undefined> {
        if (!this.uploadedMessages) {
            return undefined;
        }

        return this.uploadedMessages.get(url) ?? null;
    }

    private _getMessages(connectionId: string): any[] {
        let list = this._messages.get(connectionId);
        if (!list) {
            list = [];
            this._messages.set(connectionId, list);
        }
        return list;
    }

    private _getEvents(connectionId: string) {
        let list = this._events.get(connectionId);
        if (!list) {
            list = [];
            this._events.set(connectionId, list);
        }
        return list;
    }

    async disconnect(connectionId: string): Promise<void> {
        this._disconnections.set(connectionId, true);
    }
}
