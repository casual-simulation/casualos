import { testPartitionImplementation } from './test/PartitionTests';
import { RemoteCausalRepoPartitionImpl } from './RemoteCausalRepoPartition';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import {
    Atom,
    atom,
    atomId,
    ADD_ATOMS,
    AddAtomsEvent,
    MemoryConnectionClient,
    CausalRepoClient,
    SEND_EVENT,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    RemoveAtomsEvent,
    REMOVE_ATOMS,
} from '@casual-simulation/causal-trees/core2';
import {
    remote,
    DeviceAction,
    device,
    deviceInfo,
} from '@casual-simulation/causal-trees';
import flatMap from 'lodash/flatMap';
import { waitAsync } from '../test/TestHelpers';
import {
    botAdded,
    createBot,
    botUpdated,
    Bot,
    UpdatedBot,
} from '@casual-simulation/aux-common';
import {
    AuxOpType,
    addAuxResults,
    bot,
    tag,
    value,
} from '@casual-simulation/aux-common/aux-format-2';

console.log = jest.fn();

describe('RemoteCausalRepoPartition', () => {
    testPartitionImplementation(async () => {
        const connection = new MemoryConnectionClient();
        const addAtoms = new BehaviorSubject<AddAtomsEvent>({
            branch: 'testBranch',
            atoms: [atom(atomId('a', 1), null, {})],
        });
        connection.events.set(ADD_ATOMS, addAtoms);

        const client = new CausalRepoClient(connection);
        connection.connect();

        return new RemoteCausalRepoPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            client,
            {
                type: 'remote_causal_repo',
                branch: 'testBranch',
                host: 'testHost',
            }
        );
    });

    describe('connection', () => {
        let connection: MemoryConnectionClient;
        let client: CausalRepoClient;
        let partition: RemoteCausalRepoPartitionImpl;
        let receiveEvent: Subject<ReceiveDeviceActionEvent>;
        let addAtoms: Subject<AddAtomsEvent>;
        let removeAtoms: Subject<RemoveAtomsEvent>;
        let added: Bot[];
        let removed: string[];
        let updated: UpdatedBot[];
        let sub: Subscription;

        beforeEach(async () => {
            connection = new MemoryConnectionClient();
            receiveEvent = new Subject<ReceiveDeviceActionEvent>();
            removeAtoms = new Subject<RemoveAtomsEvent>();
            addAtoms = new Subject<AddAtomsEvent>();
            connection.events.set(RECEIVE_EVENT, receiveEvent);
            connection.events.set(REMOVE_ATOMS, removeAtoms);
            connection.events.set(ADD_ATOMS, addAtoms);
            client = new CausalRepoClient(connection);
            connection.connect();
            sub = new Subscription();

            added = [];
            removed = [];
            updated = [];

            partition = new RemoteCausalRepoPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                client,
                {
                    type: 'remote_causal_repo',
                    branch: 'testBranch',
                    host: 'testHost',
                }
            );

            sub.add(partition);
            sub.add(partition.onBotsAdded.subscribe(b => added.push(...b)));
            sub.add(partition.onBotsRemoved.subscribe(b => removed.push(...b)));
            sub.add(partition.onBotsUpdated.subscribe(b => updated.push(...b)));
        });

        afterEach(() => {
            sub.unsubscribe();
        });

        describe('remote events', () => {
            it('should send the remote event to the server', async () => {
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

                expect(connection.sentMessages).toEqual([
                    {
                        name: SEND_EVENT,
                        data: {
                            branch: 'testBranch',
                            action: remote(
                                {
                                    type: 'def',
                                },
                                {
                                    deviceId: 'device',
                                }
                            ),
                        },
                    },
                ]);
            });

            it('should listen for device events from the connection', async () => {
                let events = [] as DeviceAction[];
                partition.onEvents.subscribe(e => events.push(...e));

                const action = device(
                    deviceInfo('username', 'device', 'session'),
                    {
                        type: 'abc',
                    }
                );
                partition.connect();

                receiveEvent.next({
                    branch: 'testBranch',
                    action: action,
                });

                await waitAsync();

                expect(events).toEqual([action]);
            });
        });

        describe('remove atoms', () => {
            it('should remove the given atoms from the tree', async () => {
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot('newBot', {
                            abc: 'def',
                        })
                    ),
                ]);

                const addedAtoms = flatMap(
                    connection.sentMessages.filter(m => m.name === ADD_ATOMS),
                    m => m.data.atoms
                );
                const newBotAtom = addedAtoms.find(
                    a =>
                        a.value.type === AuxOpType.bot &&
                        a.value.id === 'newBot'
                );

                removeAtoms.next({
                    branch: 'testBranch',
                    hashes: [newBotAtom.hash],
                });

                await waitAsync();

                expect(partition.state['newBot']).toBeUndefined();
            });

            it('should send removed atoms to the repo', async () => {
                partition.connect();

                await partition.applyEvents([
                    botAdded(
                        createBot('newBot', {
                            abc: 'def',
                        })
                    ),
                ]);

                await partition.applyEvents([
                    botUpdated('newBot', {
                        tags: {
                            abc: '123',
                        },
                    }),
                ]);

                const addedAtoms = flatMap(
                    connection.sentMessages.filter(m => m.name === ADD_ATOMS),
                    m => m.data.atoms
                );
                const oldValueAtom = addedAtoms.find(
                    a =>
                        a.value.type === AuxOpType.value &&
                        a.value.value === 'def'
                );

                expect(connection.sentMessages).toContainEqual({
                    name: REMOVE_ATOMS,
                    data: {
                        branch: 'testBranch',
                        hashes: [oldValueAtom.hash],
                    },
                });
            });
        });

        describe('remote atoms', () => {
            it('should add the given atoms to the tree and update the state', async () => {
                partition.connect();

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1],
                });
                await waitAsync();

                expect(added).toEqual([
                    createBot('bot1', {
                        tag1: 'abc',
                    }),
                ]);
            });

            it('should merge merge added bots and updates', async () => {
                partition.connect();

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));
                const value2 = atom(atomId('a', 4), tag1, value('newValue'));

                addAtoms.next({
                    branch: 'testBranch',
                    atoms: [bot1, tag1, value1, value2],
                });
                await waitAsync();

                expect(added).toEqual([
                    createBot('bot1', {
                        tag1: 'newValue',
                    }),
                ]);
                expect(removed).toEqual([]);
                expect(updated).toEqual([]);
            });
        });
    });
});
