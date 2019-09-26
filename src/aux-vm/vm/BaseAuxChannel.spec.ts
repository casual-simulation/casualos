import { BaseAuxChannel } from './BaseAuxChannel';
import {
    RealtimeCausalTree,
    LocalRealtimeCausalTree,
    storedTree,
    site,
    AuthorizationMessage,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    RemoteAction,
    DeviceAction,
    remote,
    DeviceInfo,
    ADMIN_ROLE,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import {
    AuxCausalTree,
    GLOBALS_FILE_ID,
    createFile,
    fileAdded,
    fileRemoved,
    sayHello,
} from '@casual-simulation/aux-common';
import { AuxUser, AuxConfig } from '..';

console.log = jest.fn();

describe('BaseAuxChannel', () => {
    let channel: AuxChannelImpl;
    let user: AuxUser;
    let device: DeviceInfo;
    let config: AuxConfig;
    let tree: AuxCausalTree;

    beforeEach(async () => {
        config = {
            id: 'auxId',
            config: { isBuilder: false, isPlayer: false },
            host: 'host',
            treeName: 'test',
        };
        user = {
            id: 'userId',
            username: 'username',
            isGuest: false,
            name: 'name',
            token: 'token',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        channel = new AuxChannelImpl(tree, user, device, config);
    });

    describe('init()', () => {
        it('should create a file for the user', async () => {
            await channel.initAndWait();

            const userFile = channel.helper.userFile;
            expect(userFile).toBeTruthy();
            expect(userFile.tags).toMatchSnapshot();
        });

        it('should create the globals file', async () => {
            await channel.initAndWait();

            const globals = channel.helper.globalsFile;
            expect(globals).toBeTruthy();
            expect(globals.tags).toMatchSnapshot();
        });

        it('should issue an authorization event if the user is not in the designers list in builder', async () => {
            config.config.isBuilder = true;
            await tree.addFile(
                createFile(GLOBALS_FILE_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            await channel.init();

            for (let i = 0; i < 100; i++) {
                await Promise.resolve();
            }

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
                {
                    type: 'authorization',
                    authorized: false,
                    reason: 'unauthorized',
                },
            ]);
        });

        it('should allow users with the admin role', async () => {
            config.config.isBuilder = true;
            await tree.addFile(
                createFile(GLOBALS_FILE_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            device.roles.push(ADMIN_ROLE);
            await channel.init();

            for (let i = 0; i < 100; i++) {
                await Promise.resolve();
            }

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
            ]);
        });

        it('should allow users with the server role', async () => {
            config.config.isBuilder = true;
            await tree.addFile(
                createFile(GLOBALS_FILE_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            device.roles.push(SERVER_ROLE);
            await channel.init();

            for (let i = 0; i < 100; i++) {
                await Promise.resolve();
            }

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
            ]);
        });
    });

    describe('sendEvents()', () => {
        it('should send remote events to _sendRemoteEvents()', async () => {
            await channel.initAndWait();

            await channel.sendEvents([
                {
                    type: 'remote',
                    event: fileAdded(createFile('def')),
                },
                fileAdded(createFile('test')),
                {
                    type: 'remote',
                    event: fileAdded(createFile('abc')),
                },
            ]);

            expect(channel.remoteEvents).toEqual([
                remote(fileAdded(createFile('def'))),
                remote(fileAdded(createFile('abc'))),
            ]);
        });

        it('should send device events to onDeviceEvents', async () => {
            await channel.initAndWait();

            let deviceEvents: DeviceAction[] = [];
            channel.onDeviceEvents.subscribe(e => deviceEvents.push(...e));

            await channel.sendEvents([
                {
                    type: 'device',
                    device: {
                        claims: {
                            [USERNAME_CLAIM]: 'username',
                            [DEVICE_ID_CLAIM]: 'deviceId',
                            [SESSION_ID_CLAIM]: 'sessionId',
                        },
                        roles: ['role'],
                    },
                    event: fileAdded(createFile('def')),
                },
                fileAdded(createFile('test')),
                {
                    type: 'device',
                    device: null,
                    event: fileAdded(createFile('abc')),
                },
            ]);

            expect(deviceEvents).toEqual([
                {
                    type: 'device',
                    device: {
                        claims: {
                            [USERNAME_CLAIM]: 'username',
                            [DEVICE_ID_CLAIM]: 'deviceId',
                            [SESSION_ID_CLAIM]: 'sessionId',
                        },
                        roles: ['role'],
                    },
                    event: fileAdded(createFile('def')),
                },
                {
                    type: 'device',
                    device: null,
                    event: fileAdded(createFile('abc')),
                },
            ]);
        });
    });

    describe('formulaBatch()', () => {
        it('should send remote events', async () => {
            await channel.initAndWait();

            await channel.formulaBatch(['server.sayHello()']);

            expect(channel.remoteEvents).toEqual([remote(sayHello())]);
        });
    });

    describe('search', () => {
        it('should convert errors to copiable values', async () => {
            await channel.initAndWait();

            const result = await channel.search('throw new Error("abc")');

            expect(result).toEqual({
                success: false,
                extras: expect.any(Object),
                error: 'Error: abc',
                logs: expect.any(Array),
            });
        });
    });
});

class AuxChannelImpl extends BaseAuxChannel {
    remoteEvents: RemoteAction[];

    private _tree: AuxCausalTree;
    private _device: DeviceInfo;
    constructor(
        tree: AuxCausalTree,
        user: AuxUser,
        device: DeviceInfo,
        config: AuxConfig
    ) {
        super(user, config, {});
        this._tree = tree;
        this._device = device;
        this.remoteEvents = [];
    }

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        this.remoteEvents.push(...events);
    }

    async setGrant(grant: string): Promise<void> {}

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree(this._tree, this.user, this._device);
    }
}
