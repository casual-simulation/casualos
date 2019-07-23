import { BaseAuxChannel } from './BaseAuxChannel';
import {
    RealtimeCausalTree,
    LocalRealtimeCausalTree,
    storedTree,
    site,
    AuthorizationMessage,
    USERNAME_CLAIM,
} from '@casual-simulation/causal-trees';
import {
    AuxCausalTree,
    GLOBALS_FILE_ID,
    createFile,
    RemoteEvent,
    fileAdded,
    fileRemoved,
    remote,
    sayHello,
    DeviceEvent,
} from '@casual-simulation/aux-common';
import { AuxUser, AuxConfig } from '..';
import { first } from 'rxjs/operators';

console.log = jest.fn();

describe('BaseAuxChannel', () => {
    let channel: AuxChannelImpl;
    let user: AuxUser;
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
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        channel = new AuxChannelImpl(tree, user, config);
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
                    authorized: false,
                    reason: 'unauthorized',
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

            let deviceEvents: DeviceEvent[] = [];
            channel.onDeviceEvents.subscribe(e => deviceEvents.push(...e));

            await channel.sendEvents([
                {
                    type: 'device',
                    device: {
                        claims: {
                            [USERNAME_CLAIM]: 'username',
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
});

class AuxChannelImpl extends BaseAuxChannel {
    remoteEvents: RemoteEvent[];

    private _tree: AuxCausalTree;
    constructor(tree: AuxCausalTree, user: AuxUser, config: AuxConfig) {
        super(user, config);
        this._tree = tree;
        this.remoteEvents = [];
    }

    protected async _sendRemoteEvents(events: RemoteEvent[]): Promise<void> {
        this.remoteEvents.push(...events);
    }

    async setGrant(grant: string): Promise<void> {}

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree(this._tree);
    }
}
