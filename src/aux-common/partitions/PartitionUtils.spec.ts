import { fromByteArray, toByteArray } from 'base64-js';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import {
    InstUpdate,
    botAdded,
    botUpdated,
    createBot,
    createInitializationUpdate,
    getInstStateFromUpdates,
} from '../bots';
import {
    constructInitializationUpdate,
    getStateFromUpdates,
    mergeInstUpdates,
} from './PartitionUtils';
import { YjsPartitionImpl } from './YjsPartition';
import { waitAsync } from '../test/TestHelpers';

describe('constructInitializationUpdate()', () => {
    it('should return an update that represents the bots', async () => {
        const action = createInitializationUpdate([
            createBot('test1', {
                abc: 'def',
            }),
            createBot('test2', {
                num: 123,
            }),
        ]);

        const update = constructInitializationUpdate(action);

        expect(update).toEqual({
            id: 0,
            timestamp: expect.any(Number),
            update: expect.any(String),
        });

        const validationPartition = new YjsPartitionImpl({
            type: 'yjs',
        });
        applyUpdate(validationPartition.doc, toByteArray(update.update));

        expect(validationPartition.state).toEqual({
            test1: createBot('test1', {
                abc: 'def',
            }),
            test2: createBot('test2', {
                num: 123,
            }),
        });
    });
});

describe('getStateFromUpdates()', () => {
    it('should return the state matching the given updates', async () => {
        const state = getStateFromUpdates(
            getInstStateFromUpdates([
                {
                    id: 0,
                    timestamp: 0,
                    update: 'AQLNrtWDBQAnAQRib3RzBGJvdDEBKADNrtWDBQAEdGFnMQF3A2FiYwA=',
                },
            ])
        );

        expect(state).toEqual({
            bot1: createBot('bot1', {
                tag1: 'abc',
            }),
        });
    });
});

describe('mergeInstUpdates()', () => {
    it('should merge the updates into a single update', async () => {
        const partition = new YjsPartitionImpl({
            type: 'yjs',
        });

        let updates: InstUpdate[] = [];
        partition.doc.on('update', (update: Uint8Array) => {
            updates.push({
                id: updates.length,
                timestamp: updates.length * 10,
                update: fromByteArray(update),
            });
        });

        await partition.applyEvents([
            botAdded(createBot('test1', { abc: 'def' })),
        ]);

        await waitAsync();

        await partition.applyEvents([
            botAdded(createBot('test2', { num: 999 })),
        ]);

        await waitAsync();

        await partition.applyEvents([
            botUpdated('test1', { tags: { abc: 'xyz' } }),
        ]);

        await waitAsync();

        const mergedUpdate: InstUpdate = mergeInstUpdates(updates, 123, 987);

        expect(mergedUpdate).toEqual({
            id: 123,
            timestamp: 987,
            update: expect.any(String),
        });

        const validationPartition = new YjsPartitionImpl({
            type: 'yjs',
        });
        applyUpdate(validationPartition.doc, toByteArray(mergedUpdate.update));

        expect(validationPartition.state).toEqual({
            test1: createBot('test1', {
                abc: 'xyz',
            }),
            test2: createBot('test2', {
                num: 999,
            }),
        });
    });
});
