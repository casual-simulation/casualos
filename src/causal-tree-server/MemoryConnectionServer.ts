import { ConnectionServer, Connection } from './ConnectionServer';
import { Subject, never } from 'rxjs';
import {
    DeviceInfo,
    DisconnectionReason,
} from '@casual-simulation/causal-trees';

export class MemoryConnectionServer implements ConnectionServer {
    connection = new Subject<Connection>();
}

export class MemoryConnection implements Connection {
    device: DeviceInfo;
    events = new Map<string, Subject<any>>();
    disconnect = new Subject<DisconnectionReason>();
    messages: { name: string; data: any }[] = [];

    constructor(device: DeviceInfo) {
        this.device = device;
    }

    event(name: string) {
        return this.events.get(name) || never();
    }

    send(name: string, data: any) {
        this.messages.push({
            name,
            data,
        });
    }
}
