import { nodeSimulationForBranch } from '@casual-simulation/aux-vm-node';
import {
    createBot,
    setupStory,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import { deviceInfo } from '@casual-simulation/causal-trees';
import { SetupChannelModule2 } from './SetupChannelModule2';
import { AuxUser, Simulation } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import {
    CausalRepoClient,
    MemoryCausalRepoStore,
    MemoryStageStore,
} from '@casual-simulation/causal-trees/core2';
import {
    CausalRepoServer,
    ConnectionBridge,
    FixedConnectionServer,
} from '@casual-simulation/causal-tree-server';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
console.log = jest.fn();

describe('SetupChannelModule2', () => {
    let user: AuxUser;
    let serverUser: AuxUser;
    let processingUser: AuxUser;
    let subject: SetupChannelModule2;
    let serverClient: CausalRepoClient;
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
        });
    });
});
