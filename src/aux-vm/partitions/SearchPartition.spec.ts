import { SearchPartition } from './AuxPartition';
import { createSearchPartition } from './SearchPartition';
import { MemorySearchClient } from './MemorySearchClient';
import {
    botAdded,
    createBot,
    botUpdated,
    botRemoved,
} from '@casual-simulation/aux-common';

describe('SearchPartition', () => {
    let client: MemorySearchClient;
    let subject: SearchPartition;

    beforeEach(() => {
        client = new MemorySearchClient();
        subject = createSearchPartition({
            type: 'search_client',
            universe: 'universe',
            client: client,
        });
    });

    it('should not add new bots to the partition state', async () => {
        await subject.applyEvents([
            botAdded(
                createBot('test', {
                    abc: 'def',
                })
            ),
        ]);

        expect(subject.state).toEqual({});
    });

    it('should add new bots to the client connection', async () => {
        await subject.applyEvents([
            botAdded(
                createBot('test', {
                    abc: 'def',
                })
            ),
        ]);

        expect(client.universes).toEqual({
            universe: {
                test: createBot('test', {
                    abc: 'def',
                }),
            },
        });
    });

    it('should ignore bot updates', async () => {
        await subject.applyEvents([
            botAdded(
                createBot('test', {
                    abc: 'def',
                })
            ),
            botUpdated('test', {
                tags: {
                    abc: 'ghi',
                },
            }),
        ]);

        expect(client.universes).toEqual({
            universe: {
                test: createBot('test', {
                    abc: 'def',
                }),
            },
        });
    });

    it('should ignore bot deletions', async () => {
        await subject.applyEvents([
            botAdded(
                createBot('test', {
                    abc: 'def',
                })
            ),
            botRemoved('test'),
        ]);

        expect(client.universes).toEqual({
            universe: {
                test: createBot('test', {
                    abc: 'def',
                }),
            },
        });
    });
});
