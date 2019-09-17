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

        subject = new CheckoutModule();

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
