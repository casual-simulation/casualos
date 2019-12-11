import { NodeAuxChannel } from './NodeAuxChannel';
import {
    AuxCausalTree,
    GLOBALS_BOT_ID,
    bot,
    tag,
    value,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    site,
    ADMIN_ROLE,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
    atomId,
    atom,
} from '@casual-simulation/causal-trees';
import { filterAtom } from '@casual-simulation/aux-vm/vm';

let logMock = (console.log = jest.fn());
console.warn = jest.fn();

describe('NodeAuxChannel', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;

    beforeEach(async () => {
        tree = new AuxCausalTree(storedTree(site(1)), {
            filter: (tree, atom) =>
                filterAtom(<AuxCausalTree>tree, atom, () =>
                    channel ? <any>channel.helper : null
                ),
        });
        await tree.root();
    });

    function createChannel(id: string) {
        return (channel = new NodeAuxChannel(
            tree,
            {
                id: 'server',
                isGuest: false,
                name: 'Server',
                token: 'token',
                username: 'server',
            },
            {
                claims: {
                    [USERNAME_CLAIM]: 'server',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [SERVER_ROLE],
            },
            {
                config: { isBuilder: false, isPlayer: false },
                partitions: {
                    '*': {
                        type: 'causal_tree',
                        tree: tree,
                        id: id,
                    },
                },
            }
        ));
    }

    it('should create the globals bot with aux.whitelist.roles set to admin if the channel is the admin channel', async () => {
        const channel = createChannel('admin');

        await channel.initAndWait();

        const globals = channel.helper.botsState[GLOBALS_BOT_ID];
        expect(globals.tags['aux.whitelist.roles']).toEqual([ADMIN_ROLE]);
    });

    it('should create the channel with an atom filter that calls to onChannelAction()', async () => {
        const channel = createChannel('admin');

        await channel.initAndWait();

        const globals = channel.helper.botsState[GLOBALS_BOT_ID];
        await channel.helper.updateBot(globals, {
            tags: {
                onChannelAction: '@action.reject(that.action)',
            },
        });

        const b1 = atom(atomId(2, 100), tree.weave.atoms[0].id, bot('test'));
        const t1 = atom(atomId(2, 101), b1.id, tag('tag'));
        const v1 = atom(atomId(2, 102), t1.id, value('abc'));

        await tree.addMany([b1, t1, v1]);

        expect(channel.helper.botsState['test']).toBeUndefined();
    });

    // describe('say_hello', () => {
    //     it('should print "hello" to the console', async () => {
    //         const channel = createChannel('aux-admin');

    //         await channel.initAndWait();

    //         await channel.sendEvents([sayHello('abc')]);

    //         expect(logMock).toBeCalledWith('User abc says "Hello!"');
    //     });
    // });
});
