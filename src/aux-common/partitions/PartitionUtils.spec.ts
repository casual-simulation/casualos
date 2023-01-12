import { toByteArray } from 'base64-js';
import { applyUpdate } from 'yjs';
import {
    createBot,
    createInitializationUpdate,
    getInstStateFromUpdates,
} from '../bots';
import {
    constructInitializationUpdate,
    getStateFromUpdates,
} from './PartitionUtils';
import { YjsPartitionImpl } from './YjsPartition';

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
        // setupPartition({
        //     type: 'remote_yjs',
        //     branch: 'testBranch',
        //     host: 'testHost',
        // });

        // partition.connect();

        // await partition.applyEvents([
        //     botAdded(
        //         createBot('test1', {
        //             abc: 'def',
        //             num: 123,
        //         })
        //     ),
        // ]);

        // await partition.applyEvents([
        //     botUpdated('test1', {
        //         tags: {
        //             num: 456,
        //         },
        //     }),
        // ]);

        // await waitAsync();

        // const updates = connection.sentMessages.filter(
        //     (message) => message.name === ADD_UPDATES
        // );
        // expect(updates).toHaveLength(2);

        // const instUpdates = flatMap(
        //     updates,
        //     (u) => (u.data as AddUpdatesEvent).updates
        // ).map((u, i) => ({
        //     id: i,
        //     update: u,
        // }));

        // const instTimestamps = flatMap(
        //     updates,
        //     (u) => (u.data as AddUpdatesEvent).timestamps ?? []
        // );

        // const finalUpdates = instUpdates.map((u) => ({
        //     id: u.id,
        //     update: u.update,
        //     timestamp: instTimestamps[u.id],
        // }));

        // expect(instUpdates).toHaveLength(2);

        // const events = [] as Action[];
        // partition.onEvents.subscribe((e) => events.push(...e));

        // await partition.sendRemoteEvents([
        //     remote(
        //         getInstStateFromUpdates(finalUpdates.slice(0, 1)),
        //         undefined,
        //         undefined,
        //         'task1'
        //     ),
        //     remote(
        //         getInstStateFromUpdates(finalUpdates),
        //         undefined,
        //         undefined,
        //         'task2'
        //     ),
        // ]);

        // await waitAsync();

        // expect(events).toEqual([
        //     asyncResult(
        //         'task1',
        //         {
        //             test1: createBot('test1', {
        //                 abc: 'def',
        //                 num: 123,
        //             }),
        //         },
        //         false
        //     ),
        //     asyncResult(
        //         'task2',
        //         {
        //             test1: createBot('test1', {
        //                 abc: 'def',
        //                 num: 456,
        //             }),
        //         },
        //         false
        //     ),
        // ]);

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
