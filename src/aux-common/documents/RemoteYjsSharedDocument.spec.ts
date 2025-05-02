/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { skip, Subject, Subscription } from 'rxjs';
import { Map as YMap, Text as YText } from 'yjs';
import { waitAsync } from '../test/TestHelpers';
import { createDocFromUpdates, getUpdates } from '../test/YjsTestHelpers';
import type {
    AddUpdatesMessage,
    ReceiveDeviceActionMessage,
    UpdatesReceivedMessage,
    WatchBranchResultMessage,
} from '../websockets';
import { InstRecordsClient, MemoryConnectionClient } from '../websockets';
import type { Action, CurrentVersion, StatusUpdate } from '../common';
import type { PartitionAuthRequest } from '../partitions/PartitionAuthSource';
import { PartitionAuthSource } from '../partitions/PartitionAuthSource';
import { RemoteYjsSharedDocument } from './RemoteYjsSharedDocument';
import type { SharedDocumentConfig } from './SharedDocumentConfig';
import { testDocumentImplementation } from './test/DocumentTests';
import { fromByteArray } from 'base64-js';

console.log = jest.fn();

describe('RemoteYjsSharedDocument', () => {
    const recordNameCases = [[null as any] as const, ['testRecord'] as const];

    describe.each(recordNameCases)('record name: %s', (recordName) => {
        testDocumentImplementation(async () => {
            const connection = new MemoryConnectionClient();
            const client = new InstRecordsClient(connection);
            connection.connect();
            const authSource = new PartitionAuthSource();
            return new RemoteYjsSharedDocument(client, authSource, {
                recordName: recordName,
                inst: 'inst',
                branch: 'testBranch',
            });
        });
        // testPartitionImplementation(
        //     async () => {
        //         let update: Uint8Array | null = null;

        //         const doc = new Doc();
        //         const map = doc.getMap('__test');

        //         doc.on('update', (u: Uint8Array) => {
        //             update = u;
        //         });
        //         doc.transact(() => {
        //             map.set('abc', 123);
        //         });

        //         if (!update) {
        //             throw new Error('Unable to get update!');
        //         }

        //         const connection = new MemoryConnectionClient();
        //         const addAtoms = new BehaviorSubject<AddUpdatesMessage>({
        //             type: 'repo/add_updates',
        //             recordName: recordName,
        //             inst: 'inst',
        //             branch: 'testBranch',
        //             updates: [fromByteArray(update)],
        //             initial: true,
        //         });
        //         connection.events.set('repo/add_updates', addAtoms);

        //         const client = new InstRecordsClient(connection);
        //         connection.connect();

        //         return new RemoteYjsPartitionImpl(
        //             client,
        //             new PartitionAuthSource(),
        //             {
        //                 type: 'remote_yjs',
        //                 recordName: recordName,
        //                 inst: 'inst',
        //                 branch: 'testBranch',
        //                 host: 'testHost',
        //             }
        //         );
        //     },
        //     true,
        //     true
        // );

        describe('connection', () => {
            let connection: MemoryConnectionClient;
            let client: InstRecordsClient;
            let document: RemoteYjsSharedDocument;
            let receiveEvent: Subject<ReceiveDeviceActionMessage>;
            let addAtoms: Subject<AddUpdatesMessage>;
            let updatesReceived: Subject<UpdatesReceivedMessage>;
            let watchBranchResult: Subject<WatchBranchResultMessage>;
            let errors: any[];
            let version: CurrentVersion;
            let sub: Subscription;
            let authSource: PartitionAuthSource;

            beforeEach(async () => {
                connection = new MemoryConnectionClient();
                receiveEvent = new Subject<ReceiveDeviceActionMessage>();
                addAtoms = new Subject<AddUpdatesMessage>();
                updatesReceived = new Subject<UpdatesReceivedMessage>();
                watchBranchResult = new Subject();
                connection.events.set('repo/receive_action', receiveEvent);
                connection.events.set('repo/add_updates', addAtoms);
                connection.events.set('repo/updates_received', updatesReceived);
                connection.events.set(
                    'repo/watch_branch_result',
                    watchBranchResult
                );
                client = new InstRecordsClient(connection);
                connection.connect();
                sub = new Subscription();
                authSource = new PartitionAuthSource();

                errors = [];

                setupPartition({
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                });
            });

            afterEach(() => {
                sub.unsubscribe();
            });

            it('should send a WATCH_BRANCH event to the server', async () => {
                setupPartition({
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                });

                document.connect();

                expect(connection.sentMessages).toEqual([
                    {
                        type: 'repo/watch_branch',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                    },
                ]);
            });

            it('should send the sync event after the updates have been processed', async () => {
                setupPartition({
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                });

                let events: (StatusUpdate | string)[] = [];
                document.onStatusUpdated.subscribe((s) => {
                    if (s.type === 'sync') {
                        events.push(s);
                    }
                });
                document.doc.on('update', (u: Uint8Array) => {
                    events.push(fromByteArray(u));
                });

                const updates = [
                    ...getUpdates((doc, bots) => {
                        bots.set('bot1', new YMap([['tag1', 'abc']]));
                    }),
                    ...getUpdates((doc, bots) => {
                        bots.set('bot2', new YMap([['tag2', 'def']]));
                    }),
                    ...getUpdates((doc, bots, masks) => {
                        masks.set('bot3:tag3', new YText('ghi'));
                    }),
                    ...getUpdates((doc, bots, masks) => {
                        masks.set('bot4:tag4', new YText('jfk'));
                    }),
                    ...getUpdates((doc, bots, masks) => {
                        masks.set('bot5:tag5', new YText('lmn'));
                    }),
                ];

                document.connect();

                await waitAsync();

                addAtoms.next({
                    type: 'repo/add_updates',
                    recordName: recordName,
                    inst: 'inst',
                    branch: 'testBranch',
                    updates,
                    initial: true,
                });

                await waitAsync();

                expect(events).toEqual([
                    ...updates,
                    {
                        type: 'sync',
                        synced: true,
                    },
                ]);
            });

            // describe('remote events', () => {
            //     it('should send the remote event to the server', async () => {
            //         await partition.sendRemoteEvents([
            //             remote(
            //                 {
            //                     type: 'def',
            //                 },
            //                 {
            //                     connectionId: 'device',
            //                 }
            //             ),
            //         ]);

            //         expect(connection.sentMessages).toEqual([
            //             {
            //                 type: 'repo/send_action',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 action: remote(
            //                     {
            //                         type: 'def',
            //                     },
            //                     {
            //                         connectionId: 'device',
            //                     }
            //                 ),
            //             },
            //         ]);
            //     });

            //     it('should not send the remote event if remote events are disabled', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             remoteEvents: false,
            //         });

            //         await partition.sendRemoteEvents([
            //             remote(
            //                 {
            //                     type: 'def',
            //                 },
            //                 {
            //                     connectionId: 'device',
            //                 }
            //             ),
            //         ]);

            //         expect(connection.sentMessages).toEqual([]);
            //     });

            //     it('should listen for device events from the connection', async () => {
            //         let events = [] as Action[];
            //         partition.onEvents.subscribe((e) => events.push(...e));

            //         const action = device(
            //             connectionInfo('username', 'device', 'session'),
            //             {
            //                 type: 'abc',
            //             }
            //         );
            //         partition.connect();

            //         receiveEvent.next({
            //             type: 'repo/receive_action',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             action: action,
            //         });

            //         await waitAsync();

            //         expect(events).toEqual([action]);
            //     });

            //     it('should not send events when in readOnly mode', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             readOnly: true,
            //         });

            //         await partition.sendRemoteEvents([
            //             remote(
            //                 {
            //                     type: 'def',
            //                 },
            //                 {
            //                     connectionId: 'device',
            //                 }
            //             ),
            //         ]);

            //         expect(connection.sentMessages).toEqual([]);
            //     });

            //     it('should not send events when in static mode', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             static: true,
            //         });

            //         await partition.sendRemoteEvents([
            //             remote(
            //                 {
            //                     type: 'def',
            //                 },
            //                 {
            //                     connectionId: 'device',
            //                 }
            //             ),
            //         ]);

            //         expect(connection.sentMessages).toEqual([]);
            //     });

            //     it('should not become synced when an event is received', async () => {
            //         let events = [] as Action[];
            //         partition.onEvents.subscribe((e) => events.push(...e));

            //         const action = device(
            //             connectionInfo('username', 'device', 'session'),
            //             {
            //                 type: 'abc',
            //             }
            //         );

            //         let statuses: StatusUpdate[] = [];
            //         sub.add(
            //             partition.onStatusUpdated.subscribe((update) =>
            //                 statuses.push(update)
            //             )
            //         );

            //         partition.connect();

            //         receiveEvent.next({
            //             type: 'repo/receive_action',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             action: action,
            //         });

            //         await waitAsync();

            //         expect(statuses).toEqual([
            //             {
            //                 type: 'connection',
            //                 connected: true,
            //             },
            //             expect.objectContaining({
            //                 type: 'authentication',
            //                 authenticated: true,
            //             }),
            //         ]);
            //     });

            //     describe('device', () => {
            //         it('should set the playerId and taskId on the inner event', async () => {
            //             let events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             const action = device(
            //                 connectionInfo('username', 'device', 'session'),
            //                 {
            //                     type: 'abc',
            //                 },
            //                 'task1'
            //             );
            //             partition.connect();

            //             receiveEvent.next({
            //                 type: 'repo/receive_action',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 action: action,
            //             });

            //             await waitAsync();

            //             expect(events).not.toEqual([action]);
            //             expect(events).toEqual([
            //                 device(
            //                     connectionInfo('username', 'device', 'session'),
            //                     {
            //                         type: 'abc',
            //                         taskId: 'task1',
            //                         playerId: 'session',
            //                     } as AsyncAction,
            //                     'task1'
            //                 ),
            //             ]);
            //         });
            //     });

            //     describe('action', () => {
            //         it('should translate a remote shout to a onRemoteWhisper event', async () => {
            //             let events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             partition.connect();

            //             const info1 = connectionInfo(
            //                 'info1Username',
            //                 'info1DeviceId',
            //                 'info1SessionId'
            //             );
            //             receiveEvent.next({
            //                 type: 'repo/receive_action',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 action: {
            //                     type: 'device',
            //                     connection: info1,
            //                     event: action('eventName', null, null, {
            //                         abc: 'def',
            //                     }),
            //                 },
            //             });

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 action(ON_REMOTE_DATA_ACTION_NAME, null, null, {
            //                     name: 'eventName',
            //                     that: { abc: 'def' },
            //                     remoteId: 'info1SessionId',
            //                 }),
            //                 action(ON_REMOTE_WHISPER_ACTION_NAME, null, null, {
            //                     name: 'eventName',
            //                     that: { abc: 'def' },
            //                     playerId: 'info1SessionId',
            //                 }),
            //             ]);
            //         });

            //         it('should ignore the bot IDs and userId', async () => {
            //             let events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             partition.connect();

            //             const info1 = connectionInfo(
            //                 'info1Username',
            //                 'info1DeviceId',
            //                 'info1SessionId'
            //             );
            //             receiveEvent.next({
            //                 type: 'repo/receive_action',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 action: {
            //                     type: 'device',
            //                     connection: info1,
            //                     event: action('eventName', ['abc'], 'userId', {
            //                         abc: 'def',
            //                     }),
            //                 },
            //             });

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 action(ON_REMOTE_DATA_ACTION_NAME, null, null, {
            //                     name: 'eventName',
            //                     that: { abc: 'def' },
            //                     remoteId: 'info1SessionId',
            //                 }),
            //                 action(ON_REMOTE_WHISPER_ACTION_NAME, null, null, {
            //                     name: 'eventName',
            //                     that: { abc: 'def' },
            //                     playerId: 'info1SessionId',
            //                 }),
            //             ]);
            //         });
            //     });

            //     describe('get_remote_count', () => {
            //         it('should send a repo/count_connections event to the server', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });
            //             const connectionCount =
            //                 new Subject<ConnectionCountMessage>();
            //             connection.events.set(
            //                 'repo/connection_count',
            //                 connectionCount
            //             );

            //             partition.connect();

            //             await waitAsync();

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     getRemoteCount(recordName, 'inst', 'myBranch'),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             expect(connection.sentMessages).toContainEqual({
            //                 type: 'repo/connection_count',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'myBranch',
            //             });

            //             connectionCount.next({
            //                 type: 'repo/connection_count',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'myBranch',
            //                 count: 20,
            //             });

            //             await waitAsync();

            //             expect(events).toEqual([asyncResult('task1', 20)]);
            //         });
            //     });

            //     describe('list_inst_updates', () => {
            //         it('should send a list_inst_updates event to the server', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });
            //             const addUpdates = new Subject<AddUpdatesMessage>();
            //             connection.events.set('repo/add_updates', addUpdates);

            //             partition.connect();

            //             await waitAsync();

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     listInstUpdates(),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             expect(connection.sentMessages).toContainEqual({
            //                 type: 'repo/get_updates',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //             });

            //             addUpdates.next({
            //                 type: 'repo/add_updates',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 updates: ['abc', 'def'],
            //             });

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 asyncResult('task1', [
            //                     {
            //                         id: 0,
            //                         update: 'abc',
            //                     },
            //                     {
            //                         id: 1,
            //                         update: 'def',
            //                     },
            //                 ]),
            //             ]);
            //         });
            //     });

            //     describe('get_inst_state_from_updates', () => {
            //         it('should return the state matching the given updates', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });

            //             partition.connect();

            //             await partition.applyEvents([
            //                 botAdded(
            //                     createBot('test1', {
            //                         abc: 'def',
            //                         num: 123,
            //                     })
            //                 ),
            //             ]);

            //             await partition.applyEvents([
            //                 botUpdated('test1', {
            //                     tags: {
            //                         num: 456,
            //                     },
            //                 }),
            //             ]);

            //             await waitAsync();

            //             const updates = connection.sentMessages.filter(
            //                 (message) => message.type === 'repo/add_updates'
            //             );
            //             expect(updates).toHaveLength(2);

            //             const instUpdates = flatMap(
            //                 updates,
            //                 (u) => (u as AddUpdatesMessage).updates
            //             ).map((u, i) => ({
            //                 id: i,
            //                 update: u,
            //             }));

            //             const instTimestamps = flatMap(
            //                 updates,
            //                 (u) => (u as AddUpdatesMessage).timestamps ?? []
            //             );

            //             const finalUpdates = instUpdates.map((u) => ({
            //                 id: u.id,
            //                 update: u.update,
            //                 timestamp: instTimestamps[u.id],
            //             }));

            //             expect(instUpdates).toHaveLength(2);

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     getInstStateFromUpdates(
            //                         finalUpdates.slice(0, 1)
            //                     ),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //                 remote(
            //                     getInstStateFromUpdates(finalUpdates),
            //                     undefined,
            //                     undefined,
            //                     'task2'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 asyncResult(
            //                     'task1',
            //                     {
            //                         test1: createBot('test1', {
            //                             abc: 'def',
            //                             num: 123,
            //                         }),
            //                     },
            //                     false
            //                 ),
            //                 asyncResult(
            //                     'task2',
            //                     {
            //                         test1: createBot('test1', {
            //                             abc: 'def',
            //                             num: 456,
            //                         }),
            //                     },
            //                     false
            //                 ),
            //             ]);
            //         });
            //     });

            //     describe('create_initialization_update', () => {
            //         it('should return an update that represents the bots', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });

            //             partition.connect();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             await waitAsync();

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     createInitializationUpdate([
            //                         createBot('test1', {
            //                             abc: 'def',
            //                         }),
            //                         createBot('test2', {
            //                             num: 123,
            //                         }),
            //                     ]),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 asyncResult(
            //                     'task1',
            //                     {
            //                         id: 0,
            //                         timestamp: expect.any(Number),
            //                         update: expect.any(String),
            //                     },
            //                     false
            //                 ),
            //             ]);

            //             const event = events[0] as any;
            //             const update = event.result.update;

            //             const validationPartition = new YjsPartitionImpl({
            //                 type: 'yjs',
            //             });
            //             applyUpdate(
            //                 validationPartition.doc,
            //                 toByteArray(update)
            //             );

            //             expect(validationPartition.state).toEqual({
            //                 test1: createBot('test1', {
            //                     abc: 'def',
            //                 }),
            //                 test2: createBot('test2', {
            //                     num: 123,
            //                 }),
            //             });
            //         });
            //     });

            //     describe('apply_updates_to_inst', () => {
            //         it('should add the update to the inst', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });

            //             partition.connect();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             const testPartition = new YjsPartitionImpl({
            //                 type: 'yjs',
            //             });
            //             const updates = [] as InstUpdate[];

            //             testPartition.doc.on('update', (update: Uint8Array) => {
            //                 updates.push({
            //                     id: updates.length,
            //                     timestamp: Date.now(),
            //                     update: fromByteArray(update),
            //                 });
            //             });

            //             testPartition.applyEvents([
            //                 botAdded(
            //                     createBot('test1', {
            //                         abc: 'def',
            //                     })
            //                 ),
            //                 botAdded(
            //                     createBot('test2', {
            //                         num: 124,
            //                     })
            //                 ),
            //             ]);

            //             await waitAsync();

            //             expect(updates).not.toEqual([]);

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     applyUpdatesToInst([...updates]),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 asyncResult('task1', null, false),
            //             ]);

            //             expect(partition.state).toEqual({
            //                 test1: createBot('test1', {
            //                     abc: 'def',
            //                 }),
            //                 test2: createBot('test2', {
            //                     num: 124,
            //                 }),
            //             });

            //             const addedAtoms = connection.sentMessages.filter(
            //                 (m) => m.type === 'repo/add_updates'
            //             );
            //             expect(addedAtoms).toEqual([
            //                 {
            //                     type: 'repo/add_updates',
            //                     recordName: recordName,
            //                     inst: 'inst',
            //                     branch: 'testBranch',
            //                     updates: updates.map((u) => u.update),
            //                     updateId: 1,
            //                 },
            //             ]);
            //         });

            //         it('should support updates from v13.5.24 of yjs', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });

            //             partition.connect();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             await waitAsync();

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     applyUpdatesToInst([
            //                         {
            //                             id: 0,
            //                             timestamp: 0,
            //                             update: 'AQLNrtWDBQAnAQRib3RzBGJvdDEBKADNrtWDBQAEdGFnMQF3A2FiYwA=',
            //                         },
            //                     ]),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 asyncResult('task1', null, false),
            //             ]);

            //             expect(partition.state).toEqual({
            //                 bot1: createBot('bot1', {
            //                     tag1: 'abc',
            //                 }),
            //             });
            //         });
            //     });

            //     describe('get_current_inst_update', () => {
            //         it('should return the current doc state as an update', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });

            //             partition.connect();

            //             await partition.applyEvents([
            //                 botAdded(
            //                     createBot('test1', {
            //                         abc: 'def',
            //                     })
            //                 ),
            //                 botAdded(
            //                     createBot('test2', {
            //                         num: 124,
            //                     })
            //                 ),
            //             ]);

            //             await waitAsync();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             await partition.sendRemoteEvents([
            //                 remote(
            //                     getCurrentInstUpdate(),
            //                     undefined,
            //                     undefined,
            //                     'task1'
            //                 ),
            //             ]);

            //             await waitAsync();

            //             const expectedUpdate = fromByteArray(
            //                 encodeStateAsUpdate(partition.doc)
            //             );

            //             expect(events).toEqual([
            //                 asyncResult(
            //                     'task1',
            //                     {
            //                         id: 0,
            //                         timestamp: expect.any(Number),
            //                         update: expectedUpdate,
            //                     },
            //                     false
            //                 ),
            //             ]);
            //         });
            //     });

            //     describe('rate_limit_exceeded', () => {
            //         it('should emit a shout when the event is recieved', async () => {
            //             setupPartition({
            //                 type: 'remote_yjs',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 host: 'testHost',
            //             });

            //             partition.space = 'test';
            //             const rateLimitExceeded =
            //                 new Subject<RateLimitExceededMessage>();
            //             connection.events.set(
            //                 'rate_limit_exceeded',
            //                 rateLimitExceeded
            //             );

            //             partition.connect();

            //             const events = [] as Action[];
            //             partition.onEvents.subscribe((e) => events.push(...e));

            //             await waitAsync();

            //             rateLimitExceeded.next({
            //                 type: 'rate_limit_exceeded',
            //                 retryAfter: 123,
            //                 totalHits: 999,
            //             });

            //             await waitAsync();

            //             expect(events).toEqual([
            //                 action(
            //                     ON_SPACE_RATE_LIMIT_EXCEEDED_ACTION_NAME,
            //                     undefined,
            //                     undefined,
            //                     {
            //                         space: 'test',
            //                     }
            //                 ),
            //             ]);
            //         });
            //     });
            // });

            describe('remote updates', () => {
                it('should add the given updates to the tree and update the state', async () => {
                    document.connect();

                    const updates = getUpdates((doc) => {
                        const test = doc.getMap('test');
                        test.set('abc', 123);
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });
                    await waitAsync();

                    expect(document.doc.getMap('test').toJSON()).toEqual({
                        abc: 123,
                    });
                });
            });

            describe('updates', () => {
                it('should not send new updates to the server if in readOnly mode', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        readOnly: true,
                    });

                    document.connect();

                    document.doc.transact(() => {
                        const test = document.doc.getMap('test');
                        test.set('abc', 123);
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                });

                it('should not send new updates to the server if in static mode', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        static: true,
                    });

                    document.connect();

                    document.doc.transact(() => {
                        const test = document.doc.getMap('test');
                        test.set('abc', 123);
                    });
                    await waitAsync();

                    expect(connection.sentMessages.slice(1)).toEqual([]);
                });

                it('should handle an ADD_UPDATES event without any updates', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        static: true,
                    });

                    document.connect();

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates: [],
                    });
                    await waitAsync();

                    expect(errors).toEqual([]);
                });

                it('should send new updates to the server', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                    });

                    document.connect();

                    document.doc.transact(() => {
                        const test = document.doc.getMap('test');
                        test.set('abc', 123);
                    });
                    await waitAsync();

                    expect(connection.sentMessages.slice(1).length).toBe(1);

                    const addUpdatesMessage = connection.sentMessages[1];
                    expect(addUpdatesMessage.type).toEqual('repo/add_updates');
                    expect((addUpdatesMessage as any).branch).toEqual(
                        'testBranch'
                    );

                    const doc = createDocFromUpdates(
                        (addUpdatesMessage as any).updates
                    );
                    const bots = doc.getMap('test');
                    expect(bots.size).toBe(1);

                    const val: any = bots.get('abc');
                    expect(val).toBe(123);
                });

                it('should be able to load existing updates', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                    });

                    document.connect();

                    const updates = getUpdates((doc) => {
                        const bots = doc.getMap('test');
                        bots.set(
                            'bot1',
                            new YMap([
                                ['string', 'abc'],
                                ['number', 123],
                                ['boolean', true],
                                [
                                    'object',
                                    {
                                        abc: 'def',
                                    },
                                ],
                                ['array', [123, true]],
                                ['null', null],
                                ['undefined', undefined],
                                ['empty', ''],
                            ])
                        );
                        bots.set(
                            'bot2',
                            new YMap([
                                ['string', 'abc'],
                                ['number', 123],
                                ['boolean', true],
                                [
                                    'object',
                                    {
                                        abc: 'def',
                                    },
                                ],
                                ['array', [123, true]],
                                ['null', null],
                                ['undefined', undefined],
                                ['empty', ''],
                            ])
                        );
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });

                    await waitAsync();

                    expect(document.getMap('test').toJSON()).toEqual({
                        bot1: {
                            string: 'abc',
                            number: 123,
                            boolean: true,
                            object: {
                                abc: 'def',
                            },
                            array: [123, true],
                            empty: '',
                            null: null,
                            undefined: undefined,
                        },
                        bot2: {
                            string: 'abc',
                            number: 123,
                            boolean: true,
                            object: {
                                abc: 'def',
                            },
                            array: [123, true],
                            empty: '',
                            null: null,
                            undefined: undefined,
                        },
                    });
                });

                it('should not try to send remote updates to the server', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                    });

                    document.connect();

                    const updates = getUpdates((doc, bots) => {
                        bots.set('bot1', new YMap([['tag1', 'abc']]));
                    });

                    addAtoms.next({
                        type: 'repo/add_updates',
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        updates,
                        initial: true,
                    });

                    await waitAsync();

                    expect(connection.sentMessages.slice(1).length).toBe(0);
                });
                //     it('case1: should handle an update that includes updates in addition to adding a bot', async () => {
                //         document.connect();

                //         const botId = '402ccb16-d402-4404-b1ad-7ad73cc29772';
                //         const tag = 'ResizeHandle';
                //         const bots = document.doc.getMap('bots');
                //         let index = 0;

                //         for (let update of case1) {
                //             addAtoms.next({
                //                 type: 'repo/add_updates',
                //                 recordName: recordName,
                //                 inst: 'inst',
                //                 branch: 'testBranch',
                //                 updates: [update],
                //                 initial: true,
                //             });

                //             await waitAsync();

                //             const expectedBot = bots.get(botId) as YMap<any>;
                //             const computedBot = document.state[botId];

                //             if (!computedBot || !expectedBot) {
                //                 continue;
                //             }
                //             const expectedValue = expectedBot
                //                 .get('ResizeHandle')
                //                 .toString();
                //             const calculatedValue = computedBot.tags[tag];

                //             if (expectedValue !== calculatedValue) {
                //                 console.log('Update Index:', index);
                //                 expect(calculatedValue).toEqual(expectedValue);
                //             }

                //             index += 1;
                //         }
                //     });
                // });
            });

            describe('errors', () => {
                describe('max_size_reached', () => {
                    // it('should emit a onSpaceMaxSizeReached shout', async () => {
                    //     let events = [] as Action[];
                    //     document.onEvents.subscribe((e) => events.push(...e));
                    //     // document.space = 'shared';
                    //     document.connect();
                    //     updatesReceived.next({
                    //         type: 'repo/updates_received',
                    //         recordName: recordName,
                    //         inst: 'inst',
                    //         branch: 'testBranch',
                    //         updateId: 1,
                    //         errorCode: 'max_size_reached',
                    //         maxBranchSizeInBytes: 10,
                    //         neededBranchSizeInBytes: 11,
                    //     });
                    //     await waitAsync();
                    //     expect(events).toEqual([
                    //         action(ON_SPACE_MAX_SIZE_REACHED, null, null, {
                    //             space: 'shared',
                    //             maxSizeInBytes: 10,
                    //             neededSizeInBytes: 11,
                    //         }),
                    //     ]);
                    // });
                    // it('should only emit the onSpaceMaxSizeReached shout once', async () => {
                    //     let events = [] as Action[];
                    //     document.onEvents.subscribe((e) => events.push(...e));
                    //     // document.space = 'shared';
                    //     document.connect();
                    //     updatesReceived.next({
                    //         type: 'repo/updates_received',
                    //         recordName: recordName,
                    //         inst: 'inst',
                    //         branch: 'testBranch',
                    //         updateId: 1,
                    //         errorCode: 'max_size_reached',
                    //         maxBranchSizeInBytes: 10,
                    //         neededBranchSizeInBytes: 11,
                    //     });
                    //     await waitAsync();
                    //     updatesReceived.next({
                    //         type: 'repo/updates_received',
                    //         recordName: recordName,
                    //         inst: 'inst',
                    //         branch: 'testBranch',
                    //         updateId: 2,
                    //         errorCode: 'max_size_reached',
                    //         maxBranchSizeInBytes: 25,
                    //         neededBranchSizeInBytes: 99,
                    //     });
                    //     await waitAsync();
                    //     expect(events).toEqual([
                    //         action(ON_SPACE_MAX_SIZE_REACHED, null, null, {
                    //             space: 'shared',
                    //             maxSizeInBytes: 10,
                    //             neededSizeInBytes: 11,
                    //         }),
                    //     ]);
                    // });
                });

                const errorCodeCases = [
                    ['not_authorized'] as const,
                    ['subscription_limit_reached'] as const,
                    ['inst_not_found'] as const,
                    ['record_not_found'] as const,
                    ['invalid_record_key'] as const,
                    ['invalid_token'] as const,
                    ['unacceptable_connection_id'] as const,
                    ['unacceptable_connection_token'] as const,
                    ['user_is_banned'] as const,
                    ['not_logged_in'] as const,
                    ['session_expired'] as const,
                ];
                describe.each(errorCodeCases)('%s', (errorCode) => {
                    describe('error', () => {
                        it('should issue a authorization false shout when the error is unauthorized', async () => {
                            let events = [] as Action[];
                            document.onEvents.subscribe((e) =>
                                events.push(...e)
                            );
                            // document.space = 'shared';

                            let statuses: StatusUpdate[] = [];
                            document.onStatusUpdated.subscribe((s) =>
                                statuses.push(s)
                            );

                            document.connect();

                            connection.onError.next({
                                success: false,
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                errorCode: errorCode,
                                errorMessage: 'Not authorized',
                            });
                            await waitAsync();

                            expect(statuses).toEqual([
                                {
                                    type: 'connection',
                                    connected: true,
                                },
                                {
                                    type: 'authentication',
                                    authenticated: true,
                                },
                                {
                                    type: 'authorization',
                                    authorized: false,
                                    error: {
                                        success: false,
                                        recordName: recordName,
                                        inst: 'inst',
                                        branch: 'testBranch',
                                        errorCode: errorCode,
                                        errorMessage: 'Not authorized',
                                    },
                                },
                            ]);
                        });

                        it('should issue a authorization request when the error is unauthorized', async () => {
                            let authRequests = [] as PartitionAuthRequest[];
                            authSource.onAuthRequest.subscribe((e) =>
                                authRequests.push(e)
                            );
                            // document.space = 'shared';

                            let statuses: StatusUpdate[] = [];
                            document.onStatusUpdated.subscribe((s) =>
                                statuses.push(s)
                            );

                            document.connect();

                            connection.onError.next({
                                success: false,
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                errorCode: errorCode,
                                errorMessage: 'Not authorized',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: 'inst',
                                    action: 'read',
                                    subjectType: 'user',
                                    subjectId: 'testId',
                                },
                            });
                            await waitAsync();

                            expect(authRequests).toEqual([
                                {
                                    type: 'request',
                                    origin: connection.origin,
                                    kind: 'not_authorized',
                                    errorCode: errorCode,
                                    errorMessage: 'Not authorized',
                                    resource: {
                                        type: 'inst',
                                        recordName: recordName,
                                        inst: 'inst',
                                        branch: 'testBranch',
                                    },
                                    reason: {
                                        type: 'missing_permission',
                                        recordName,
                                        resourceKind: 'inst',
                                        resourceId: 'inst',
                                        action: 'read',
                                        subjectType: 'user',
                                        subjectId: 'testId',
                                    },
                                },
                            ]);
                        });
                    });

                    describe('repo/watch_branch_result', () => {
                        it('should issue a authorization false shout when the error is unauthorized', async () => {
                            let events = [] as Action[];
                            document.onEvents.subscribe((e) =>
                                events.push(...e)
                            );
                            // document.space = 'shared';

                            let statuses: StatusUpdate[] = [];
                            document.onStatusUpdated.subscribe((s) =>
                                statuses.push(s)
                            );

                            document.connect();

                            watchBranchResult.next({
                                type: 'repo/watch_branch_result',
                                success: false,
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                errorCode: errorCode,
                                errorMessage: 'Not authorized',
                            });
                            await waitAsync();

                            expect(statuses).toEqual([
                                {
                                    type: 'connection',
                                    connected: true,
                                },
                                {
                                    type: 'authentication',
                                    authenticated: true,
                                },
                                {
                                    type: 'authorization',
                                    authorized: false,
                                    error: {
                                        success: false,
                                        recordName: recordName,
                                        inst: 'inst',
                                        branch: 'testBranch',
                                        errorCode: errorCode,
                                        errorMessage: 'Not authorized',
                                    },
                                },
                            ]);
                        });

                        it('should issue a authorization request when the error is unauthorized', async () => {
                            let authRequests = [] as PartitionAuthRequest[];
                            authSource.onAuthRequest.subscribe((e) =>
                                authRequests.push(e)
                            );
                            // document.space = 'shared';

                            let statuses: StatusUpdate[] = [];
                            document.onStatusUpdated.subscribe((s) =>
                                statuses.push(s)
                            );

                            document.connect();

                            watchBranchResult.next({
                                type: 'repo/watch_branch_result',
                                success: false,
                                recordName: recordName,
                                inst: 'inst',
                                branch: 'testBranch',
                                errorCode: errorCode,
                                errorMessage: 'Not authorized',
                                reason: {
                                    type: 'missing_permission',
                                    recordName,
                                    resourceKind: 'inst',
                                    resourceId: 'inst',
                                    action: 'read',
                                    subjectType: 'user',
                                    subjectId: 'testId',
                                },
                            });
                            await waitAsync();

                            expect(authRequests).toEqual([
                                {
                                    type: 'request',
                                    origin: connection.origin,
                                    kind: 'not_authorized',
                                    errorCode: errorCode,
                                    errorMessage: 'Not authorized',
                                    resource: {
                                        type: 'inst',
                                        recordName: recordName,
                                        inst: 'inst',
                                        branch: 'testBranch',
                                    },
                                    reason: {
                                        type: 'missing_permission',
                                        recordName,
                                        resourceKind: 'inst',
                                        resourceId: 'inst',
                                        action: 'read',
                                        subjectType: 'user',
                                        subjectId: 'testId',
                                    },
                                },
                            ]);
                        });
                    });
                });
            });

            describe('static mode', () => {
                it('should send a GET_UPDATES event when in static mode', async () => {
                    setupPartition({
                        recordName: recordName,
                        inst: 'inst',
                        branch: 'testBranch',
                        static: true,
                    });

                    expect(connection.sentMessages).toEqual([]);
                    document.connect();

                    await waitAsync();

                    expect(connection.sentMessages).toEqual([
                        {
                            type: 'repo/get_updates',
                            recordName: recordName,
                            inst: 'inst',
                            branch: 'testBranch',
                        },
                    ]);
                });

                // it('should not apply updates to the causal tree', async () => {
                //     setupPartition({
                //         recordName: recordName,
                //         inst: 'inst',
                //         branch: 'testBranch',
                //         static: true,
                //     });

                //     expect(connection.sentMessages).toEqual([]);
                //     document.connect();

                //     const ret = await document.applyEvents([
                //         botAdded(
                //             createBot('test', {
                //                 abc: 'def',
                //             })
                //         ),
                //     ]);

                //     expect(ret).toEqual([]);
                //     expect(document.state).toEqual({});
                // });

                // it('should load the initial state properly', async () => {
                //     setupPartition({
                //         recordName: recordName,
                //         inst: 'inst',
                //         branch: 'testBranch',
                //         static: true,
                //     });

                //     const updates = getUpdates((doc, bots) => {
                //         bots.set('bot1', new YMap([['tag1', 'abc']]));
                //     });

                //     document.connect();

                //     addAtoms.next({
                //         type: 'repo/add_updates',
                //         recordName: recordName,
                //         inst: 'inst',
                //         branch: 'testBranch',
                //         updates,
                //     });

                //     expect(document.state).toEqual({
                //         bot1: createBot('bot1', {
                //             tag1: 'abc',
                //         }),
                //     });
                // });
            });

            // describe('skip initial load', () => {
            //     it('should not send a GET_UPDATES event', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             skipInitialLoad: true,
            //         });

            //         expect(connection.sentMessages).toEqual([]);
            //         document.connect();

            //         await waitAsync();

            //         expect(connection.sentMessages).toEqual([]);
            //     });

            //     it('should apply updates to the causal tree', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             skipInitialLoad: true,
            //         });

            //         expect(connection.sentMessages).toEqual([]);
            //         document.connect();

            //         const ret = await document.applyEvents([
            //             botAdded(
            //                 createBot('test', {
            //                     abc: 'def',
            //                 })
            //             ),
            //         ]);

            //         expect(ret).toEqual([]);
            //         expect(document.state).toEqual({
            //             test: createBot('test', {
            //                 abc: 'def',
            //             }),
            //         });
            //     });

            //     it('should send the correct connection events', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             skipInitialLoad: true,
            //         });

            //         connection.info = {
            //             connectionId: 'testConnectionId',
            //             sessionId: 'testSessionId',
            //             userId: 'testUserId',
            //         };

            //         const promise = firstValueFrom(
            //             document.onStatusUpdated.pipe(
            //                 takeWhile((update) => update.type !== 'sync', true),
            //                 bufferCount(4)
            //             )
            //         );

            //         document.connect();

            //         const update = await promise;

            //         expect(update).toEqual([
            //             {
            //                 type: 'connection',
            //                 connected: true,
            //             },
            //             expect.objectContaining({
            //                 type: 'authentication',
            //                 authenticated: true,
            //                 info: {
            //                     connectionId: 'testConnectionId',
            //                     sessionId: 'testSessionId',
            //                     userId: 'testUserId',
            //                 },
            //             }),
            //             expect.objectContaining({
            //                 type: 'authorization',
            //                 authorized: true,
            //             }),
            //             {
            //                 type: 'sync',
            //                 synced: true,
            //             },
            //         ]);
            //     });

            //     it('should use the connection indicator to infer the authentication info', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             skipInitialLoad: true,
            //         });

            //         connection.indicator = {
            //             connectionId: 'testConnectionId',
            //         };

            //         const promise = firstValueFrom(
            //             document.onStatusUpdated.pipe(
            //                 takeWhile((update) => update.type !== 'sync', true),
            //                 bufferCount(4)
            //             )
            //         );

            //         document.connect();

            //         const update = await promise;

            //         expect(update).toEqual([
            //             {
            //                 type: 'connection',
            //                 connected: true,
            //             },
            //             expect.objectContaining({
            //                 type: 'authentication',
            //                 authenticated: true,
            //                 info: {
            //                     connectionId: 'testConnectionId',
            //                     sessionId: null,
            //                     userId: null,
            //                 },
            //             }),
            //             expect.objectContaining({
            //                 type: 'authorization',
            //                 authorized: true,
            //             }),
            //             {
            //                 type: 'sync',
            //                 synced: true,
            //             },
            //         ]);
            //     });

            //     it('should use a default connection ID if the connection has no indicator', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             skipInitialLoad: true,
            //         });

            //         connection.indicator = null;

            //         const promise = firstValueFrom(
            //             document.onStatusUpdated.pipe(
            //                 takeWhile((update) => update.type !== 'sync', true),
            //                 bufferCount(4)
            //             )
            //         );

            //         document.connect();

            //         const update = await promise;

            //         expect(update).toEqual([
            //             {
            //                 type: 'connection',
            //                 connected: true,
            //             },
            //             expect.objectContaining({
            //                 type: 'authentication',
            //                 authenticated: true,
            //                 info: {
            //                     connectionId: 'missing-connection-id',
            //                     sessionId: null,
            //                     userId: null,
            //                 },
            //             }),
            //             expect.objectContaining({
            //                 type: 'authorization',
            //                 authorized: true,
            //             }),
            //             {
            //                 type: 'sync',
            //                 synced: true,
            //             },
            //         ]);
            //     });

            //     it('should connect to the branch if enableCollaboration() is called', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             host: 'testHost',
            //             branch: 'testBranch',
            //             skipInitialLoad: true,
            //         });

            //         document.connect();

            //         await waitAsync();

            //         const ret = await document.applyEvents([
            //             botAdded(
            //                 createBot('test', {
            //                     abc: 'def',
            //                 })
            //             ),
            //         ]);
            //         await waitAsync();

            //         expect(connection.sentMessages).toEqual([]);

            //         let resolved: boolean = false;
            //         document
            //             .enableCollaboration()
            //             .then(() => (resolved = true));

            //         await waitAsync();

            //         expect(connection.sentMessages).toEqual([
            //             {
            //                 type: 'repo/watch_branch',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //             },
            //         ]);

            //         addAtoms.next({
            //             type: 'repo/add_updates',
            //             recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             updates: [],
            //             initial: true,
            //         });

            //         await waitAsync();

            //         expect(resolved).toBe(true);

            //         expect(connection.sentMessages.slice(1)).toEqual([
            //             // Should send the current state to the server
            //             {
            //                 type: 'repo/add_updates',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 updates: [expect.any(String)],
            //                 updateId: 1,
            //             },
            //         ]);

            //         const update = (connection.sentMessages[1] as any)
            //             .updates[0];
            //         expect(
            //             getStateFromUpdates({
            //                 type: 'get_inst_state_from_updates',
            //                 updates: [
            //                     {
            //                         id: 0,
            //                         timestamp: 0,
            //                         update: update,
            //                     },
            //                 ],
            //             })
            //         ).toEqual({
            //             test: createBot('test', {
            //                 abc: 'def',
            //             }),
            //         });
            //     });
            // });

            // describe('temporary', () => {
            //     it('should load the given branch as temporary', async () => {
            //         setupPartition({
            //             type: 'remote_yjs',
            //             recordName: recordName,
            //             inst: 'inst',
            //             branch: 'testBranch',
            //             host: 'testHost',
            //             temporary: true,
            //         });

            //         document.connect();

            //         await waitAsync();

            //         expect(connection.sentMessages).toEqual([
            //             {
            //                 type: 'repo/watch_branch',
            //                 recordName: recordName,
            //                 inst: 'inst',
            //                 branch: 'testBranch',
            //                 temporary: true,
            //             },
            //         ]);
            //     });
            // });

            function setupPartition(config: SharedDocumentConfig) {
                document = new RemoteYjsSharedDocument(
                    client,
                    authSource,
                    config
                );

                sub.add(document);
                sub.add(document.onError.subscribe((e) => errors.push(e)));
                sub.add(
                    document.onVersionUpdated.subscribe((v) => (version = v))
                );
            }
        });
    });
});
