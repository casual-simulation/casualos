import { testPartitionImplementation } from './test/PartitionTests';
import { RemoteCausalRepoPartitionImpl } from './RemoteCausalRepoPartition';
import { BehaviorSubject, Subject } from 'rxjs';
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
} from '@casual-simulation/causal-trees/core2';
import {
    remote,
    DeviceAction,
    device,
    deviceInfo,
} from '@casual-simulation/causal-trees';
import { waitAsync } from '../test/TestHelpers';

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

    describe('events', () => {
        let connection: MemoryConnectionClient;
        let client: CausalRepoClient;
        let partition: RemoteCausalRepoPartitionImpl;
        let receiveEvent: Subject<ReceiveDeviceActionEvent>;

        beforeEach(async () => {
            connection = new MemoryConnectionClient();
            receiveEvent = new Subject<ReceiveDeviceActionEvent>();
            connection.events.set(RECEIVE_EVENT, receiveEvent);
            client = new CausalRepoClient(connection);
            connection.connect();

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
        });

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

            const action = device(deviceInfo('username', 'device', 'session'), {
                type: 'abc',
            });
            partition.connect();

            receiveEvent.next({
                branch: 'testBranch',
                action: action,
            });

            await waitAsync();

            expect(events).toEqual([action]);
        });
    });
});
