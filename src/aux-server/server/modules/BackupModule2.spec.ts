import {
    botAdded,
    AuxCausalTree,
    createBot,
    backupToGithub,
    backupAsDownload,
    download,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    nodeSimulationForBranch,
} from '@casual-simulation/aux-vm-node';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    storedTree,
    site,
    RealtimeChannelInfo,
    DeviceInfo,
    ADMIN_ROLE,
    RemoteAction,
    remote,
    device as deviceEvent,
    deviceInfo,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { AuxConfig, AuxUser, Simulation } from '@casual-simulation/aux-vm';
import { BackupModule2 } from './BackupModule2';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { take, flatMap } from 'rxjs/operators';
import uuid from 'uuid/v4';
import {
    CausalRepoClient,
    MemoryCausalRepoStore,
    MemoryStageStore,
} from '@casual-simulation/causal-trees/core2';
import {
    ConnectionBridge,
    FixedConnectionServer,
    CausalRepoServer,
} from '@casual-simulation/causal-tree-server';

let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('BackupModule2', () => {
    let user: AuxUser;
    let serverUser: AuxUser;
    let testUser: AuxUser;
    let deviceUser: AuxUser;
    let device: DeviceInfo;
    let serverDevice: DeviceInfo;
    let api: any;
    let create: jest.Mock<any>;
    let factory: jest.Mock<any>;
    let subject: BackupModule2;
    let serverClient: CausalRepoClient;
    let testClient: CausalRepoClient;
    let deviceClient: CausalRepoClient;
    let simulation: Simulation;
    let sub: Subscription;

    beforeEach(async () => {
        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        deviceUser = {
            id: 'deviceId',
            isGuest: false,
            name: 'Device',
            username: 'username',
            token: 'sessionId',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };

        serverUser = {
            id: 'server',
            isGuest: false,
            name: 'Server',
            username: 'server',
            token: 'server',
        };
        serverDevice = deviceInfo('server', 'server', 'server');

        testUser = {
            id: 'processing',
            isGuest: false,
            name: 'Processing',
            username: 'processing',
            token: 'processing',
        };
        const processingDevice = deviceInfo(
            'processing',
            'processing',
            'processing'
        );

        create = jest.fn();
        api = {
            gists: {
                create: create,
            },
        };

        const store = new MemoryCausalRepoStore();
        const stageStore = new MemoryStageStore();
        const serverBridge = new ConnectionBridge(serverDevice);
        const processingBridge = new ConnectionBridge(processingDevice);
        const deviceBridge = new ConnectionBridge(device);
        const fixedConnectionServer = new FixedConnectionServer([
            serverBridge.serverConnection,
            processingBridge.serverConnection,
            deviceBridge.serverConnection,
        ]);

        const server = new CausalRepoServer(
            fixedConnectionServer,
            store,
            stageStore
        );
        server.init();

        serverClient = new CausalRepoClient(serverBridge.clientConnection);
        testClient = new CausalRepoClient(processingBridge.clientConnection);
        deviceClient = new CausalRepoClient(deviceBridge.clientConnection);

        simulation = nodeSimulationForBranch(user, serverClient, 'admin');
        await simulation.init();

        await simulation.helper.transaction(
            botAdded(
                createBot('userId', {
                    'aux.account.username': 'username',
                    'aux.account.roles': [ADMIN_ROLE],
                })
            ),
            botAdded(
                createBot('userTokenId', {
                    'aux.token.username': 'username',
                    'aux.token': 'adminToken',
                })
            )
        );

        subject = new BackupModule2(serverUser, serverClient, auth => api);
        sub = await subject.setup(simulation);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
        simulation.unsubscribe();
    });

    beforeAll(() => {
        dateNowMock.mockReturnValue(1);
    });

    describe('events', () => {
        describe('backup_to_github', () => {
            it('should create a gist with the contents of all the channels', async () => {
                const testSimulation = nodeSimulationForBranch(
                    testUser,
                    testClient,
                    'test'
                );
                await testSimulation.init();

                uuidMock.mockReturnValue('testId');
                create.mockResolvedValue({
                    data: {
                        html_url: 'testUrl',
                    },
                });
                await simulation.helper.transaction(backupToGithub('auth'));

                await waitAsync();

                expect(create).toBeCalledWith({
                    files: {
                        'admin.aux': {
                            content: expect.any(String),
                        },
                        'test.aux': {
                            content: expect.any(String),
                        },
                    },
                    description: expect.any(String),
                });

                expect(simulation.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.backup': true,
                        'aux.task.backup.type': 'github',
                        'aux.task.backup.url': 'testUrl',
                        'aux.task.output': 'Uploaded 2 channels.',
                    },
                });
            });

            it('should handle exceptions from the Github API', async () => {
                const testSimulation = nodeSimulationForBranch(
                    testUser,
                    testClient,
                    'test'
                );
                await testSimulation.init();

                uuidMock.mockReturnValue('testId');
                create.mockRejectedValue(new Error('abc'));
                await simulation.helper.transaction(backupToGithub('auth'));

                await waitAsync();

                expect(create).toBeCalledWith({
                    files: {
                        'admin.aux': {
                            content: expect.any(String),
                        },
                        'test.aux': {
                            content: expect.any(String),
                        },
                    },
                    description: expect.any(String),
                });

                expect(simulation.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.backup': true,
                        'aux.task.backup.type': 'github',
                        'aux.task.output': 'The task failed.',
                        'aux.task.error': 'Error: abc',
                    },
                });
            });
        });

        describe('backup_as_download', () => {
            it('should create a zip with the contents of all the channels', async () => {
                const testSimulation = nodeSimulationForBranch(
                    testUser,
                    testClient,
                    'test'
                );
                await testSimulation.init();

                const deviceSimulation = nodeSimulationForBranch(
                    deviceUser,
                    deviceClient,
                    'admin'
                );
                await deviceSimulation.init();

                uuidMock.mockReturnValue('testId');

                const promise = deviceSimulation.deviceEvents
                    .pipe(take(1))
                    .toPromise();
                await simulation.helper.transaction(
                    backupAsDownload({
                        sessionId: 'sessionId',
                    })
                );

                const deviceEvents = await promise;

                expect(deviceEvents).toEqual(
                    deviceEvent(
                        serverDevice,
                        download(
                            expect.anything(),
                            'backup.zip',
                            'application/zip'
                        )
                    )
                );

                expect(simulation.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.backup': true,
                        'aux.task.backup.type': 'download',
                        'aux.task.output': 'Downloaded 2 channels.',
                    },
                });
            });
        });
    });
});
