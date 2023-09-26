import { CachingPolicyStore } from './CachingPolicyStore';
import { Cache } from './Cache';
import { MemoryStore } from './MemoryStore';
import { MemoryCache } from './MemoryCache';
import {
    ACCOUNT_MARKER,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    PolicyDocument,
} from '@casual-simulation/aux-common';

describe('CachingPolicyStore', () => {
    let inner: MemoryStore;
    let cache: MemoryCache;
    let store: CachingPolicyStore;
    let originalNow: () => number;
    let nowMock: jest.Mock<number>;

    const policy: PolicyDocument = {
        permissions: [],
    };

    beforeEach(() => {
        originalNow = Date.now;
        nowMock = Date.now = jest.fn();

        nowMock.mockReturnValue(0);

        inner = new MemoryStore({
            subscriptions: null as any,
        });
        cache = new MemoryCache();
        store = new CachingPolicyStore(inner, cache, 1);

        jest.spyOn(inner, 'listPoliciesForMarker');
        jest.spyOn(inner, 'listUserPolicies');
        jest.spyOn(inner, 'listRolesForUser');
        jest.spyOn(inner, 'listRolesForInst');

        inner.policies['test'] = {
            marker: {
                document: policy,
                markers: [ACCOUNT_MARKER],
            },
            marker2: {
                document: policy,
                markers: [ACCOUNT_MARKER],
            },
            marker3: {
                document: policy,
                markers: [ACCOUNT_MARKER],
            },
        };
    });

    afterEach(() => {
        Date.now = originalNow;
    });

    describe('listPoliciesForMarker()', () => {
        it('should store non-default policies in the store', async () => {
            const result = await store.listPoliciesForMarker('test', 'marker');

            expect(result).toEqual([
                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                policy,
            ]);

            const cached = await cache.retrieve<PolicyDocument[]>(
                `policies/test/marker`
            );

            expect(cached).toEqual([policy]);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/marker`,
                        {
                            data: [policy],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarker).toBeCalledTimes(1);
        });

        it('should not store the default publicRead policy', async () => {
            const result = await store.listPoliciesForMarker(
                'test',
                PUBLIC_READ_MARKER
            );

            expect(result).toEqual([
                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
            ]);

            const cached = await cache.retrieve<PolicyDocument[]>(
                `policies/test/${PUBLIC_READ_MARKER}`
            );

            expect(cached).toEqual([]);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/${PUBLIC_READ_MARKER}`,
                        {
                            data: [],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarker).toBeCalledTimes(1);

            const result2 = await store.listPoliciesForMarker(
                'test',
                PUBLIC_READ_MARKER
            );

            expect(result2).toEqual(result);
        });

        it('should not store the default publicWrite policy', async () => {
            const result = await store.listPoliciesForMarker(
                'test',
                PUBLIC_WRITE_MARKER
            );

            expect(result).toEqual([
                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT,
            ]);

            const cached = await cache.retrieve<PolicyDocument[]>(
                `policies/test/${PUBLIC_WRITE_MARKER}`
            );

            expect(cached).toEqual([]);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/${PUBLIC_WRITE_MARKER}`,
                        {
                            data: [],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarker).toBeCalledTimes(1);

            const result2 = await store.listPoliciesForMarker(
                'test',
                PUBLIC_WRITE_MARKER
            );

            expect(result2).toEqual(result);
        });

        it('should store empty lists', async () => {
            const result = await store.listPoliciesForMarker(
                'test',
                'nopolicies'
            );

            expect(result).toEqual([DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT]);

            const cached = await cache.retrieve<PolicyDocument[]>(
                `policies/test/nopolicies`
            );

            expect(cached).toEqual([]);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/nopolicies`,
                        {
                            data: [],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarker).toBeCalledTimes(1);
        });

        it('should include the any resource policy in cached results', async () => {
            await cache.store(`policies/test/marker`, [policy], 1);

            const result = await store.listPoliciesForMarker('test', 'marker');

            expect(result).toEqual([
                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                policy,
            ]);
            expect(inner.listPoliciesForMarker).toBeCalledTimes(0);
        });

        it('should return the store value if the cached data has expired', async () => {
            await cache.store(`policies/test/marker`, [policy], 1);

            nowMock.mockReturnValue(1001);

            const result = await store.listPoliciesForMarker('test', 'marker');

            expect(result).toEqual([
                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                policy,
            ]);

            const cached = await cache.retrieve<PolicyDocument[]>(
                `policies/test/marker`
            );

            expect(cached).toEqual([policy]);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/marker`,
                        {
                            data: [policy],
                            expireTimeMs: 2001,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarker).toBeCalledTimes(1);
        });
    });

    describe('listUserPolicies()', () => {
        it('should not cache anything', async () => {
            const list = await store.listUserPolicies('test', null as any);

            expect(list).toEqual({
                success: true,
                policies: [
                    {
                        marker: 'marker',
                        markers: [ACCOUNT_MARKER],
                        document: policy,
                    },
                    {
                        marker: 'marker2',
                        markers: [ACCOUNT_MARKER],
                        document: policy,
                    },
                    {
                        marker: 'marker3',
                        markers: [ACCOUNT_MARKER],
                        document: policy,
                    },
                ],
                totalCount: 3,
            });

            const list2 = await store.listUserPolicies('test', null as any);

            expect(list2).toEqual(list);
            expect(inner.listUserPolicies).toBeCalledTimes(2);
        });
    });

    describe('listRolesForUser()', () => {
        it('should cache the result from the store', async () => {
            inner.roles['test'] = {
                user1: new Set(['role1', 'role2']),
            };

            const result = await store.listRolesForUser('test', 'user1');

            expect(result).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);

            const result2 = await store.listRolesForUser('test', 'user1');
            expect(result2).toEqual(result);

            expect(inner.listRolesForUser).toBeCalledTimes(1);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `userRoles/test/user1`,
                        {
                            data: [
                                {
                                    role: 'role1',
                                    expireTimeMs: null,
                                },
                                {
                                    role: 'role2',
                                    expireTimeMs: null,
                                },
                            ],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
        });

        it('should cache empty results', async () => {
            const result = await store.listRolesForUser('test', 'user1');

            expect(result).toEqual([]);

            const result2 = await store.listRolesForUser('test', 'user1');
            expect(result2).toEqual(result);

            expect(inner.listRolesForUser).toBeCalledTimes(1);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `userRoles/test/user1`,
                        {
                            data: [],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
        });
    });

    describe('listRolesForInst()', () => {
        it('should cache the result from the store', async () => {
            inner.roles['test'] = {
                inst1: new Set(['role1', 'role2']),
            };

            const result = await store.listRolesForInst('test', 'inst1');

            expect(result).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);

            const result2 = await store.listRolesForInst('test', 'inst1');
            expect(result2).toEqual(result);

            expect(inner.listRolesForInst).toBeCalledTimes(1);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `instRoles/test/inst1`,
                        {
                            data: [
                                {
                                    role: 'role1',
                                    expireTimeMs: null,
                                },
                                {
                                    role: 'role2',
                                    expireTimeMs: null,
                                },
                            ],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
        });

        it('should cache empty results', async () => {
            const result = await store.listRolesForInst('test', 'inst1');

            expect(result).toEqual([]);

            const result2 = await store.listRolesForInst('test', 'inst1');
            expect(result2).toEqual(result);

            expect(inner.listRolesForInst).toBeCalledTimes(1);

            expect(cache.items).toEqual(
                new Map([
                    [
                        `instRoles/test/inst1`,
                        {
                            data: [],
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
        });
    });
});
