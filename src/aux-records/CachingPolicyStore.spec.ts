import { CachingPolicyStore } from './CachingPolicyStore';
import { Cache } from './Cache';
import { MemoryStore } from './MemoryStore';
import { MemoryCache } from './MemoryCache';
import {
    ACCOUNT_MARKER,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
} from '@casual-simulation/aux-common';

describe('CachingPolicyStore', () => {
    let inner: MemoryStore;
    let cache: MemoryCache;
    let store: CachingPolicyStore;
    let originalNow: () => number;
    let nowMock: jest.Mock<number>;

    beforeEach(() => {
        originalNow = Date.now;
        nowMock = Date.now = jest.fn();

        nowMock.mockReturnValue(0);

        inner = new MemoryStore({
            subscriptions: null as any,
        });
        cache = new MemoryCache();
        store = new CachingPolicyStore(inner, cache, 1);

        jest.spyOn(inner, 'listRolesForUser');
        jest.spyOn(inner, 'listRolesForInst');
        jest.spyOn(inner, 'listAssignmentsForRole');
        jest.spyOn(inner, 'listAssignments');
    });

    afterEach(() => {
        Date.now = originalNow;
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
