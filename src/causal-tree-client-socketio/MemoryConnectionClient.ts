import { ConnectionClient } from './ConnectionClient';
import { Observable, Subject, never } from 'rxjs';

export class MemoryConnectionClient implements ConnectionClient {
    connected: boolean;
    sentMessages: {
        name: string;
        data: any;
    }[];
    events = new Map<string, Subject<any>>();

    event<T>(name: string): Observable<T> {
        return this.events.get(name) || never();
    }

    send(name: string, data: any): void {
        this.sentMessages.push({
            name,
            data,
        });
    }

    disconnect(): void {
        this.connected = false;
    }

    constructor() {
        this.connected = true;
        this.sentMessages = [];
    }
}
