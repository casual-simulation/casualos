import { BotsState, createBot, botAdded } from '../bots';
import {
    SyncedRealtimeCausalTree,
    AtomOp,
    storedTree,
    site,
    Atom,
    CausalTreeFactory,
    RealtimeChannelImpl,
    RealtimeChannel,
} from '@casual-simulation/causal-trees';
import { auxCausalTreeFactory } from './AuxCausalTreeFactory';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { TestChannelConnection } from '@casual-simulation/causal-trees/test/TestChannelConnection';
import {
    botChangeObservables,
    UpdatedBot,
} from './AuxRealtimeTreeCalculations';
import { AuxCausalTree } from './AuxCausalTree';
import { TestScheduler } from 'rxjs/testing';
import { AsyncScheduler } from 'rxjs/internal/scheduler/AsyncScheduler';
import { tap, flatMap } from 'rxjs/operators';

describe('AuxRealtimeTreeCalculations', () => {
    let factory: CausalTreeFactory;
    let store: TestCausalTreeStore;
    let connection: TestChannelConnection;
    let channel: RealtimeChannel;
    let tree: SyncedRealtimeCausalTree<AuxCausalTree>;

    beforeEach(async () => {
        factory = auxCausalTreeFactory();
        store = new TestCausalTreeStore();
        connection = new TestChannelConnection({
            id: 'test',
            type: 'aux',
        });
        channel = new RealtimeChannelImpl(connection);
        tree = new SyncedRealtimeCausalTree<AuxCausalTree>(
            factory,
            store,
            channel
        );
    });

    describe('botChangeObservables()', () => {
        let scheduler: TestScheduler;

        beforeEach(() => {
            scheduler = new TestScheduler((actual, expected) => {
                expect(actual).toEqual(expected);
            });
            AsyncScheduler.delegate = scheduler;
        });

        afterEach(() => {
            AsyncScheduler.delegate = null;
        });

        it('should sort added bots so workspaces are first', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            const { botsAdded } = botChangeObservables(tree);

            const botIds: string[] = [];
            const errorHandler = jest.fn();
            botsAdded.subscribe(bots => {
                bots.forEach(bot => botIds.push(bot.id));
            }, errorHandler);

            await tree.tree.addEvents([
                botAdded(createBot('abc', {})),
                botAdded(
                    createBot('def', {
                        auxDimension: 'context',
                    })
                ),
                botAdded(createBot('111', {})),
            ]);

            scheduler.flush();

            expect(botIds).toEqual(['def', '111', 'abc']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send a diff for the current bots', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            await stored.bot('test');
            await stored.bot('zdf');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();
            scheduler.flush();

            const botIds: string[] = [];
            const { botsAdded } = botChangeObservables(tree);
            const errorHandler = jest.fn();
            botsAdded.subscribe(bots => {
                bots.forEach(bot => botIds.push(bot.id));
            }, errorHandler);

            expect(botIds).toEqual(['test', 'zdf']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should handle multiple bots with the same ID getting added', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const test1 = await stored.bot('test');
            const test2 = await stored.bot('test');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();
            scheduler.flush();

            const botIds: string[] = [];
            const { botsAdded } = botChangeObservables(tree);
            const errorHandler = jest.fn();
            botsAdded.subscribe(bots => {
                bots.forEach(bot => botIds.push(bot.id));
            }, errorHandler);

            expect(botIds).toEqual(['test']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should handle deleted bots', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: bot } = await stored.bot('test');
            const { added: update } = await stored.tag('abc', bot);
            const { added: deleted } = await stored.delete(bot);

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();
            scheduler.flush();

            const botIds: string[] = [];
            const updatedBots: string[] = [];
            const { botsAdded, botsUpdated } = botChangeObservables(tree);
            const errorHandler = jest.fn();
            botsAdded
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => botIds.push(bot.id))
                )
                .subscribe(null, errorHandler);
            botsUpdated
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => updatedBots.push(bot.bot.id))
                )
                .subscribe(null, errorHandler);

            expect(botIds).toEqual([]);
            expect(updatedBots).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send bot deleted events', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: bot } = await stored.bot('test');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            scheduler.flush();

            const botIds: string[] = [];
            const updatedBots: string[] = [];
            const removedBots: string[] = [];
            const {
                botsAdded,
                botsUpdated,
                botsRemoved,
            } = botChangeObservables(tree);
            const errorHandler = jest.fn();
            botsAdded
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => botIds.push(bot.id))
                )
                .subscribe(null, errorHandler);
            botsUpdated
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => updatedBots.push(bot.bot.id))
                )
                .subscribe(null, errorHandler);
            botsRemoved
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => removedBots.push(bot))
                )
                .subscribe(null, errorHandler);

            const del = await tree.tree.delete(bot);

            expect(botIds).toEqual(['test']);
            expect(updatedBots).toEqual([]);
            expect(removedBots).toEqual(['test']);
            expect(errorHandler).not.toBeCalled();
        });

        it('should send bot updated events', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: bot } = await stored.bot('test');

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            scheduler.flush();

            const botIds: string[] = [];
            const updatedBots: UpdatedBot[] = [];
            const removedBots: string[] = [];
            const {
                botsAdded,
                botsUpdated,
                botsRemoved,
            } = botChangeObservables(tree);
            const errorHandler = jest.fn();
            botsAdded
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => botIds.push(bot.id))
                )
                .subscribe(null, errorHandler);
            botsUpdated
                .pipe(
                    flatMap(bots => bots),
                    tap(update => updatedBots.push(update))
                )
                .subscribe(null, errorHandler);
            botsRemoved
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => removedBots.push(bot))
                )
                .subscribe(null, errorHandler);

            await tree.tree.updateBot(tree.tree.value['test'], {
                tags: {
                    abc: 'def',
                    ghi: 123,
                },
            });

            expect(botIds).toEqual(['test']);
            expect(updatedBots).toEqual([
                {
                    bot: tree.tree.value['test'],
                    tags: ['abc', 'ghi'],
                },
            ]);
            expect(removedBots).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });

        it('should include tags set to null in updates', async () => {
            let stored = new AuxCausalTree(storedTree(site(1)));
            await stored.root();
            const { added: bot } = await stored.bot('test');
            const { added: tag } = await stored.tag('nullable', bot);
            await stored.val('my value', tag);

            await store.put('test', stored.export());
            await tree.connect();
            await connection.flushPromises();

            scheduler.flush();

            const botIds: string[] = [];
            const updatedBots: UpdatedBot[] = [];
            const removedBots: string[] = [];
            const {
                botsAdded,
                botsUpdated,
                botsRemoved,
            } = botChangeObservables(tree);
            const errorHandler = jest.fn();
            botsAdded
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => botIds.push(bot.id))
                )
                .subscribe(null, errorHandler);
            botsUpdated
                .pipe(
                    flatMap(bots => bots),
                    tap(update => updatedBots.push(update))
                )
                .subscribe(null, errorHandler);
            botsRemoved
                .pipe(
                    flatMap(bots => bots),
                    tap(bot => removedBots.push(bot))
                )
                .subscribe(null, errorHandler);

            await tree.tree.updateBot(tree.tree.value['test'], {
                tags: {
                    abc: 'def',
                    ghi: 123,
                    nullable: null,
                },
            });

            expect(botIds).toEqual(['test']);
            expect(updatedBots).toEqual([
                {
                    bot: tree.tree.value['test'],
                    tags: ['abc', 'ghi', 'nullable'],
                },
            ]);
            expect(removedBots).toEqual([]);
            expect(errorHandler).not.toBeCalled();
        });
    });
});
