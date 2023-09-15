import { AuxVMNode } from './AuxVMNode';
import { AuxConfig } from '@casual-simulation/aux-vm';
import { ConnectionInfo } from '@casual-simulation/aux-common';
import { NodeAuxChannel } from './NodeAuxChannel';
import {
    MemoryPartition,
    createMemoryPartition,
} from '@casual-simulation/aux-common';

console.log = jest.fn();

describe('AuxVMNode', () => {
    let memory: MemoryPartition;
    let config: AuxConfig;
    let connection: ConnectionInfo;
    let vm: AuxVMNode;
    let channel: NodeAuxChannel;
    beforeEach(async () => {
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });

        config = {
            config: {
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
                    type: 'memory',
                    partition: memory,
                },
            },
        };
        connection = {
            connectionId: 'connectionId',
            sessionId: null,
            userId: null,
        };

        channel = new NodeAuxChannel(connection, config);
        vm = new AuxVMNode(channel);
    });

    it('should initialize the channel', async () => {
        await vm.init();

        const bot = memory.state['connectionId'];
        expect(bot).toBeTruthy();
    });
});
