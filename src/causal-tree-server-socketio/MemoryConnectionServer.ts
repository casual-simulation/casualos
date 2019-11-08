import { ConnectionServer, Connection } from './ConnectionServer';
import { Subject, never } from 'rxjs';

export class MemoryConnectionServer implements ConnectionServer {
    connection = new Subject<Connection>();
}

export class MemroyConnection implements Connection {
    id: string;
    events = new Map<string, Subject<any>>();
    disconnect = new Subject<void>();
    messages: { name: string; data: any }[] = [];

    event(name: string) {
        return this.events.get(name) || never();
    }

    send(name: string, data: any) {
        this.messages.push({
            name,
            data,
        });
    }

    constructor(id: string) {
        this.id = id;
    }
}
