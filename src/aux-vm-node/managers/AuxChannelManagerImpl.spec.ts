import {
    CausalTreeFactory,
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    ADMIN_ROLE,
    RealtimeChannelInfo,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    DeviceAction,
    device as deviceEvent,
    RemoteAction,
    remote,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { TestCryptoImpl } from '@casual-simulation/crypto/test/TestCryptoImpl';
import { AuxChannelManager } from './AuxChannelManager';
import { AuxChannelManagerImpl } from './AuxChannelManagerImpl';
import { AuxUser } from '@casual-simulation/aux-vm/AuxUser';
import {
    auxCausalTreeFactory,
    AuxCausalTree,
    GLOBALS_BOT_ID,
    botAdded,
    createBot,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { NodeSimulation } from './NodeSimulation';

let logMock = (console.log = jest.fn());

describe('AuxChannelManager', () => {
    let manager: AuxChannelManager;
    let user: AuxUser;
    let device: DeviceInfo;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let crypto: TestCryptoImpl;
    let stored: AuxCausalTree;

    beforeEach(async () => {
        user = {
            id: 'userId',
            name: 'Server',
            username: 'server',
            token: 'token',
            isGuest: false,
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'server',
                [DEVICE_ID_CLAIM]: 'serverDeviceId',
                [SESSION_ID_CLAIM]: 'serverSessionId',
            },
            roles: [SERVER_ROLE],
        };
        store = new TestCausalTreeStore();
        factory = auxCausalTreeFactory();
        crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
        crypto.valid = true;
        manager = new AuxChannelManagerImpl(
            user,
            device,
            store,
            factory,
            crypto,
            []
        );
        stored = new AuxCausalTree(storedTree(site(1)));
        await stored.root();
        store.put('test', stored.export());
    });

    it('should return a NodeAuxChannel', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const returned = await manager.loadChannel(info);

        expect(returned).toMatchObject({
            info: info,
        });

        expect(returned.tree instanceof AuxCausalTree).toBe(true);
        expect(returned.channel instanceof NodeAuxChannel).toBe(true);
        expect(returned.simulation instanceof NodeSimulation).toBe(true);
    });

    it('should initialize the NodeAuxChannel and wait for complete initialization', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const returned = await manager.loadChannel(info);

        // The NodeAuxChannel should create the user bot
        // during initialization
        const user = returned.tree.value['userId'];
        expect(user).toBeTruthy();
    });

    it('should reuse the created aux channel', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const first = await manager.loadChannel(info);
        const second = await manager.loadChannel(info);

        const equal = first.channel === second.channel;
        expect(equal).toBe(true);
    });

    describe('sendEvents()', () => {
        it('should execute events', async () => {
            const info = {
                id: 'test',
                type: 'aux',
            };
            const device: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'abc',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [ADMIN_ROLE],
            };
            const first = await manager.loadChannel(info);

            let events: DeviceAction[] = [];
            first.channel.onDeviceEvents.subscribe(e => events.push(...e));

            await manager.sendEvents(first, [
                deviceEvent(
                    device,
                    botAdded(
                        createBot('testId', {
                            abc: 'def',
                        })
                    )
                ),
            ]);

            // Should map events to DeviceAction
            expect(events).toEqual([
                {
                    type: 'device',
                    device: device,
                    event: botAdded(
                        createBot('testId', {
                            abc: 'def',
                        })
                    ),
                },
            ]);
        });
    });

    it('should run setup() on each of the configured modules', async () => {
        let testModule = new TestModule();
        manager = new AuxChannelManagerImpl(
            user,
            device,
            store,
            factory,
            crypto,
            [testModule]
        );
        const info = {
            id: 'test',
            type: 'aux',
        };
        const first = await manager.loadChannel(info);
        const second = await manager.loadChannel(info);

        // It should only run once per channel
        expect(testModule.channels.length).toBe(1);

        const firstEquals = testModule.channels[0] === first.channel;
        expect(firstEquals).toBe(true);
    });

    it('should call deviceConnected() on each of the modules', async () => {
        let testModule = new TestModule();
        manager = new AuxChannelManagerImpl(
            user,
            device,
            store,
            factory,
            crypto,
            [testModule]
        );
        const info = {
            id: 'test',
            type: 'aux',
        };
        const first = await manager.loadChannel(info);

        const device1: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [ADMIN_ROLE],
        };
        const device2: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'other',
                [DEVICE_ID_CLAIM]: 'deviceId2',
                [SESSION_ID_CLAIM]: 'sessionId2',
            },
            roles: [],
        };
        await manager.connect(first, device1);
        await manager.connect(first, device2);

        expect(testModule.connectedDevices).toEqual([device1, device2]);
    });

    it('should call deviceDisconnected() on each of the modules', async () => {
        let testModule = new TestModule();
        manager = new AuxChannelManagerImpl(
            user,
            device,
            store,
            factory,
            crypto,
            [testModule]
        );
        const info = {
            id: 'test',
            type: 'aux',
        };
        const first = await manager.loadChannel(info);

        const device1: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [ADMIN_ROLE],
        };
        const device2: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'other',
                [DEVICE_ID_CLAIM]: 'deviceId2',
                [SESSION_ID_CLAIM]: 'sessionId2',
            },
            roles: [],
        };
        const sub1 = await manager.connect(first, device1);
        const sub2 = await manager.connect(first, device2);

        sub1.unsubscribe();
        sub2.unsubscribe();

        expect(testModule.disconnectedDevices).toEqual([device1, device2]);
    });

    it('should send remote events that the channel sends through the observable list', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const returned = await manager.loadChannel(info);

        let events: RemoteAction[] = [];
        returned.events.subscribe(e => events.push(...e));

        await returned.channel.sendEvents([remote({ type: 'abc' })]);

        expect(events).toEqual([remote({ type: 'abc' })]);
    });
});

class TestModule implements AuxModule {
    channels: AuxChannel[] = [];
    connectedDevices: DeviceInfo[] = [];
    disconnectedDevices: DeviceInfo[] = [];

    async setup(
        info: RealtimeChannelInfo,
        channel: AuxChannel
    ): Promise<Subscription> {
        this.channels.push(channel);
        return new Subscription(() => {});
    }

    async deviceConnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<void> {
        this.connectedDevices.push(device);
    }

    async deviceDisconnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<void> {
        this.disconnectedDevices.push(device);
    }
}
