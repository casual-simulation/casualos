import { testPartitionImplementation } from './test/PartitionTests';
import { CausalRepoPartitionImpl } from './CausalRepoPartition';
import { Action, Atom, atomId, atom } from '@casual-simulation/causal-trees';
import { keypair } from '@casual-simulation/crypto';
import {
    createCertificate,
    asyncResult,
    botAdded,
    createBot,
    signTag,
    AsyncResultAction,
} from '../bots';
import { CertificateOp, signedCert } from '../aux-format-2';

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

    const keypair1 =
        'vK1.X9EJQT0znVqXj7D0kRyLSF1+F5u2bT7xKunF/H/SUxU=.djEueE1FL0VkOU1VanNaZGEwUDZ3cnlicjF5bnExZFptVzcubkxrNjV4ckdOTlM3Si9STGQzbGUvbUUzUXVEdmlCMWQucWZocVJQT21KeEhMbXVUWThORGwvU0M0dGdOdUVmaDFlcFdzMndYUllHWWxRZWpJRWthb1dJNnVZdXdNMFJVUTFWamkyc3JwMUpFTWJobk5sZ2Y2d01WTzRyTktDaHpwcUZGbFFnTUg0ZVU9';

    let c1: Atom<CertificateOp>;

    beforeAll(() => {
        const cert = signedCert(null, 'password', keypair1);
        c1 = atom(atomId('a', 0), null, cert);
    });

    it('should emit an async result for a signature', async () => {
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

        await partition.applyEvents([
            createCertificate(
                {
                    keypair: keypair1,
                    signingPassword: 'password',
                },
                'task1'
            ),
        ]);
        const certificateResult = events[0] as AsyncResultAction;

        await partition.applyEvents([
            botAdded(
                createBot('test', {
                    abc: 'def',
                })
            ),
        ]);

        await partition.applyEvents([
            signTag(
                certificateResult.result.id,
                'password',
                'test',
                'abc',
                'def',
                'task1'
            ),
        ]);

        expect(events.slice(1)).toEqual([asyncResult('task1', undefined)]);
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
