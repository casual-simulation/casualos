import { DynamoDBPolicyStore } from './DynamoDBPolicyStore';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { awsResult, awsError } from './AwsTestUtils';
import {
    ACCOUNT_MARKER,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    PolicyDocument,
} from '@casual-simulation/aux-records/PolicyPermissions';

console.warn = jest.fn();
console.error = jest.fn();

describe('DynamoDBPolicyStore', () => {
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        query: jest.fn(),
        update: jest.fn(),
        transactWrite: jest.fn(),
        scan: jest.fn(),
    };
    let store: DynamoDBPolicyStore;

    beforeEach(() => {
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            query: jest.fn(),
            update: jest.fn(),
            transactWrite: jest.fn(),
            scan: jest.fn(),
        };
        store = new DynamoDBPolicyStore(
            dynamodb as any,
            'policy-table',
            'subject-roles-table',
            'role-subjects-table',
            'roles-table'
        );

        dynamodb.get.mockReturnValue(
            awsResult({
                Item: null,
            })
        );
    });

    describe('listPoliciesForMarker()', () => {
        it('should get the policy that is stored for the marker', async () => {
            const document: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        role: 'developer',
                        addresses: true,
                    },
                ],
            };
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        recordName: 'test-record',
                        marker: 'test',
                        document: document,
                        markers: [ACCOUNT_MARKER],
                    },
                })
            );

            const policies = await store.listPoliciesForMarker(
                'test-record',
                'test'
            );

            expect(policies).toEqual([
                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                document,
            ]);

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'policy-table',
                Key: {
                    recordName: 'test-record',
                    marker: 'test',
                },
            });
        });
    });

    describe('listUserPolicies()', () => {
        it('should list the policies that users have created', async () => {
            const document: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        role: 'developer',
                        addresses: true,
                    },
                ],
            };
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            recordName: 'test-record',
                            marker: 'test',
                            document: document,
                            markers: [ACCOUNT_MARKER],
                        },
                    ],
                })
            );

            const policies = await store.listUserPolicies('test-record', null);

            expect(policies).toEqual([
                {
                    marker: 'test',
                    document: document,
                    markers: [ACCOUNT_MARKER],
                },
            ]);

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'policy-table',
                KeyConditionExpression: 'recordName = :recordName',
                ExpressionAttributeValues: {
                    ':recordName': 'test-record',
                },
                Limit: 10,
            });
        });

        it('should filter by the given marker', async () => {
            const document: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        role: 'developer',
                        addresses: true,
                    },
                ],
            };
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            recordName: 'test-record',
                            marker: 'test',
                            document: document,
                            markers: [ACCOUNT_MARKER],
                        },
                    ],
                })
            );

            const policies = await store.listUserPolicies('test-record', 'abc');

            expect(policies).toEqual([
                {
                    marker: 'test',
                    document: document,
                    markers: [ACCOUNT_MARKER],
                },
            ]);

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'policy-table',
                KeyConditionExpression:
                    'recordName = :recordName AND marker > :marker',
                ExpressionAttributeValues: {
                    ':recordName': 'test-record',
                    ':marker': 'abc',
                },
                Limit: 10,
            });
        });
    });

    describe('listRolesForUser()', () => {
        it('should list the roles for the user', async () => {
            let expireTimeMs = Date.now() + 1000000;

            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        subjectId: 'u/test',
                        recordName: 'recordName',
                        roles: [
                            {
                                role: 'role1',
                                expireTimeMs: null,
                            },
                            {
                                role: 'role2',
                                expireTimeMs: expireTimeMs,
                            },
                        ],
                    },
                })
            );

            const roles = await store.listRolesForUser('recordName', 'test');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
                {
                    role: 'role2',
                    expireTimeMs: expireTimeMs,
                },
            ]);

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'subject-roles-table',
                Key: {
                    subjectId: 'u/test',
                    recordName: 'recordName',
                },
            });
        });

        it('should filter out roles that have expired', async () => {
            // May 1st, 2023, UTC
            let expireTimeMs = 1682899200000;

            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        subjectId: 'u/test',
                        recordName: 'recordName',
                        roles: [
                            {
                                role: 'role1',
                                expireTimeMs: null,
                            },
                            {
                                role: 'role2',
                                expireTimeMs: expireTimeMs,
                            },
                        ],
                    },
                })
            );

            const roles = await store.listRolesForUser('recordName', 'test');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'subject-roles-table',
                Key: {
                    subjectId: 'u/test',
                    recordName: 'recordName',
                },
            });
        });
    });

    describe('listRolesForInst()', () => {
        it('should list the roles for the inst', async () => {
            let expireTimeMs = Date.now() + 1000000;

            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        subjectId: 'i/test',
                        recordName: 'recordName',
                        roles: [
                            {
                                role: 'role1',
                                expireTimeMs: null,
                            },
                            {
                                role: 'role2',
                                expireTimeMs: expireTimeMs,
                            },
                        ],
                    },
                })
            );

            const roles = await store.listRolesForInst('recordName', 'test');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
                {
                    role: 'role2',
                    expireTimeMs: expireTimeMs,
                },
            ]);

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'subject-roles-table',
                Key: {
                    subjectId: 'i/test',
                    recordName: 'recordName',
                },
            });
        });

        it('should filter out roles that have expired', async () => {
            // May 1st, 2023, UTC
            let expireTimeMs = 1682899200000;

            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        subjectId: 'i/test',
                        recordName: 'recordName',
                        roles: [
                            {
                                role: 'role1',
                                expireTimeMs: null,
                            },
                            {
                                role: 'role2',
                                expireTimeMs: expireTimeMs,
                            },
                        ],
                    },
                })
            );

            const roles = await store.listRolesForInst('recordName', 'test');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'subject-roles-table',
                Key: {
                    subjectId: 'i/test',
                    recordName: 'recordName',
                },
            });
        });
    });

    describe('listAssignmentsForRole()', () => {
        it('should list the assignments for the given role', async () => {
            let expireTimeMs = Date.now() + 1000000;

            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            roleId: 'recordName/role1',
                            subjectId: 'i/test',
                            expireTimeMs: null,
                        },
                        {
                            roleId: 'recordName/role1',
                            subjectId: 'u/test',
                            expireTimeMs: null,
                        },
                        {
                            roleId: 'recordName/role1',
                            subjectId: 'u/test2',
                            expireTimeMs: expireTimeMs,
                        },
                    ],
                })
            );

            const roles = await store.listAssignmentsForRole(
                'recordName',
                'role1'
            );

            expect(roles).toEqual({
                assignments: [
                    {
                        type: 'inst',
                        inst: 'test',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'test',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'test2',
                        role: {
                            role: 'role1',
                            expireTimeMs: expireTimeMs,
                        },
                    },
                ],
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'role-subjects-table',
                KeyConditionExpression: 'roleId = :roleId',
                ExpressionAttributeValues: {
                    ':roleId': 'recordName/role1',
                },
            });
        });

        it('should filter out roles that have expired', async () => {
            // May 1st, 2023, UTC
            let expireTimeMs = 1682899200000;

            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            roleId: 'recordName/role1',
                            subjectId: 'i/test',
                            expireTimeMs: null,
                        },
                        {
                            roleId: 'recordName/role1',
                            subjectId: 'u/test',
                            expireTimeMs: null,
                        },
                        {
                            roleId: 'recordName/role1',
                            subjectId: 'u/test2',
                            expireTimeMs: expireTimeMs,
                        },
                    ],
                })
            );

            const roles = await store.listAssignmentsForRole(
                'recordName',
                'role1'
            );

            expect(roles).toEqual({
                assignments: [
                    {
                        type: 'inst',
                        inst: 'test',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'test',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                ],
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'role-subjects-table',
                KeyConditionExpression: 'roleId = :roleId',
                ExpressionAttributeValues: {
                    ':roleId': 'recordName/role1',
                },
            });
        });
    });

    describe('getUserPolicy()', () => {
        it('should get the policy with the given marker', async () => {
            const document: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        role: 'developer',
                        addresses: true,
                    },
                ],
            };

            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        recordName: 'recordName',
                        marker: 'test',
                        document,
                        markers: [ACCOUNT_MARKER],
                    },
                })
            );

            const result = await store.getUserPolicy('recordName', 'test');

            expect(result).toEqual({
                success: true,
                document,
                markers: [ACCOUNT_MARKER],
            });

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'policy-table',
                Key: {
                    recordName: 'recordName',
                    marker: 'test',
                },
            });
        });

        it('should return not found if the item doesnt exist', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: null,
                })
            );

            const result = await store.getUserPolicy('recordName', 'test');

            expect(result).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: 'Policy not found.',
            });

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'policy-table',
                Key: {
                    recordName: 'recordName',
                    marker: 'test',
                },
            });
        });
    });

    describe('updateUserPolicy()', () => {
        it('should update the policy with the given marker', async () => {
            const document: PolicyDocument = {
                permissions: [
                    {
                        type: 'data.create',
                        role: 'developer',
                        addresses: true,
                    },
                ],
            };

            dynamodb.put.mockReturnValueOnce(awsResult({}));

            const result = await store.updateUserPolicy('recordName', 'test', {
                document,
                markers: [ACCOUNT_MARKER],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'policy-table',
                Item: {
                    recordName: 'recordName',
                    marker: 'test',
                    document,
                    markers: [ACCOUNT_MARKER],
                },
            });
        });
    });

    describe('updateUserRoles()', () => {
        it('should update the roles for the given user', async () => {
            dynamodb.transactWrite.mockReturnValueOnce(awsResult({}));

            const result = await store.updateUserRoles('recordName', 'test', {
                roles: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            });

            expect(dynamodb.transactWrite).toHaveBeenCalledWith({
                TransactItems: [
                    {
                        Put: {
                            TableName: 'subject-roles-table',
                            Item: {
                                subjectId: 'u/test',
                                recordName: 'recordName',
                                roles: [
                                    {
                                        role: 'role1',
                                        expireTimeMs: null,
                                    },
                                    {
                                        role: 'role2',
                                        expireTimeMs: null,
                                    },
                                ],
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: 'roles-table',
                            Item: {
                                recordName: 'recordName',
                                role: 'role1',
                                markers: [ACCOUNT_MARKER],
                            },
                            ConditionExpression:
                                'attribute_not_exists(recordName) AND attribute_not_exists(role)',
                        },
                    },
                    {
                        Put: {
                            TableName: 'role-subjects-table',
                            Item: {
                                roleId: 'recordName/role1',
                                subjectId: 'u/test',
                                expireTimeMs: null,
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: 'roles-table',
                            Item: {
                                recordName: 'recordName',
                                role: 'role2',
                                markers: [ACCOUNT_MARKER],
                            },
                            ConditionExpression:
                                'attribute_not_exists(recordName) AND attribute_not_exists(role)',
                        },
                    },
                    {
                        Put: {
                            TableName: 'role-subjects-table',
                            Item: {
                                roleId: 'recordName/role2',
                                subjectId: 'u/test',
                                expireTimeMs: null,
                            },
                        },
                    },
                ],
            });
        });

        it('should be able to delete roles that a user has', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        recordName: 'recordName',
                        subjectId: 'u/test',
                        roles: [
                            {
                                role: 'abc',
                                expireTimeMs: null,
                            },
                        ],
                    },
                })
            );

            dynamodb.transactWrite.mockReturnValueOnce(awsResult({}));

            const result = await store.updateUserRoles('recordName', 'test', {
                roles: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            });

            expect(dynamodb.transactWrite).toHaveBeenCalledWith({
                TransactItems: [
                    {
                        Put: {
                            TableName: 'subject-roles-table',
                            Item: {
                                subjectId: 'u/test',
                                recordName: 'recordName',
                                roles: [
                                    {
                                        role: 'role1',
                                        expireTimeMs: null,
                                    },
                                    {
                                        role: 'role2',
                                        expireTimeMs: null,
                                    },
                                ],
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: 'roles-table',
                            Item: {
                                recordName: 'recordName',
                                role: 'role1',
                                markers: [ACCOUNT_MARKER],
                            },
                            ConditionExpression:
                                'attribute_not_exists(recordName) AND attribute_not_exists(role)',
                        },
                    },
                    {
                        Put: {
                            TableName: 'role-subjects-table',
                            Item: {
                                roleId: 'recordName/role1',
                                subjectId: 'u/test',
                                expireTimeMs: null,
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: 'roles-table',
                            Item: {
                                recordName: 'recordName',
                                role: 'role2',
                                markers: [ACCOUNT_MARKER],
                            },
                            ConditionExpression:
                                'attribute_not_exists(recordName) AND attribute_not_exists(role)',
                        },
                    },
                    {
                        Put: {
                            TableName: 'role-subjects-table',
                            Item: {
                                roleId: 'recordName/role2',
                                subjectId: 'u/test',
                                expireTimeMs: null,
                            },
                        },
                    },
                    {
                        Delete: {
                            TableName: 'role-subjects-table',
                            Key: {
                                roleId: 'recordName/abc',
                                subjectId: 'u/test',
                            },
                        },
                    },
                ],
            });
        });
    });
});
