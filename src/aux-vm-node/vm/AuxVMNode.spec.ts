import { AuxVMNode } from './AuxVMNode';
import { AuxCausalTree, createFile } from '@casual-simulation/aux-common';
import { AuxConfig } from '@casual-simulation/aux-vm';
import { storedTree, site } from '@casual-simulation/causal-trees';
import { StateUpdatedEvent } from '@casual-simulation/aux-vm/managers';

describe('AuxVMNode', () => {
    let tree: AuxCausalTree;
    let config: AuxConfig;
    let vm: AuxVMNode;
    beforeEach(async () => {
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            host: 'test',
            id: 'id',
            treeName: 'treeName',
            user: {
                id: 'server',
                email: 'server',
                channelId: 'server',
                isGuest: false,
                name: 'Server',
                token: 'token',
                username: 'server',
            },
        };
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        vm = new AuxVMNode(tree, config);
    });

    it('should send state updated events', async () => {
        await vm.init();

        const updates: StateUpdatedEvent[] = [];
        vm.stateUpdated.subscribe(u => updates.push(u));

        await tree.addFile(
            createFile('test', {
                tags: {
                    abc: 'def',
                },
            })
        );

        // await Promise.resolve();
        // await Promise.resolve();
        // await Promise.resolve();

        expect(updates).toEqual([
            {
                state: {
                    test: {
                        id: 'test',
                        precalculated: true,
                        tags: {
                            abc: 'def',
                        },
                        values: {
                            abc: 'def',
                        },
                    },
                },
                addedFiles: ['test'],
                removedFiles: [],
                updatedFiles: [],
            },
        ]);
    });
});
