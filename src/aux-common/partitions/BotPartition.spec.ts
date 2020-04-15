import { BotPartition } from './AuxPartition';
import { createBotClientPartition } from './BotPartition';
import { MemoryBotClient } from './MemoryBotClient';
import {
    botAdded,
    createBot,
    botUpdated,
    botRemoved,
    loadBots,
    Bot,
    clearSpace,
} from '../bots';
import { waitAsync } from '../test/TestHelpers';

describe('BotPartition', () => {
    let client: MemoryBotClient;
    let subject: BotPartition;

    beforeEach(() => {
        client = new MemoryBotClient();
        subject = createBotClientPartition({
            type: 'bot_client',
            universe: 'universe',
            client: client,
        });
    });

    it('should return delayed for editStrategy', () => {
        expect(subject.realtimeStrategy).toEqual('delayed');
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

    describe('load_bots', () => {
        it('should load the matching bots and emit a bot added event', async () => {
            await client.addBots('universe', [
                createBot('test2', {
                    num: 123,
                    test: true,
                }),
                createBot('test1', {
                    abc: 'def',
                    test: true,
                }),
                createBot('test3', {
                    wrong: true,
                    test: false,
                }),
            ]);

            let bots = [] as Bot[];
            subject.onBotsAdded.subscribe(b => bots.push(...b));

            await subject.applyEvents([
                loadBots(<any>'space', [
                    {
                        tag: 'test',
                        value: true,
                    },
                ]),
            ]);

            await waitAsync();

            // Should emit them in order of ID
            expect(bots).toEqual([
                createBot('test1', {
                    abc: 'def',
                    test: true,
                }),
                createBot('test2', {
                    num: 123,
                    test: true,
                }),
            ]);
            expect(subject.state).toEqual({
                test1: createBot('test1', {
                    abc: 'def',
                    test: true,
                }),
                test2: createBot('test2', {
                    num: 123,
                    test: true,
                }),
            });
        });
    });

    describe('clear_space', () => {
        it('should clear all the bots in the given universe', async () => {
            await client.addBots('universe', [
                createBot('test2', {
                    num: 123,
                    test: true,
                }),
                createBot('test1', {
                    abc: 'def',
                    test: true,
                }),
                createBot('test3', {
                    wrong: true,
                    test: false,
                }),
            ]);

            let removed = [] as string[];
            subject.onBotsRemoved.subscribe(b => removed.push(...b));

            await subject.applyEvents([
                loadBots(<any>'space', [
                    {
                        tag: 'test',
                        value: true,
                    },
                ]),
            ]);

            await subject.applyEvents([clearSpace(<any>'space')]);

            await waitAsync();

            const bots = await client.universes['universe'];
            expect(bots).toEqual({});

            // Should emit them in order of ID
            expect(removed).toEqual(['test1', 'test2']);
            expect(subject.state).toEqual({});
        });
    });
});
