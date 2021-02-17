import {
    RemoteCausalRepoHistoryPartitionImpl,
    COMMIT_ID_NAMESPACE,
} from './RemoteCausalRepoHistoryPartition';
import { Subject, Subscription } from 'rxjs';
import {
    atom,
    atomId,
    ADD_ATOMS,
    AddAtomsEvent,
    MemoryConnectionClient,
    CausalRepoClient,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    WATCH_COMMITS,
    AddCommitsEvent,
    ADD_COMMITS,
    index,
    commit,
    RESTORE,
    RestoredEvent,
    RESTORED,
} from '@casual-simulation/causal-trees/core2';
import { remote, Action } from '@casual-simulation/causal-trees';
import { waitAsync } from '../test/TestHelpers';
import {
    createBot,
    Bot,
    UpdatedBot,
    restoreHistoryMark,
    asyncResult,
    StateUpdatedEvent,
} from '../bots';
import { CausalRepoHistoryClientPartitionConfig } from './AuxPartitionConfig';
import { v5 as uuid } from 'uuid';
import { skip } from 'rxjs/operators';

console.log = jest.fn();

describe('RemoteCausalRepoHistoryPartition', () => {
    describe('connection', () => {
        let connection: MemoryConnectionClient;
        let client: CausalRepoClient;
        let partition: RemoteCausalRepoHistoryPartitionImpl;
        let receiveEvent: Subject<ReceiveDeviceActionEvent>;
        let addAtoms: Subject<AddAtomsEvent>;
        let added: Bot[];
        let removed: string[];
        let updated: UpdatedBot[];
        let updates: StateUpdatedEvent[];
        let sub: Subscription;

        beforeEach(async () => {
            connection = new MemoryConnectionClient();
            receiveEvent = new Subject<ReceiveDeviceActionEvent>();
            addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(RECEIVE_EVENT, receiveEvent);
            connection.events.set(ADD_ATOMS, addAtoms);
            client = new CausalRepoClient(connection);
            connection.connect();
            sub = new Subscription();

            added = [];
            removed = [];
            updated = [];
            updates = [];

            setupPartition({
                type: 'causal_repo_history_client',
                branch: 'testBranch',
                client: null,
            });
        });

        afterEach(() => {
            sub.unsubscribe();
        });

        it('should return delayed for the editStrategy', () => {
            expect(partition.realtimeStrategy).toEqual('delayed');
        });

        describe('remote events', () => {
            it('should not send the remote event to the server', async () => {
                await partition.sendRemoteEvents([
                    remote(
                        {
                            type: 'def',
                        },
                        {
                            deviceId: 'device',
                        }
                    ),
                ]);

                expect(connection.sentMessages).toEqual([]);
            });

            describe('restore_history_mark', () => {
                it('should send a restore event to the server', async () => {
                    const addCommits = new Subject<AddCommitsEvent>();
                    connection.events.set(ADD_COMMITS, addCommits);

                    partition.connect();

                    await waitAsync();

                    const a1 = atom(atomId('a', 1), null, {});
                    const a2 = atom(atomId('a', 2), a1, {});
                    const idx1 = index(a1);
                    const idx2 = index(a1, a2);
                    const c1 = commit(
                        'commit1',
                        new Date(1900, 1, 1),
                        idx1,
                        null
                    );
                    const c2 = commit(
                        'commit2',
                        new Date(1900, 1, 1),
                        idx2,
                        c1
                    );

                    addCommits.next({
                        branch: 'testBranch',
                        commits: [c2, c1],
                    });

                    await waitAsync();

                    await partition.sendRemoteEvents([
                        remote(
                            restoreHistoryMark(
                                uuid(c1.hash, COMMIT_ID_NAMESPACE)
                            )
                        ),
                    ]);

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: RESTORE,
                            data: {
                                branch: 'testBranch',
                                commit: c1.hash,
                            },
                        },
                    ]);
                });

                it('should send a restore event to the server with the server if specified', async () => {
                    const addCommits = new Subject<AddCommitsEvent>();
                    connection.events.set(ADD_COMMITS, addCommits);

                    partition.connect();

                    await waitAsync();

                    const a1 = atom(atomId('a', 1), null, {});
                    const a2 = atom(atomId('a', 2), a1, {});
                    const idx1 = index(a1);
                    const idx2 = index(a1, a2);
                    const c1 = commit(
                        'commit1',
                        new Date(1900, 1, 1),
                        idx1,
                        null
                    );
                    const c2 = commit(
                        'commit2',
                        new Date(1900, 1, 1),
                        idx2,
                        c1
                    );

                    addCommits.next({
                        branch: 'testBranch',
                        commits: [c2, c1],
                    });

                    await waitAsync();

                    await partition.sendRemoteEvents([
                        remote(
                            restoreHistoryMark(
                                uuid(c1.hash, COMMIT_ID_NAMESPACE),
                                'server'
                            )
                        ),
                    ]);

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: RESTORE,
                            data: {
                                branch: 'server',
                                commit: c1.hash,
                            },
                        },
                    ]);
                });

                it('should send a async result when finished', async () => {
                    const addCommits = new Subject<AddCommitsEvent>();
                    const restored = new Subject<RestoredEvent>();
                    connection.events.set(ADD_COMMITS, addCommits);
                    connection.events.set(RESTORED, restored);

                    partition.connect();

                    await waitAsync();

                    const a1 = atom(atomId('a', 1), null, {});
                    const a2 = atom(atomId('a', 2), a1, {});
                    const idx1 = index(a1);
                    const idx2 = index(a1, a2);
                    const c1 = commit(
                        'commit1',
                        new Date(1900, 1, 1),
                        idx1,
                        null
                    );
                    const c2 = commit(
                        'commit2',
                        new Date(1900, 1, 1),
                        idx2,
                        c1
                    );

                    addCommits.next({
                        branch: 'testBranch',
                        commits: [c2, c1],
                    });

                    await waitAsync();

                    let events = [] as Action[];
                    partition.onEvents.subscribe((e) => events.push(...e));

                    await partition.sendRemoteEvents([
                        remote(
                            restoreHistoryMark(
                                uuid(c1.hash, COMMIT_ID_NAMESPACE)
                            ),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ]);

                    await waitAsync();

                    restored.next({
                        branch: 'testBranch',
                    });

                    await waitAsync();

                    expect(events).toEqual([asyncResult('task1', undefined)]);
                });
            });
        });

        it('should request commits', async () => {
            partition.connect();

            expect(connection.sentMessages).toEqual([
                {
                    name: WATCH_COMMITS,
                    data: 'testBranch',
                },
            ]);
        });

        it('should convert commits into bots', async () => {
            const addCommits = new Subject<AddCommitsEvent>();
            connection.events.set(ADD_COMMITS, addCommits);

            partition.space = 'history';
            partition.connect();

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const idx1 = index(a1);
            const idx2 = index(a1, a2);
            const c1 = commit('commit1', new Date(1900, 1, 1), idx1, null);
            const c2 = commit('commit2', new Date(1900, 1, 1), idx2, c1);

            addCommits.next({
                branch: 'testBranch',
                commits: [c2, c1],
            });

            await waitAsync();

            expect(partition.state).toEqual({
                [uuid(c1.hash, COMMIT_ID_NAMESPACE)]: createBot(
                    uuid(c1.hash, COMMIT_ID_NAMESPACE),
                    {
                        history: true,
                        historyY: -0,
                        label: 'commit1',
                        labelSize: 0.25,
                        scale: 0.8,
                        scaleX: 2,
                        markHash: c1.hash,
                        previousMarkHash: null,
                        markTime: new Date(1900, 1, 1),
                    },
                    'history'
                ),
                [uuid(c2.hash, COMMIT_ID_NAMESPACE)]: createBot(
                    uuid(c2.hash, COMMIT_ID_NAMESPACE),
                    {
                        history: true,
                        historyY: -1,
                        label: 'commit2',
                        labelSize: 0.25,
                        scale: 0.8,
                        scaleX: 2,
                        markHash: c2.hash,
                        previousMarkHash: c1.hash,
                        markTime: new Date(1900, 1, 1),
                    },
                    'history'
                ),
            });
            expect(updates).toEqual([
                {
                    state: {
                        [uuid(c1.hash, COMMIT_ID_NAMESPACE)]: createBot(
                            uuid(c1.hash, COMMIT_ID_NAMESPACE),
                            {
                                history: true,
                                historyY: -0,
                                label: 'commit1',
                                labelSize: 0.25,
                                scale: 0.8,
                                scaleX: 2,
                                markHash: c1.hash,
                                previousMarkHash: null,
                                markTime: new Date(1900, 1, 1),
                            },
                            'history'
                        ),
                        [uuid(c2.hash, COMMIT_ID_NAMESPACE)]: createBot(
                            uuid(c2.hash, COMMIT_ID_NAMESPACE),
                            {
                                history: true,
                                historyY: -1,
                                label: 'commit2',
                                labelSize: 0.25,
                                scale: 0.8,
                                scaleX: 2,
                                markHash: c2.hash,
                                previousMarkHash: c1.hash,
                                markTime: new Date(1900, 1, 1),
                            },
                            'history'
                        ),
                    },
                    addedBots: [
                        uuid(c2.hash, COMMIT_ID_NAMESPACE),
                        uuid(c1.hash, COMMIT_ID_NAMESPACE),
                    ],
                    removedBots: [],
                    updatedBots: [],
                },
            ]);
        });

        it('should make a new state object when a bot is added', async () => {
            const addCommits = new Subject<AddCommitsEvent>();
            connection.events.set(ADD_COMMITS, addCommits);

            partition.connect();

            await waitAsync();

            const a1 = atom(atomId('a', 1), null, {});
            const a2 = atom(atomId('a', 2), a1, {});
            const idx1 = index(a1);
            const idx2 = index(a1, a2);
            const c1 = commit('commit1', new Date(1900, 1, 1), idx1, null);
            const c2 = commit('commit2', new Date(1900, 1, 1), idx2, c1);

            const state1 = partition.state;

            addCommits.next({
                branch: 'testBranch',
                commits: [c1],
            });

            await waitAsync();

            const state2 = partition.state;

            addCommits.next({
                branch: 'testBranch',
                commits: [c2],
            });

            await waitAsync();

            const state3 = partition.state;

            expect(state1).not.toBe(state2);
            expect(state2).not.toBe(state3);
            expect(state1).not.toBe(state3);
        });

        function setupPartition(
            config: CausalRepoHistoryClientPartitionConfig
        ) {
            partition = new RemoteCausalRepoHistoryPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                client,
                config
            );

            sub.add(partition);
            sub.add(partition.onBotsAdded.subscribe((b) => added.push(...b)));
            sub.add(
                partition.onBotsRemoved.subscribe((b) => removed.push(...b))
            );
            sub.add(
                partition.onBotsUpdated.subscribe((b) => updated.push(...b))
            );
            sub.add(
                partition.onStateUpdated
                    .pipe(skip(1))
                    .subscribe((e) => updates.push(e))
            );
        }
    });
});
