import {
    fileAdded,
    AuxCausalTree,
    createFile,
    backupToGithub,
    backupAsDownload,
    download,
    checkoutSubmitted,
    LocalEvent,
    LocalEvents,
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
    RemoteEvent,
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

let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('CheckoutModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let processingChannel: NodeAuxChannel;
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
            host: 'host',
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            id: 'id',
            treeName: 'treeName',
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

        await channel.sendEvents([
            fileAdded(
                createFile('userId', {
                    'aux.account.username': 'username',
                    'aux.account.roles': [ADMIN_ROLE],
                })
            ),
            fileAdded(
                createFile('userTokenId', {
                    'aux.token.username': 'username',
                    'aux.token': 'adminToken',
                })
            ),
        ]);

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
                const processingChannel = await createChannel(
                    {
                        id: 'aux-channel2',
                        type: 'aux',
                    },
                    user,
                    device,
                    config
                );
                manager.addChannel(processingChannel.info, processingChannel);

                const actions: LocalEvents[] = [];
                processingChannel.simulation.localEvents.subscribe(e =>
                    actions.push(e)
                );

                await processingChannel.simulation.helper.createFile(
                    'checkoutFile',
                    {
                        'onCheckout()':
                            'player.toast("Checked out " + that.productId + " " + that.token)',
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

                expect(actions).toEqual([toast('Checked out ID1 token')]);
            });
        });

        describe('finish_checkout', () => {
            it('should not send the data to the stripe API if there is no secret key on the config file', async () => {
                expect.assertions(1);

                await channel.sendEvents([
                    finishCheckout('token1', 123, 'usd', 'Desc'),
                ]);

                expect(factory).not.toBeCalled();
            });

            it('should send the data to the stripe API', async () => {
                await channel.helper.updateFile(channel.helper.globalsFile, {
                    tags: {
                        'stripe.secretKey': 'secret_key',
                    },
                });

                uuidMock.mockReturnValue('fileId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await channel.sendEvents([
                    finishCheckout('token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync();

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const file = channel.helper.filesState['fileId'];
                expect(file).toMatchObject({
                    id: 'fileId',
                    tags: {
                        'stripe.charges': true,
                        'stripe.successfulCharges': true,
                        'stripe.charge': 'chargeId',
                        'stripe.charge.receipt.url': 'url',
                        'stripe.charge.receipt.number': 321,
                        'stripe.charge.description': 'Description',
                    },
                });
            });

            it('should record the outcome of the charge in the created file', async () => {
                await channel.helper.updateFile(channel.helper.globalsFile, {
                    tags: {
                        'stripe.secretKey': 'secret_key',
                    },
                });

                uuidMock.mockReturnValue('fileId');

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
                    finishCheckout('token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync();

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const file = channel.helper.filesState['fileId'];
                expect(file).toMatchObject({
                    id: 'fileId',
                    tags: {
                        'stripe.charges': true,
                        'stripe.failedCharges': true,
                        'stripe.charge': 'chargeId',
                        'stripe.charge.receipt.url': 'url',
                        'stripe.charge.receipt.number': 321,
                        'stripe.charge.description': 'Description',
                        'stripe.outcome.networkStatus': 'not_sent_to_network',
                        'stripe.outcome.reason': 'highest_risk_level',
                        'stripe.outcome.riskLevel': 'highest',
                        'stripe.outcome.sellerMessage':
                            'Stripe blocked this charge as too risky.',
                        'stripe.outcome.type': 'blocked',
                    },
                });
            });

            it('should handle errors sent from the API', async () => {
                await channel.helper.updateFile(channel.helper.globalsFile, {
                    tags: {
                        'stripe.secretKey': 'secret_key',
                        'onPaymentFailed()': `setTag(this, 'failedMessage', that.error.message)`,
                    },
                });

                uuidMock.mockReturnValue('fileId');

                create.mockRejectedValue({
                    type: 'StripeCardError',
                    message: 'The card is invalid',
                });

                await channel.sendEvents([
                    finishCheckout('token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync(30);

                expect(factory).toBeCalledWith('secret_key');
                expect(create).toBeCalledWith({
                    amount: 123,
                    currency: 'usd',
                    description: 'Desc',
                    source: 'token1',
                });

                const file = channel.helper.filesState['fileId'];
                expect(file).toMatchObject({
                    id: 'fileId',
                    tags: {
                        'stripe.errors': true,
                        'stripe.error.type': 'StripeCardError',
                        'stripe.error': 'The card is invalid',
                    },
                });
                expect(channel.helper.globalsFile).toMatchObject({
                    tags: expect.objectContaining({
                        failedMessage: 'The card is invalid',
                    }),
                });
            });

            it('should send a onPaymentSuccessful() action with the file that got created', async () => {
                await channel.helper.updateFile(channel.helper.globalsFile, {
                    tags: {
                        'stripe.secretKey': 'secret_key',
                        'onPaymentSuccessful()': `setTag(this, 'successId', that.file.id)`,
                    },
                });

                uuidMock.mockReturnValue('fileId');

                create.mockResolvedValue({
                    id: 'chargeId',
                    status: 'succeeded',
                    receipt_url: 'url',
                    receipt_number: 321,
                    description: 'Description',
                });

                await channel.sendEvents([
                    finishCheckout('token1', 123, 'usd', 'Desc'),
                ]);

                await waitAsync(30);

                expect(channel.helper.globalsFile).toMatchObject({
                    tags: expect.objectContaining({
                        successId: 'fileId',
                    }),
                });
            });
        });
    });
});

class TestChannelManager {
    private _map: Map<string, AuxLoadedChannel> = new Map();

    addChannel(info: RealtimeChannelInfo, channel: AuxLoadedChannel) {
        this._map.set(info.id, channel);
    }

    async hasChannel(info: RealtimeChannelInfo): Promise<boolean> {
        return this._map.has(info.id);
    }

    async loadChannel(info: RealtimeChannelInfo): Promise<AuxLoadedChannel> {
        return this._map.get(info.id);
    }
}

async function createChannel(
    info: RealtimeChannelInfo,
    user: AuxUser,
    device: DeviceInfo,
    config: AuxConfig
): Promise<AuxLoadedChannel> {
    const tree = new AuxCausalTree(storedTree(site(1)));
    await tree.root();
    const channel = new NodeAuxChannel(tree, user, device, config);
    const sim = new NodeSimulation(info.id, config.config, () => channel);

    await sim.init();

    return {
        tree,
        channel: channel,
        simulation: sim,
        info: info,
        subscription: new Subscription(),
        events: new Subject<RemoteEvent[]>(),
    };
}
