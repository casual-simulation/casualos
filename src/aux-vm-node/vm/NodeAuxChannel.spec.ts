import { NodeAuxChannel } from './NodeAuxChannel';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import {
    MemoryPartition,
    createMemoryPartition,
} from '@casual-simulation/aux-common';

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
        return (channel = new NodeAuxChannel(
            {
                id: 'server',
                name: 'Server',
                token: 'token',
                username: 'server',
            },
            {
                claims: {
                    [USERNAME_CLAIM]: 'server',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [SERVER_ROLE],
            },
            {
                config: {
                    isBuilder: false,
                    isPlayer: false,
                    versionHash: 'abc',
                    version: 'v1.0.0',
                },
                partitions: {
                    shared: partition,
                },
            }
        ));
    }

    it.skip('is a placeholder test', () => {});
});
