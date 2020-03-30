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
} from '@casual-simulation/causal-trees/core2';
import { remote } from '@casual-simulation/causal-trees';
import { waitAsync } from '../test/TestHelpers';
import { createBot, Bot, UpdatedBot, restoreHistoryMark } from '../bots';
import { CausalRepoHistoryClientPartitionConfig } from './AuxPartitionConfig';
import uuid from 'uuid/v5';

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

                it('should send a restore event to the server with the universe if specified', async () => {
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
                                'universe'
                            )
                        ),
                    ]);

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([
                        {
                            name: RESTORE,
                            data: {
                                branch: 'universe',
                                commit: c1.hash,
                            },
                        },
                    ]);
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
                        auxHistory: true,
                        auxHistoryX: 0,
                        auxLabel: 'commit1',
                        auxLabelSize: 0.5,
                        auxMarkHash: c1.hash,
                        auxPreviousMarkHash: null,
                        auxMarkTime: new Date(1900, 1, 1),
                    }
                ),
                [uuid(c2.hash, COMMIT_ID_NAMESPACE)]: createBot(
                    uuid(c2.hash, COMMIT_ID_NAMESPACE),
                    {
                        auxHistory: true,
                        auxHistoryX: 1,
                        auxLabel: 'commit2',
                        auxLabelSize: 0.5,
                        auxMarkHash: c2.hash,
                        auxPreviousMarkHash: c1.hash,
                        auxMarkTime: new Date(1900, 1, 1),
                    }
                ),
            });
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
            sub.add(partition.onBotsAdded.subscribe(b => added.push(...b)));
            sub.add(partition.onBotsRemoved.subscribe(b => removed.push(...b)));
            sub.add(partition.onBotsUpdated.subscribe(b => updated.push(...b)));
        }
    });
});
