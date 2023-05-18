import { ApiaryMessenger } from './ApiaryMessenger';

export class MemoryApiaryMessenger implements ApiaryMessenger {
    private _messages = new Map<string, any[]>();

    getMessages(connectionId: string) {
        return this._getMessages(connectionId);
    }

    reset() {
        this._messages = new Map();
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
            list.push(data);
        }
    }

    private _getMessages(connectionId: string): any[] {
        let list = this._messages.get(connectionId);
        if (!list) {
            list = [];
            this._messages.set(connectionId, list);
        }
        return list;
    }
}
