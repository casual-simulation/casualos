import {
    MemoryConnectionServer,
    MemoryConnection,
} from './MemoryConnectionServer';
import { MultiConnectionServer } from './MultiConnectionServer';
import { Connection } from './ConnectionServer';
import { waitAsync } from './test/TestHelpers';
import { deviceInfo } from '@casual-simulation/causal-trees';

describe('MultiConnectionServer', () => {
    let server1: MemoryConnectionServer;
    let server2: MemoryConnectionServer;
    let subject: MultiConnectionServer;
    let connections: Connection[];

    beforeEach(() => {
        connections = [];
        server1 = new MemoryConnectionServer();
        server2 = new MemoryConnectionServer();
        subject = new MultiConnectionServer([server1, server2]);

        subject.connection.subscribe(c => connections.push(c));
    });

    it('should merge connections from different servers', async () => {
        const conn1 = new MemoryConnection(deviceInfo('abc', 'abc', 'abc'));
        const conn2 = new MemoryConnection(deviceInfo('def', 'def', 'def'));

        server1.connection.next(conn1);
        server1.connection.next(conn2);

        await waitAsync();

        expect(connections).toEqual([conn1, conn2]);
    });
});
