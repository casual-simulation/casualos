import { testPartitionImplementation } from './test/PartitionTests';
import { createYjsPartition, YjsPartitionImpl } from './YjsPartition';
import { first } from 'rxjs/operators';

describe('YjsPartition', () => {
    testPartitionImplementation(
        async () => new YjsPartitionImpl({ type: 'yjs' }),
        true,
        true
    );

    it('should return immediate for the editStrategy', () => {
        const partition = new YjsPartitionImpl({ type: 'yjs' });

        expect(partition.realtimeStrategy).toEqual('immediate');
    });

    it('should have a current site ID', async () => {
        const mem = createYjsPartition({
            type: 'yjs',
        });

        const version = await mem.onVersionUpdated.pipe(first()).toPromise();

        expect(version?.currentSite).not.toBe(null);
        expect(version?.currentSite).toBeDefined();
    });
});
