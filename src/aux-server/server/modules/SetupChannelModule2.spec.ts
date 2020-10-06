import { nodeSimulationForBranch } from '@casual-simulation/aux-vm-node';
import {
    createBot,
    setupStory,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    deviceInfo,
    remoteError,
    remoteResult,
} from '@casual-simulation/causal-trees';
import { SetupChannelModule2 } from './SetupChannelModule2';
import { AuxUser, Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import {
    CausalRepoClient,
    MemoryCausalRepoStore,
    MemoryStageStore,
    SEND_EVENT,
    SendRemoteActionEvent,
} from '@casual-simulation/causal-trees/core2';
import {
    CausalRepoServer,
    ConnectionBridge,
    FixedConnectionServer,
    MemoryConnection,
    Connection,
} from '@casual-simulation/causal-tree-server';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
console.log = jest.fn();

describe('SetupChannelModule2', () => {
    let user: AuxUser;
    let serverUser: AuxUser;
    let processingUser: AuxUser;
    let subject: SetupChannelModule2;
    let serverClient: CausalRepoClient;
    let serverConnection: Connection;
    let processingClient: CausalRepoClient;
    let simulation: Simulation;
    let sub: Subscription;

    beforeEach(async () => {
        user = {
            id: 'userId',
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        serverUser = {
            id: 'server',
            name: 'Server',
            username: 'server',
            token: 'server',
        };
        processingUser = {
            id: 'processing',
            name: 'Processing',
            username: 'processing',
            token: 'processing',
        };
        const serverDevice = deviceInfo('server', 'server', 'server');
        const processingDevice = deviceInfo(
            'processing',
            'processing',
            'processing'
        );

        const store = new MemoryCausalRepoStore();
        const stageStore = new MemoryStageStore();
        const serverBridge = new ConnectionBridge(serverDevice);
        const processingBridge = new ConnectionBridge(processingDevice);
        const fixedConnectionServer = new FixedConnectionServer([
            serverBridge.serverConnection,
            processingBridge.serverConnection,
        ]);

        const server = new CausalRepoServer(
            fixedConnectionServer,
            store,
            stageStore
        );
        server.init();

        serverConnection = serverBridge.serverConnection;
        serverClient = new CausalRepoClient(serverBridge.clientConnection);
        processingClient = new CausalRepoClient(
            processingBridge.clientConnection
        );
        subject = new SetupChannelModule2(serverUser, serverClient);

        simulation = nodeSimulationForBranch(user, serverClient, 'id');
        await simulation.init();

        sub = await subject.setup(simulation);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
        simulation.unsubscribe();
    });

    describe('events', () => {
        describe('setup_story', () => {
            it('should create non-existant channels', async () => {
                expect.assertions(1);

                await simulation.helper.transaction(setupStory('newChannel'));

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);
            });

            it('should clone the given bot into the new channel', async () => {
                expect.assertions(2);

                await simulation.helper.transaction(
                    setupStory(
                        'newChannel',
                        createBot('test', {
                            abc: 'def',
                        })
                    )
                );

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                expect(newChannelSim.helper.objects).toContainEqual(
                    createPrecalculatedBot(
                        expect.any(String),
                        {
                            abc: 'def',
                        },
                        undefined,
                        'shared'
                    )
                );
            });

            it('should clone the given mod into the new channel', async () => {
                expect.assertions(2);

                await simulation.helper.transaction(
                    setupStory('newChannel', {
                        abc: 'def',
                    })
                );

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                expect(newChannelSim.helper.objects).toContainEqual(
                    createPrecalculatedBot(
                        expect.any(String),
                        {
                            abc: 'def',
                        },
                        undefined,
                        'shared'
                    )
                );
            });

            it('should call onCreate() on the new bot', async () => {
                expect.assertions(2);

                await simulation.helper.transaction(
                    setupStory('newChannel', {
                        onCreate: '@setTag(this, "created", true)',
                    })
                );

                await waitAsync();

                const channelInfo = await serverClient
                    .branchInfo('newChannel')
                    .toPromise();
                expect(channelInfo.exists).toBe(true);

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                expect(newChannelSim.helper.objects).toContainEqual(
                    createPrecalculatedBot(
                        expect.any(String),
                        {
                            onCreate: '@setTag(this, "created", true)',
                            created: true,
                        },
                        undefined,
                        'shared'
                    )
                );
            });

            it('should not add the new bot if the channel already exists', async () => {
                expect.assertions(1);

                // Creates the new channel
                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                await simulation.helper.transaction(
                    setupStory('newChannel', {
                        test: 'abc',
                    })
                );

                await waitAsync();

                expect(newChannelSim.helper.objects).not.toContainEqual(
                    createPrecalculatedBot(
                        expect.any(String),
                        {
                            abc: 'def',
                        },
                        undefined,
                        'shared'
                    )
                );
            });

            it('should send a remote error if the story already exists', async () => {
                expect.assertions(1);

                // Creates the new channel
                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                const remoteEvents = [] as SendRemoteActionEvent[];
                serverConnection
                    .event<SendRemoteActionEvent>(SEND_EVENT)
                    .subscribe((e) => remoteEvents.push(e));

                await simulation.helper.transaction(
                    setupStory('newChannel', undefined, 'task1', 'player1')
                );

                await waitAsync();

                expect(remoteEvents).toEqual([
                    {
                        branch: 'id',
                        action: remoteError(
                            {
                                error: 'failure',
                                exception: 'The story already exists.',
                            },
                            {
                                sessionId: 'player1',
                            },
                            'task1'
                        ),
                    },
                ]);
            });

            it('should send a remote result when the channel is setup', async () => {
                expect.assertions(1);

                const remoteEvents = [] as SendRemoteActionEvent[];
                serverConnection
                    .event<SendRemoteActionEvent>(SEND_EVENT)
                    .subscribe((e) => remoteEvents.push(e));

                await simulation.helper.transaction(
                    setupStory('newChannel', undefined, 'task1', 'player1')
                );

                await waitAsync();

                expect(remoteEvents).toEqual([
                    {
                        branch: 'id',
                        action: remoteResult(
                            undefined,
                            {
                                sessionId: 'player1',
                            },
                            'task1'
                        ),
                    },
                ]);
            });

            it('should only setup a story once when triggered twice in a row', async () => {
                expect.assertions(3);

                const remoteEvents = [] as SendRemoteActionEvent[];
                serverConnection
                    .event<SendRemoteActionEvent>(SEND_EVENT)
                    .subscribe((e) => remoteEvents.push(e));

                await simulation.helper.transaction(
                    setupStory(
                        'newChannel',
                        {
                            color: 'red',
                        },
                        'task1',
                        'player1'
                    ),
                    setupStory(
                        'newChannel',
                        {
                            color: 'blue',
                        },
                        'task2',
                        'player1'
                    )
                );

                await waitAsync();

                const newChannelSim = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'newChannel'
                );
                await newChannelSim.init();

                expect(newChannelSim.helper.objects).toContainEqual(
                    createPrecalculatedBot(
                        expect.any(String),
                        {
                            color: 'red',
                        },
                        undefined,
                        'shared'
                    )
                );
                expect(newChannelSim.helper.objects).not.toContainEqual(
                    createPrecalculatedBot(
                        expect.any(String),
                        {
                            color: 'blue',
                        },
                        undefined,
                        'shared'
                    )
                );
                expect(remoteEvents).toEqual([
                    {
                        branch: 'id',
                        action: remoteResult(
                            undefined,
                            {
                                sessionId: 'player1',
                            },
                            'task1'
                        ),
                    },
                    {
                        branch: 'id',
                        action: remoteError(
                            {
                                error: 'failure',
                                exception: 'The story already exists.',
                            },
                            {
                                sessionId: 'player1',
                            },
                            'task2'
                        ),
                    },
                ]);
            });
        });
    });
});
