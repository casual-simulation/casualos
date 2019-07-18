import {
    CausalTreeFactory,
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { TestCryptoImpl } from '@casual-simulation/crypto/test/TestCryptoImpl';
import { AuxChannelManager } from './AuxChannelManager';
import { AuxChannelManagerImpl } from './AuxChannelManagerImpl';
import { AuxUser } from '@casual-simulation/aux-vm/AuxUser';
import {
    auxCausalTreeFactory,
    AuxCausalTree,
    GLOBALS_FILE_ID,
    fileAdded,
    createFile,
    sayHello,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { TestAuxChannelAuthorizer } from '../test/TestAuxChannelAuthorizer';

let logMock = (console.log = jest.fn());

describe('AuxChannelManager', () => {
    let manager: AuxChannelManager;
    let user: AuxUser;
    let store: TestCausalTreeStore;
    let authorizer: TestAuxChannelAuthorizer;
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
        store = new TestCausalTreeStore();
        factory = auxCausalTreeFactory();
        crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
        crypto.valid = true;
        authorizer = new TestAuxChannelAuthorizer();
        manager = new AuxChannelManagerImpl(
            user,
            store,
            factory,
            crypto,
            authorizer
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
            tree: expect.any(AuxCausalTree),
            channel: expect.any(NodeAuxChannel),
        });
    });
    ``;

    it('should initialize the NodeAuxChannel and wait for complete initialization', async () => {
        const info = {
            id: 'test',
            type: 'aux',
        };
        const returned = await manager.loadChannel(info);

        // The NodeAuxChannel should create the globals file
        // during initialization
        const globals = returned.tree.value[GLOBALS_FILE_ID];
        expect(globals).toBeTruthy();
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
        it('should execute events if they allowed by the authorizer', async () => {
            const info = {
                id: 'test',
                type: 'aux',
            };
            const device: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'abc',
                },
                roles: [ADMIN_ROLE],
            };
            const first = await manager.loadChannel(info);

            authorizer.allowProcessingEvents = true;
            await manager.sendEvents(device, first, [
                fileAdded(
                    createFile('testId', {
                        abc: 'def',
                    })
                ),
            ]);

            expect(first.channel.helper.filesState['testId']).toMatchObject({
                id: 'testId',
                tags: {
                    abc: 'def',
                },
            });
        });

        it('should not execute events if they are not allowed by the authorizer', async () => {
            const info = {
                id: 'test',
                type: 'aux',
            };
            const device: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'abc',
                },
                roles: [ADMIN_ROLE],
            };
            const first = await manager.loadChannel(info);

            authorizer.allowProcessingEvents = false;
            await manager.sendEvents(device, first, [
                fileAdded(
                    createFile('testId', {
                        abc: 'def',
                    })
                ),
            ]);

            expect(first.channel.helper.filesState['testId']).toBeUndefined();
        });

        // describe('say_hello', () => {
        //     it('should print "hello" to the console', async () => {
        //         const info = {
        //             id: 'test',
        //             type: 'aux',
        //         };
        //         const device: DeviceInfo = {
        //             claims: {
        //                 [USERNAME_CLAIM]: 'abc'
        //             },
        //             roles: [ADMIN_ROLE]
        //         };
        //         const first = await manager.loadChannel(info);

        //         authorizer.allowProcessingEvents = false;
        //         await manager.sendEvents(
        //             device,
        //             first,
        //             [
        //                 sayHello()
        //             ]
        //         );

        //         expect(logMock).toBeCalledWith('User abc says "Hello!"');
        //     });
        // });
    });
});
