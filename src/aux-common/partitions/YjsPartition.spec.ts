import { testPartitionImplementation } from './test/PartitionTests';
import { YjsPartitionImpl } from './YjsPartition';
import {
    createCertificate,
    asyncResult,
    botAdded,
    createBot,
    signTag,
    AsyncResultAction,
    revokeCertificate,
} from '../bots';
import { YjsPartition } from './AuxPartition';

describe('YjsPartition', () => {
    testPartitionImplementation(
        async () =>
            new YjsPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                { type: 'yjs' }
            ),
        true
    );

    it('should return immediate for the editStrategy', () => {
        const partition = new YjsPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            { type: 'yjs' }
        );

        expect(partition.realtimeStrategy).toEqual('immediate');
    });
});
