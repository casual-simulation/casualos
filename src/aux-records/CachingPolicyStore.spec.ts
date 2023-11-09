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
import { ListMarkerPoliciesResult } from './PolicyStore';

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

        jest.spyOn(inner, 'listPoliciesForMarkerAndUser');
        jest.spyOn(inner, 'listUserPolicies');
        jest.spyOn(inner, 'listRolesForUser');
        jest.spyOn(inner, 'listRolesForInst');
        jest.spyOn(inner, 'listAssignmentsForRole');
        jest.spyOn(inner, 'listAssignments');
        jest.spyOn(inner, 'getUserPolicy');

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

    describe('listPoliciesForMarkerAndUser()', () => {
        it('should store non-default policies in the store', async () => {
            const result = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                'marker'
            );

            expect(result).toEqual({
                policies: [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT, policy],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            const cached = await cache.retrieve<ListMarkerPoliciesResult>(
                `policies/test/userId/marker`
            );

            expect(cached).toEqual({
                policies: [policy],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/userId/marker`,
                        {
                            data: {
                                policies: [policy],
                                recordOwnerPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                                userPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                            },
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarkerAndUser).toBeCalledTimes(1);
        });

        it('should not store the default publicRead policy', async () => {
            const result = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                PUBLIC_READ_MARKER
            );

            expect(result).toEqual({
                policies: [
                    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                ],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            const cached = await cache.retrieve<ListMarkerPoliciesResult>(
                `policies/test/userId/${PUBLIC_READ_MARKER}`
            );

            expect(cached).toEqual({
                policies: [],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/userId/${PUBLIC_READ_MARKER}`,
                        {
                            data: {
                                policies: [],
                                recordOwnerPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                                userPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                            },
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarkerAndUser).toBeCalledTimes(1);

            const result2 = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                PUBLIC_READ_MARKER
            );

            expect(result2).toEqual(result);
        });

        it('should not store the default publicWrite policy', async () => {
            const result = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                PUBLIC_WRITE_MARKER
            );

            expect(result).toEqual({
                policies: [
                    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                    DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT,
                ],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            const cached = await cache.retrieve<ListMarkerPoliciesResult>(
                `policies/test/userId/${PUBLIC_WRITE_MARKER}`
            );

            expect(cached).toEqual({
                policies: [],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/userId/${PUBLIC_WRITE_MARKER}`,
                        {
                            data: {
                                policies: [],
                                recordOwnerPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                                userPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                            },
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarkerAndUser).toBeCalledTimes(1);

            const result2 = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                PUBLIC_WRITE_MARKER
            );

            expect(result2).toEqual(result);
        });

        it('should store empty lists', async () => {
            const result = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                'nopolicies'
            );

            expect(result).toEqual({
                policies: [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            const cached = await cache.retrieve<ListMarkerPoliciesResult>(
                `policies/test/userId/nopolicies`
            );

            expect(cached).toEqual({
                policies: [],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/userId/nopolicies`,
                        {
                            data: {
                                policies: [],
                                recordOwnerPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                                userPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                            },
                            expireTimeMs: 1000,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarkerAndUser).toBeCalledTimes(1);
        });

        it('should include the any resource policy in cached results', async () => {
            await cache.store(
                `policies/test/userId/marker`,
                {
                    policies: [policy],
                    recordOwnerPrivacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                    },
                    userPrivacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                    },
                },
                1
            );

            const result = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                'marker'
            );

            expect(result).toEqual({
                policies: [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT, policy],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });
            expect(inner.listPoliciesForMarkerAndUser).toBeCalledTimes(0);
        });

        it('should return the store value if the cached data has expired', async () => {
            await cache.store(
                `policies/test/userId/marker`,
                {
                    policies: [policy],
                    recordOwnerPrivacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                    },
                    userPrivacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                    },
                },
                1
            );

            nowMock.mockReturnValue(1001);

            const result = await store.listPoliciesForMarkerAndUser(
                'test',
                'userId',
                'marker'
            );

            expect(result).toEqual({
                policies: [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT, policy],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            const cached = await cache.retrieve<ListMarkerPoliciesResult>(
                `policies/test/userId/marker`
            );

            expect(cached).toEqual({
                policies: [policy],
                recordOwnerPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
                userPrivacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                },
            });

            expect(cache.items).toEqual(
                new Map([
                    [
                        `policies/test/userId/marker`,
                        {
                            data: {
                                policies: [policy],
                                recordOwnerPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                                userPrivacyFeatures: {
                                    publishData: true,
                                    allowPublicData: true,
                                },
                            },
                            expireTimeMs: 2001,
                        },
                    ],
                ])
            );
            expect(inner.listPoliciesForMarkerAndUser).toBeCalledTimes(1);
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

        it('should not return expired roles from the cache', async () => {
            await cache.store(
                `userRoles/test/user1`,
                [
                    {
                        role: 'role1',
                        expireTimeMs: 10,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: 12,
                    },
                ],
                1
            );

            nowMock.mockReturnValue(11);

            const result = await store.listRolesForUser('test', 'user1');

            expect(result).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: 12,
                },
            ]);

            expect(inner.listRolesForUser).toBeCalledTimes(0);
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

        it('should not return expired roles from the cache', async () => {
            await cache.store(
                `instRoles/test/inst1`,
                [
                    {
                        role: 'role1',
                        expireTimeMs: 10,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: 12,
                    },
                ],
                1
            );

            nowMock.mockReturnValue(11);

            const result = await store.listRolesForInst('test', 'inst1');

            expect(result).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: 12,
                },
            ]);

            expect(inner.listRolesForInst).toBeCalledTimes(0);
        });
    });

    describe('listAssignmentsForRole()', () => {
        it('should not cache anything', async () => {
            inner.roles['test'] = {
                user1: new Set(['role1', 'role2']),
                user2: new Set(['role1']),
            };

            const list = await store.listAssignmentsForRole('test', 'role1');

            expect(list).toEqual({
                assignments: [
                    {
                        type: 'user',
                        userId: 'user1',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'user2',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                ],
                totalCount: 2,
            });

            const list2 = await store.listAssignmentsForRole('test', 'role1');
            expect(list2).toEqual(list);

            expect(inner.listAssignmentsForRole).toBeCalledTimes(2);
        });
    });

    describe('listAssignments()', () => {
        it('should not cache anything', async () => {
            inner.roles['test'] = {
                user1: new Set(['role1', 'role2']),
                user2: new Set(['role1']),
            };

            const list = await store.listAssignments('test', null as any);

            expect(list).toEqual({
                assignments: [
                    {
                        type: 'user',
                        userId: 'user1',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'user2',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'user1',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                ],
                totalCount: 3,
            });

            const list2 = await store.listAssignments('test', null as any);
            expect(list2).toEqual(list);

            expect(inner.listAssignments).toBeCalledTimes(2);
        });
    });

    describe('getUserPolicy()', () => {
        it('should not cache anything', async () => {
            const result = await store.getUserPolicy('test', 'marker');

            expect(result).toEqual({
                success: true,
                markers: [ACCOUNT_MARKER],
                document: policy,
            });

            const result2 = await store.getUserPolicy('test', 'marker');
            expect(result2).toEqual(result);

            expect(inner.getUserPolicy).toBeCalledTimes(2);
        });
    });

    describe('updateUserPolicy()', () => {
        it('should update the user policy', async () => {
            const policy2: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        addresses: true,
                        role: 'dev',
                    },
                ],
            };

            const result = await store.updateUserPolicy('test', 'marker', {
                document: policy2,
                markers: [ACCOUNT_MARKER],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(inner.policies['test'].marker).toEqual({
                document: policy2,
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should delete the policy cache for the given marker', async () => {
            await cache.store(`policies/test/marker`, [policy], 1);

            const policy2: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        addresses: true,
                        role: 'dev',
                    },
                ],
            };

            const result = await store.updateUserPolicy('test', 'marker', {
                document: policy2,
                markers: [ACCOUNT_MARKER],
            });

            const cacheResult = await cache.retrieve(`policies/test/marker`);

            expect(cacheResult).toBe(undefined);

            expect(result).toEqual({
                success: true,
            });

            expect(inner.policies['test'].marker).toEqual({
                document: policy2,
                markers: [ACCOUNT_MARKER],
            });
        });
    });

    describe('assignSubjectRole()', () => {
        describe('user', () => {
            it('should update the roles for the user', async () => {
                const result = await store.assignSubjectRole(
                    'test',
                    'user1',
                    'user',
                    {
                        role: 'role99',
                        expireTimeMs: null,
                    }
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    user1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                });
            });

            it('should update the cache', async () => {
                await cache.store(
                    `userRoles/test/user1`,
                    [
                        {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    ],
                    1
                );

                const result = await store.assignSubjectRole(
                    'test',
                    'user1',
                    'user',
                    {
                        role: 'role99',
                        expireTimeMs: null,
                    }
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    user1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                });

                const cacheResult = await cache.retrieve(
                    `userRoles/test/user1`
                );
                expect(cacheResult).toBe(undefined);
            });
        });

        describe('inst', () => {
            it('should update the roles for the inst', async () => {
                const result = await store.assignSubjectRole(
                    'test',
                    'inst1',
                    'inst',
                    {
                        role: 'role99',
                        expireTimeMs: null,
                    }
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    inst1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                });
            });

            it('should update the cache', async () => {
                await cache.store(
                    `instRoles/test/inst1`,
                    [
                        {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    ],
                    1
                );

                const result = await store.assignSubjectRole(
                    'test',
                    'inst1',
                    'inst',
                    {
                        role: 'role99',
                        expireTimeMs: null,
                    }
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    inst1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                });

                const cacheResult = await cache.retrieve(
                    `instRoles/test/inst1`
                );
                expect(cacheResult).toBe(undefined);
            });
        });
    });

    describe('revokeSubjectRole()', () => {
        describe('user', () => {
            it('should update the roles for the user', async () => {
                inner.roleAssignments['test'] = {
                    user1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                };
                const result = await store.revokeSubjectRole(
                    'test',
                    'user1',
                    'user',
                    'role99'
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    user1: [],
                });
            });

            it('should update the cache', async () => {
                inner.roleAssignments['test'] = {
                    user1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                };
                await cache.store(
                    `userRoles/test/user1`,
                    [
                        {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    ],
                    1
                );

                const result = await store.revokeSubjectRole(
                    'test',
                    'user1',
                    'user',
                    'role99'
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    user1: [],
                });

                const cacheResult = await cache.retrieve(
                    `userRoles/test/user1`
                );
                expect(cacheResult).toBe(undefined);
            });
        });

        describe('inst', () => {
            it('should update the roles for the inst', async () => {
                inner.roleAssignments['test'] = {
                    inst1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                };
                const result = await store.revokeSubjectRole(
                    'test',
                    'inst1',
                    'inst',
                    'role99'
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    inst1: [],
                });
            });

            it('should update the cache', async () => {
                inner.roleAssignments['test'] = {
                    inst1: [
                        {
                            role: 'role99',
                            expireTimeMs: null,
                        },
                    ],
                };
                await cache.store(
                    `instRoles/test/inst1`,
                    [
                        {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    ],
                    1
                );

                const result = await store.revokeSubjectRole(
                    'test',
                    'inst1',
                    'inst',
                    'role99'
                );

                expect(result).toEqual({
                    success: true,
                });

                expect(inner.roleAssignments['test']).toEqual({
                    inst1: [],
                });

                const cacheResult = await cache.retrieve(
                    `instRoles/test/inst1`
                );
                expect(cacheResult).toBe(undefined);
            });
        });
    });
});
