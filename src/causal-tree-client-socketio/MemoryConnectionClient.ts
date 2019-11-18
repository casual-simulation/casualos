import { ConnectionClient } from './ConnectionClient';
import { Observable, never } from 'rxjs';

export class MemoryConnectionClient implements ConnectionClient {
    connected: boolean;
    sentMessages: {
        name: string;
        data: any;
    }[];

    event<T>(name: string): Observable<T> {
        return never();
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
