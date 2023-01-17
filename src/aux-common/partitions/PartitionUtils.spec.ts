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
