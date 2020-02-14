import {
    botAdded,
    AuxCausalTree,
    createBot,
    backupToGithub,
    backupAsDownload,
    download,
    checkoutSubmitted,
    LocalActions,
    toast,
    finishCheckout,
    calculateBooleanTagValue,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    AuxChannelManager,
    AuxLoadedChannel,
    NodeSimulation,
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
    deviceInfo,
} from '@casual-simulation/causal-trees';
import { Subscription, Subject } from 'rxjs';
import { AuxConfig, AuxUser, Simulation } from '@casual-simulation/aux-vm';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { take, flatMap } from 'rxjs/operators';
import uuid from 'uuid/v4';
import { CheckoutModule2 } from './CheckoutModule2';
import { TestChannelManager, createChannel } from './test/TestChannelManager';
import {
    CausalRepoClient,
    MemoryConnectionClient,
    MemoryCausalRepoStore,
    MemoryStageStore,
} from '@casual-simulation/causal-trees/core2';
import {
    CausalRepoServer,
    FixedConnectionServer,
    ConnectionBridge,
} from '@casual-simulation/causal-tree-server';

let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('CheckoutModule2', () => {
    let user: AuxUser;
    let serverUser: AuxUser;
    let processingUser: AuxUser;
    let device: DeviceInfo;
    let api: any;
    let create: jest.Mock<any>;
    let factory: jest.Mock<any>;
    let subject: CheckoutModule2;
    let serverClient: CausalRepoClient;
    let processingClient: CausalRepoClient;
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
        serverUser = {
            id: 'server',
            isGuest: false,
            name: 'Server',
            username: 'server',
            token: 'server',
        };
        processingUser = {
            id: 'processing',
            isGuest: false,
            name: 'Processing',
            username: 'processing',
            token: 'processing',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        const serverDevice = deviceInfo('server', 'server', 'server');
        const processingDevice = deviceInfo(
            'processing',
            'processing',
            'processing'
        );

        // manager = new TestChannelManager();

        create = jest.fn();
        api = {
            charges: {
                create: create,
            },
        };
        factory = jest.fn();
        factory.mockReturnValue(api);

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
        subject = new CheckoutModule2(factory, serverUser, serverClient);

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

    beforeAll(() => {
        dateNowMock.mockReturnValue(1);
    });

    describe('events', () => {
        describe('checkout_submitted', () => {
            it('should not run if the given channel does not exist', async () => {
                await simulation.helper.transaction({
                    type: 'device',
                    device: device,
                    event: checkoutSubmitted('ID1', 'token', 'channel2'),
                });

                await waitAsync();
            });

            it('should emit a onCheckout() action to the processing channel', async () => {
                const processingSimulation = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'channel2'
                );
                await processingSimulation.init();

                const actions: LocalActions[] = [];
                processingSimulation.deviceEvents.subscribe(e =>
                    actions.push(e.event as LocalActions)
                );

                await processingSimulation.helper.createBot('checkoutBot', {
                    onCheckout: `@remote(
                                player.toast("Checked out " + that.productId + " " + that.token + " " + that.user.session),
                                {
                                    session: 'processing'
                                })`,
                });

                await simulation.helper.transaction({
                    type: 'device',
                    device: device,
                    event: checkoutSubmitted('ID1', 'token', 'channel2'),
                });

                await waitAsync();

                expect(actions).toEqual([
                    toast('Checked out ID1 token sessionId'),
                ]);
            });
        });

        describe('finish_checkout', () => {
            it('should not send the data to the stripe API if there is no secret key on the config bot', async () => {
                expect.assertions(1);

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc')
                );

                expect(factory).not.toBeCalled();
            });

            it('should send the data to the stripe API', async () => {
                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc')
                );

                await waitAsync();

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const bot = simulation.helper.botsState['botId'];
                expect(bot).toMatchObject({
                    id: 'botId',
                    tags: {
                        stripeCharges: true,
                        stripeSuccessfulCharges: true,
                        stripeCharge: 'chargeId',
                        stripeChargeReceiptUrl: 'url',
                        stripeChargeReceiptNumber: 321,
                        stripeChargeDescription: 'Description',
                    },
                });
            });

            it('should record the outcome of the charge in the created bot', async () => {
                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                    status: 'failed',
                    outcome: {
                        network_status: 'not_sent_to_network',
                        reason: 'highest_risk_level',
                        risk_level: 'highest',
                        seller_message:
                            'Stripe blocked this charge as too risky.',
                        type: 'blocked',
                    },
                });

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc')
                );

                await waitAsync();

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const bot = simulation.helper.botsState['botId'];
                expect(bot).toMatchObject({
                    id: 'botId',
                    tags: {
                        stripeCharges: true,
                        stripeFailedCharges: true,
                        stripeCharge: 'chargeId',
                        stripeChargeReceiptUrl: 'url',
                        stripeChargeReceiptNumber: 321,
                        stripeChargeDescription: 'Description',
                        stripeOutcomeNetworkStatus: 'not_sent_to_network',
                        stripeOutcomeReason: 'highest_risk_level',
                        stripeOutcomeRiskLevel: 'highest',
                        stripeOutcomeSellerMessage:
                            'Stripe blocked this charge as too risky.',
                        stripeOutcomeType: 'blocked',
                    },
                });
            });

            it('should handle errors sent from the API', async () => {
                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                            onPaymentFailed: `@setTag(this, 'failedMessage', that.error.message)`,
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');

                create.mockRejectedValue({
                    type: 'StripeCardError',
                    message: 'The card is invalid',
                });

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc')
                );

                await waitAsync(30);

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const bot = simulation.helper.botsState['botId'];
                expect(bot).toMatchObject({
                    id: 'botId',
                    tags: {
                        stripeErrors: true,
                        stripeErrorType: 'StripeCardError',
                        stripeError: 'The card is invalid',
                    },
                });
                expect(simulation.helper.globalsBot).toMatchObject({
                    tags: expect.objectContaining({
                        failedMessage: 'The card is invalid',
                    }),
                });
            });

            it('should send a onPaymentFailed() action when an error occurs with the extra info', async () => {
                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                            onPaymentFailed: `@setTag(this, 'failed', that.extra)`,
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');

                create.mockRejectedValue({
                    type: 'StripeCardError',
                    message: 'The card is invalid',
                });

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc', {
                        abc: 'def',
                    })
                );

                await waitAsync(30);

                expect(simulation.helper.globalsBot).toMatchObject({
                    tags: expect.objectContaining({
                        failed: {
                            abc: 'def',
                        },
                    }),
                });
            });

            it('should send a onPaymentSuccessful() action with the bot that got created', async () => {
                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                            onPaymentSuccessful: `@setTag(this, 'successId', that.bot.id)`,
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc')
                );

                await waitAsync();

                expect(simulation.helper.globalsBot).toMatchObject({
                    tags: expect.objectContaining({
                        successId: 'botId',
                    }),
                });
            });

            it('should send a onPaymentSuccessful() action with the extra info from the finishCheckout() call', async () => {
                await simulation.helper.updateBot(
                    simulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                            onPaymentSuccessful: `@setTag(this, 'success', that.extra)`,
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await simulation.helper.transaction(
                    finishCheckout('token1', 123, 'usd', 'Desc', {
                        abc: 'def',
                    })
                );

                await waitAsync();

                expect(simulation.helper.globalsBot).toMatchObject({
                    tags: expect.objectContaining({
                        success: {
                            abc: 'def',
                        },
                    }),
                });
            });

            it('should be able to send a finish_checkout action from inside the onCheckout() callback', async () => {
                const processingSimulation = nodeSimulationForBranch(
                    processingUser,
                    processingClient,
                    'channel2'
                );
                await processingSimulation.init();

                await processingSimulation.helper.createBot('checkoutBot', {
                    onCheckout: `@server.finishCheckout({
                        token: that.token,
                        currency: 'usd',
                        amount: 123,
                        description: 'Desc',
                        extra: {
                            abc: 'def'
                        }
                    });`,
                });

                await processingSimulation.helper.updateBot(
                    processingSimulation.helper.globalsBot,
                    {
                        tags: {
                            stripeSecretKey: 'secret_key',
                            onPaymentSuccessful: `@setTag(this, 'success', that.extra)`,
                        },
                    }
                );

                uuidMock.mockReturnValue('botId');
                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await simulation.helper.transaction({
                    type: 'device',
                    device: device,
                    event: checkoutSubmitted('ID1', 'token1', 'channel2'),
                });

                await waitAsync();

                expect(processingSimulation.helper.globalsBot).toMatchObject({
                    tags: expect.objectContaining({
                        success: {
                            abc: 'def',
                        },
                    }),
                });
            });
        });
    });
});
