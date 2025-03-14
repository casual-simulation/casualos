import { NodeAuxChannel } from './NodeAuxChannel';
import type { MemoryPartition } from '@casual-simulation/aux-common';
import { createMemoryPartition } from '@casual-simulation/aux-common';

let logMock = (console.log = jest.fn());
console.warn = jest.fn();

describe('NodeAuxChannel', () => {
    let partition: MemoryPartition;
    let channel: NodeAuxChannel;

    beforeEach(async () => {
        partition = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    function createChannel(id: string) {
        return (channel = new NodeAuxChannel({
            configBotId: 'connectionId',
            config: {
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: partition,
            },
        }));
    }

    it.skip('is a placeholder test', () => {});
});
