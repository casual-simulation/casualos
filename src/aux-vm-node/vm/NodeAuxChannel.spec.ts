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
                        id: id,
                    },
                },
            }
        ));
    }

    it.skip('is a placeholder test', () => {});
});
