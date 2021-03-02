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
    asyncResult,
    StateUpdatedEvent,
} from '../bots';
import { waitAsync } from '../test/TestHelpers';
import { Action } from '@casual-simulation/causal-trees';
import { skip } from 'rxjs/operators';

describe('BotPartition', () => {
    let client: MemoryBotClient;
    let subject: BotPartition;

    beforeEach(() => {
        client = new MemoryBotClient();
        subject = createBotClientPartition({
            type: 'bot_client',
            server: 'server',
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

        expect(client.servers).toEqual({
            server: {
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

        expect(client.servers).toEqual({
            server: {
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

        expect(client.servers).toEqual({
            server: {
                test: createBot('test', {
                    abc: 'def',
                }),
            },
        });
    });

    describe('load_bots', () => {
        it('should load the matching bots and emit a bot added event', async () => {
            await client.addBots('server', [
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
            let updates = [] as StateUpdatedEvent[];
            subject.onBotsAdded.subscribe((b) => bots.push(...b));
            subject.onStateUpdated
                .pipe(skip(1))
                .subscribe((u) => updates.push(u));

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
            expect(updates).toEqual([
                {
                    state: {
                        test1: createBot('test1', {
                            abc: 'def',
                            test: true,
                        }),
                        test2: createBot('test2', {
                            num: 123,
                            test: true,
                        }),
                    },
                    addedBots: ['test1', 'test2'],
                    removedBots: [],
                    updatedBots: [],
                },
            ]);
        });

        it('should emit a async result with the loaded bots', async () => {
            await client.addBots('server', [
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

            let events = [] as Action[];
            subject.onEvents.subscribe((e) => events.push(...e));

            await subject.applyEvents([
                loadBots(
                    <any>'space',
                    [
                        {
                            tag: 'test',
                            value: true,
                        },
                    ],
                    99
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                asyncResult(
                    99,
                    [
                        createBot('test1', {
                            abc: 'def',
                            test: true,
                        }),
                        createBot('test2', {
                            num: 123,
                            test: true,
                        }),
                    ],
                    true
                ),
            ]);
        });

        it('should put the bots into the space specified by the partition', async () => {
            subject.space = 'test';
            await client.addBots('server', [
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
            subject.onBotsAdded.subscribe((b) => bots.push(...b));

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
                createBot(
                    'test1',
                    {
                        abc: 'def',
                        test: true,
                    },
                    <any>'test'
                ),
                createBot(
                    'test2',
                    {
                        num: 123,
                        test: true,
                    },
                    <any>'test'
                ),
            ]);
            expect(subject.state).toEqual({
                test1: createBot(
                    'test1',
                    {
                        abc: 'def',
                        test: true,
                    },
                    <any>'test'
                ),
                test2: createBot(
                    'test2',
                    {
                        num: 123,
                        test: true,
                    },
                    <any>'test'
                ),
            });
        });
    });

    describe('clear_space', () => {
        it('should clear all the bots in the given server', async () => {
            await client.addBots('server', [
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
            let updates = [] as StateUpdatedEvent[];
            subject.onBotsRemoved.subscribe((b) => removed.push(...b));

            await subject.applyEvents([
                loadBots(<any>'space', [
                    {
                        tag: 'test',
                        value: true,
                    },
                ]),
            ]);

            subject.onStateUpdated
                .pipe(skip(1))
                .subscribe((u) => updates.push(u));

            await subject.applyEvents([clearSpace(<any>'space')]);

            await waitAsync();

            const bots = await client.servers['server'];
            expect(bots).toEqual({});

            // Should emit them in order of ID
            expect(removed).toEqual(['test1', 'test2']);
            expect(subject.state).toEqual({});
            expect(updates).toEqual([
                {
                    state: {
                        test1: null,
                        test2: null,
                    },
                    addedBots: [],
                    removedBots: ['test1', 'test2'],
                    updatedBots: [],
                },
            ]);
        });

        it('should emit a async result when the bots are cleared', async () => {
            await client.addBots('server', [
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

            let events = [] as Action[];
            subject.onEvents.subscribe((e) => events.push(...e));

            await subject.applyEvents([clearSpace(<any>'space', 99)]);

            await waitAsync();

            expect(events).toEqual([asyncResult(99, undefined)]);
        });
    });
});
