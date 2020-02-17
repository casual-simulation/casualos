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
} from '@casual-simulation/causal-trees';
import { Subscription, Subject } from 'rxjs';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import { BackupModule } from './BackupModule';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { take, flatMap } from 'rxjs/operators';
import uuid from 'uuid/v4';
import { CheckoutModule } from './CheckoutModule';
import { TestChannelManager, createChannel } from './test/TestChannelManager';

let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('CheckoutModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let processingUniverse: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let api: any;
    let create: jest.Mock<any>;
    let factory: jest.Mock<any>;
    let config: AuxConfig;
    let subject: CheckoutModule;
    let sub: Subscription;
    let info: RealtimeChannelInfo;
    let store: TestCausalTreeStore;
    let manager: TestChannelManager;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
                    type: 'causal_tree',
                    tree: tree,
                    id: 'id',
                },
            },
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        info = {
            id: 'aux-admin',
            type: 'aux',
        };
        store = new TestCausalTreeStore();

        channel = new NodeAuxChannel(tree, user, device, config);

        await channel.initAndWait();

        manager = new TestChannelManager();

        create = jest.fn();
        api = {
            charges: {
                create: create,
            },
        };
        factory = jest.fn();
        factory.mockReturnValue(api);

        subject = new CheckoutModule(factory);

        subject.setChannelManager(<any>manager);
        sub = await subject.setup(info, channel);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    beforeAll(() => {
        dateNowMock.mockReturnValue(1);
    });

    describe('events', () => {
        describe('checkout_submitted', () => {
            it('should not run if the given channel does not exist', async () => {
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: checkoutSubmitted('ID1', 'token', 'channel2'),
                    },
                ]);

                await waitAsync();
            });

            it('should emit a onCheckout() action to the processing channel', async () => {
                const processingUniverse = await createChannel(
                    {
                        id: 'aux-channel2',
                        type: 'aux',
                    },
                    user,
                    device,
                    config
                );
                manager.addChannel(processingUniverse.info, processingUniverse);

                const actions: LocalActions[] = [];
                processingUniverse.simulation.localEvents.subscribe(e =>
                    actions.push(e)
                );

                await processingUniverse.simulation.helper.createBot(
                    'checkoutBot',
                    {
                        onCheckout:
                            '@player.toast("Checked out " + that.productId + " " + that.token + " " + that.user.session)',
                    }
                );

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: checkoutSubmitted('ID1', 'token', 'channel2'),
                    },
                ]);

                await waitAsync();

                expect(actions).toEqual([
                    toast('Checked out ID1 token sessionId'),
                ]);
            });
        });

        describe('finish_checkout', () => {
            it('should send the data to the stripe API', async () => {
                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await channel.sendEvents([
                    finishCheckout('secret_key', 'token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync();

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const bot = channel.helper.botsState['botId'];
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

                await channel.sendEvents([
                    finishCheckout('secret_key', 'token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync();

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const bot = channel.helper.botsState['botId'];
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
                await channel.helper.createBot('handler', {
                    onPaymentFailed: `@setTag(this, 'failedMessage', that.error.message)`,
                });

                uuidMock.mockReturnValue('botId');

                create.mockRejectedValue({
                    type: 'StripeCardError',
                    message: 'The card is invalid',
                });

                await channel.sendEvents([
                    finishCheckout('secret_key', 'token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync(30);

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const bot = channel.helper.botsState['botId'];
                expect(bot).toMatchObject({
                    id: 'botId',
                    tags: {
                        stripeErrors: true,
                        stripeErrorType: 'StripeCardError',
                        stripeError: 'The card is invalid',
                    },
                });
                expect(channel.helper.botsState['handler']).toMatchObject({
                    tags: expect.objectContaining({
                        failedMessage: 'The card is invalid',
                    }),
                });
            });

            it('should send a onPaymentFailed() action when an error occurs with the extra info', async () => {
                await channel.helper.createBot('handler', {
                    onPaymentFailed: `@setTag(this, "failed", that.extra)`,
                });

                uuidMock.mockReturnValue('botId');

                create.mockRejectedValue({
                    type: 'StripeCardError',
                    message: 'The card is invalid',
                });

                await channel.sendEvents([
                    finishCheckout('secret_key', 'token1', 123, 'usd', 'Desc', {
                        abc: 'def',
                    }),
                ]);

                await waitAsync(30);

                expect(channel.helper.botsState['handler']).toMatchObject({
                    tags: expect.objectContaining({
                        failed: {
                            abc: 'def',
                        },
                    }),
                });
            });

            it('should send a onPaymentSuccessful() action with the bot that got created', async () => {
                await channel.helper.createBot('handler', {
                    onPaymentSuccessful: `@setTag(this, 'successId', that.bot.id)`,
                });

                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await channel.sendEvents([
                    finishCheckout('handler', 'token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync();

                expect(channel.helper.botsState['handler']).toMatchObject({
                    tags: expect.objectContaining({
                        successId: 'botId',
                    }),
                });
            });

            it('should send a onPaymentSuccessful() action with the extra info from the finishCheckout() call', async () => {
                await channel.helper.createBot('handler', {
                    onPaymentSuccessful: `@setTag(this, 'success', that.extra)`,
                });

                uuidMock.mockReturnValue('botId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await channel.sendEvents([
                    finishCheckout('secret_key', 'token1', 123, 'usd', 'Desc', {
                        abc: 'def',
                    }),
                ]);

                await waitAsync();

                expect(channel.helper.botsState['handler']).toMatchObject({
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
