import { AuxCausalRepoManager } from './AuxCausalRepoManager';
import {
    MemoryConnectionClient,
    CausalRepoClient,
    WATCH_BRANCHES,
    LoadBranchEvent,
    LOAD_BRANCH,
    UnloadBranchEvent,
    UNLOAD_BRANCH,
    WATCH_BRANCH,
    WATCH_DEVICES,
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    UNWATCH_BRANCH,
    AddAtomsEvent,
    ADD_ATOMS,
    WATCH_BRANCH_DEVICES,
} from '@casual-simulation/causal-trees/core2';
import { AuxModule2, Simulation } from '@casual-simulation/aux-vm';
import {
    DeviceInfo,
    SESSION_ID_CLAIM,
    deviceInfo,
} from '@casual-simulation/causal-trees';
import { Subscription, Subject } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

console.log = jest.fn();

const device1Info = deviceInfo('device1', 'device1', 'device1');
const serverInfo = deviceInfo('server', 'server', 'server');
const ignoredDevice1Info = deviceInfo(
    'ignoredDevice1',
    'ignoredDevice1',
    'ignoredDevice1'
);

describe('AuxCausalRepoManager', () => {
    let manager: AuxCausalRepoManager;
    let testModule: TestModule;
    let connection: MemoryConnectionClient;
    let loadBranch: Subject<LoadBranchEvent>;
    let unloadBranch: Subject<UnloadBranchEvent>;
    let deviceConnected: Subject<ConnectedToBranchEvent>;
    let deviceDisconnected: Subject<DisconnectedFromBranchEvent>;
    let addAtoms: Subject<AddAtomsEvent>;

    beforeEach(() => {
        testModule = new TestModule();
        connection = new MemoryConnectionClient();
        manager = new AuxCausalRepoManager(
            {
                id: 'server',
                name: 'Server',
                username: 'server',
                token: 'token',
            },
            new CausalRepoClient(connection),
            [testModule],
            undefined,
            ['ignoredDevice1', 'ignoredDevice2']
        );

        loadBranch = new Subject<LoadBranchEvent>();
        unloadBranch = new Subject<UnloadBranchEvent>();
        deviceConnected = new Subject<ConnectedToBranchEvent>();
        deviceDisconnected = new Subject<DisconnectedFromBranchEvent>();
        addAtoms = new Subject<AddAtomsEvent>();
        connection.events.set(LOAD_BRANCH, loadBranch);
        connection.events.set(UNLOAD_BRANCH, unloadBranch);
        connection.events.set(DEVICE_CONNECTED_TO_BRANCH, deviceConnected);
        connection.events.set(
            DEVICE_DISCONNECTED_FROM_BRANCH,
            deviceDisconnected
        );
        connection.events.set(ADD_ATOMS, addAtoms);
    });

    describe('init()', () => {
        it('should not start watching branches', async () => {
            manager.init();
            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).not.toContainEqual({
                name: WATCH_BRANCHES,
                data: undefined,
            });
        });

        it('should start watching devices', async () => {
            manager.init();
            connection.connect();
            await waitAsync();
            expect(connection.sentMessages).toContainEqual({
                name: WATCH_DEVICES,
                data: undefined,
            });
        });
    });

    it('should start watching branches that were loaded by a device', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        await waitAsync();

        expect(connection.sentMessages.slice(1)).toEqual([
            {
                name: WATCH_BRANCH,
                data: {
                    branch: 'abc',
                    siteId: expect.any(String),
                },
            },
            {
                name: WATCH_BRANCH,
                data: {
                    branch: 'abc-player-server',
                    temporary: true,
                    siteId: expect.any(String),
                },
            },
            {
                name: WATCH_BRANCH_DEVICES,
                data: 'abc',
            },
        ]);
    });

    it('should stop watching branches when only one device is connected', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc-player-server',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        // Server is connected
        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        await waitAsync();

        deviceDisconnected.next({
            broadcast: true,
            branch: 'abc',
            device: device1Info,
        });
        deviceDisconnected.next({
            broadcast: false,
            branch: 'abc',
            device: device1Info,
        });
        await waitAsync();
        await waitAsync();

        expect(connection.sentMessages).toContainEqual({
            name: WATCH_BRANCH,
            data: {
                branch: 'abc',
                siteId: expect.any(String),
            },
        });
        expect(connection.sentMessages).toContainEqual({
            name: UNWATCH_BRANCH,
            data: 'abc',
        });

        expect(connection.sentMessages).toContainEqual({
            name: WATCH_BRANCH,
            data: {
                branch: 'abc-player-server',
                temporary: true,
                siteId: expect.any(String),
            },
        });
        expect(connection.sentMessages).toContainEqual({
            name: UNWATCH_BRANCH,
            data: 'abc-player-server',
        });
    });

    it('should not try loading the branch if a disconnected event is received without a corresponding connection event', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceDisconnected.next({
            broadcast: true,
            branch: 'abc',
            device: device1Info,
        });
        await waitAsync();

        expect(connection.sentMessages).not.toContainEqual({
            name: WATCH_BRANCH,
            data: {
                branch: 'abc',
                siteId: expect.any(String),
            },
        });
    });

    it('should call setup() on each of the modules when a branch is loaded', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc-player-server',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        // Server is connected
        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        await waitAsync();

        expect([...testModule.simulations.keys()]).toEqual(['abc']);
    });

    it('should ignore connection events from the given user IDs', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: ignoredDevice1Info,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: ignoredDevice1Info,
        });
        await waitAsync();

        expect(connection.sentMessages.slice(1)).toEqual([]);
        expect([...testModule.simulations.keys()]).toEqual([]);
    });

    it('should dispose of the subscription returned by setup() when the simulation is unloaded', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc-player-server',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        // Server is connected
        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        await waitAsync();

        deviceDisconnected.next({
            broadcast: true,
            branch: 'abc',
            device: device1Info,
        });
        await waitAsync();

        deviceDisconnected.next({
            broadcast: true,
            branch: 'abc',
            device: serverInfo,
        });
        await waitAsync();

        expect(testModule.simulations.size).toEqual(0);
    });

    it('should call deviceConnected() on each of the modules', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc-player-server',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        // Server is connected
        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        deviceConnected.next({
            broadcast: false,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        await waitAsync();

        expect([...testModule.devices.keys()]).toEqual(['device1']);
    });

    it('should call deviceDisconnected() on each of the modules', async () => {
        manager.init();
        connection.connect();
        await waitAsync();

        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: device1Info,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        addAtoms.next({
            branch: 'abc-player-server',
            atoms: [],
            initial: true,
        });
        await waitAsync();

        // Server is connected
        deviceConnected.next({
            broadcast: true,
            branch: {
                branch: 'abc',
            },
            device: serverInfo,
        });
        await waitAsync();

        deviceDisconnected.next({
            broadcast: true,
            branch: 'abc',
            device: device1Info,
        });
        await waitAsync();

        deviceDisconnected.next({
            broadcast: true,
            branch: 'abc',
            device: serverInfo,
        });
        await waitAsync();

        expect([...testModule.devices.keys()]).toEqual([]);
    });
});

class TestModule implements AuxModule2 {
    simulations = new Map<string, Simulation>();
    devices = new Map<string, DeviceInfo>();

    async setup(simulation: Simulation): Promise<Subscription> {
        this.simulations.set(simulation.id, simulation);

        return new Subscription(() => {
            this.simulations.delete(simulation.id);
        });
    }

    async deviceConnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {
        this.devices.set(device.claims[SESSION_ID_CLAIM], device);
    }

    async deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {
        this.devices.delete(device.claims[SESSION_ID_CLAIM]);
    }
}
