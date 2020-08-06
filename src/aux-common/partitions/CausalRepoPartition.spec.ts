import { testPartitionImplementation } from './test/PartitionTests';
import { CausalRepoPartitionImpl } from './CausalRepoPartition';
import { Action } from '@casual-simulation/causal-trees';
import { keypair } from '@casual-simulation/crypto';
import { createCertificate, asyncResult } from '../bots';

describe('CausalRepoPartition', () => {
    testPartitionImplementation(
        async () =>
            new CausalRepoPartitionImpl(
                {
                    id: 'test',
                    name: 'name',
                    token: 'token',
                    username: 'username',
                },
                { type: 'causal_repo' }
            )
    );

    it('should return immediate for the editStrategy', () => {
        const partition = new CausalRepoPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            { type: 'causal_repo' }
        );

        expect(partition.realtimeStrategy).toEqual('immediate');
    });

    it('should emit an async result for a certificate', async () => {
        const partition = new CausalRepoPartitionImpl(
            {
                id: 'test',
                name: 'name',
                token: 'token',
                username: 'username',
            },
            { type: 'causal_repo' }
        );

        let events = [] as Action[];
        partition.onEvents.subscribe(e => events.push(...e));

        const keys = keypair('password');
        await partition.applyEvents([
            createCertificate(
                {
                    keypair: keys,
                    signingPassword: 'password',
                },
                'task1'
            ),
        ]);

        expect(events).toEqual([
            asyncResult('task1', expect.any(Object), true),
        ]);
    });

    // it('should use the given space for bot events', async () => {
    //     partition.space = 'test';
    //     partition.connect();

    //     await partition.applyEvents([
    //         botAdded(createBot('test1', {
    //             abc: 'def'
    //         }, <any>'other'))
    //     ]);

    //     await waitAsync();

    //     expect(added).toEqual([
    //         createBot('test1', {
    //             abc: 'def'
    //         }, <any>'test')
    //     ]);
    // });

    // it('should use the given space for new atoms', async () => {
    //     partition.space = 'test';
    //     partition.connect();

    //     const bot1 = atom(atomId('a', 1), null, bot('bot1'));
    //     const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
    //     const value1 = atom(atomId('a', 3), tag1, value('abc'));

    //     addAtoms.next({
    //         branch: 'testBranch',
    //         atoms: [bot1,
    //             tag1,
    //             value1
    //         ]
    //     });

    //     await waitAsync();

    //     expect(added).toEqual([
    //         createBot('bot1', {
    //             tag1: 'abc'
    //         }, <any>'test')
    //     ]);
    // });
});
