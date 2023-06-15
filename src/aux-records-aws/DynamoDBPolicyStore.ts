import {
    ACCOUNT_MARKER,
    AssignedRole,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    GetUserPolicyResult,
    ListedRoleAssignments,
    ListedUserPolicy,
    PUBLIC_READ_MARKER,
    PolicyDocument,
    PolicyStore,
    RoleAssignment,
    UpdateRolesUpdate,
    UpdateUserPolicyResult,
    UpdateUserRolesResult,
    UserPolicyRecord,
    getExpireTime,
} from '@casual-simulation/aux-records';
import dynamodb from 'aws-sdk/clients/dynamodb';
import { differenceBy } from 'lodash';

/**
 * Defines a PolicyStore that can store data items in DynamoDB.
 */
export class DynamoDBPolicyStore implements PolicyStore {
    private _dynamo: dynamodb.DocumentClient;
    private _policiesTableName: string;
    private _subjectRolesTableName: string;
    private _roleSubjectsTableName: string;
    private _rolesTableName: string;

    constructor(
        client: dynamodb.DocumentClient,
        policiesTableName: string,
        subjectRolesTableName: string,
        roleSubjectsTableName: string,
        rolesTableName: string
    ) {
        this._dynamo = client;
        this._policiesTableName = policiesTableName;
        this._subjectRolesTableName = subjectRolesTableName;
        this._roleSubjectsTableName = roleSubjectsTableName;
        this._rolesTableName = rolesTableName;
    }

    async listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]> {
        const policies = [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];
        if (marker === PUBLIC_READ_MARKER) {
            policies.push(DEFAULT_PUBLIC_READ_POLICY_DOCUMENT);
        }

        const result = await this._dynamo
            .get({
                TableName: this._policiesTableName,
                Key: {
                    recordName: recordName,
                    marker: marker,
                },
            })
            .promise();

        const item: DynamoDBPolicy = result.Item as DynamoDBPolicy;
        if (item) {
            policies.push(item.document);
        }
        return policies;
    }

    async listUserPolicies(
        recordName: string,
        startingMarker: string | null
    ): Promise<ListedUserPolicy[]> {
        const query =
            typeof startingMarker === 'string'
                ? 'recordName = :recordName AND marker > :marker'
                : 'recordName = :recordName';
        const values =
            typeof startingMarker === 'string'
                ? {
                      ':recordName': recordName,
                      ':marker': startingMarker,
                  }
                : {
                      ':recordName': recordName,
                  };

        const result = await this._dynamo
            .query({
                TableName: this._policiesTableName,
                KeyConditionExpression: query,
                ExpressionAttributeValues: values,
                Limit: 10,
            })
            .promise();

        const items: DynamoDBPolicy[] = result.Items as DynamoDBPolicy[];

        return items.map((i) => {
            let policy: ListedUserPolicy = {
                marker: i.marker,
                document: i.document,
                markers: i.markers,
            };

            return policy;
        });
    }

    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]> {
        const result = await this._dynamo
            .get({
                TableName: this._subjectRolesTableName,
                Key: {
                    subjectId: `u/${userId}`,
                    recordName: recordName,
                },
            })
            .promise();

        const item: DynamoDBSubjectRoles = result.Item as DynamoDBSubjectRoles;
        if (item) {
            const now = Date.now();
            return item.roles.filter(
                (r) => getExpireTime(r.expireTimeMs) > now
            );
        } else {
            return [];
        }
    }

    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<AssignedRole[]> {
        const result = await this._dynamo
            .get({
                TableName: this._subjectRolesTableName,
                Key: {
                    subjectId: `i/${inst}`,
                    recordName: recordName,
                },
            })
            .promise();

        const item: DynamoDBSubjectRoles = result.Item as DynamoDBSubjectRoles;
        if (item) {
            const now = Date.now();
            return item.roles.filter(
                (r) => getExpireTime(r.expireTimeMs) > now
            );
        } else {
            return [];
        }
    }

    async listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments> {
        const result = await this._dynamo
            .query({
                TableName: this._roleSubjectsTableName,
                KeyConditionExpression: 'roleId = :roleId',
                ExpressionAttributeValues: {
                    ':roleId': `${recordName}/${role}`,
                },
            })
            .promise();

        const items: DynamoDBRoleSubjects[] =
            result.Items as DynamoDBRoleSubjects[];
        let assignments = [] as RoleAssignment[];
        for (let item of items) {
            if (getExpireTime(item.expireTimeMs) <= Date.now()) {
                continue;
            }

            if (item.subjectId.startsWith('u/')) {
                assignments.push({
                    type: 'user',
                    userId: item.subjectId.substring(2),
                    role: {
                        role: role,
                        expireTimeMs: item.expireTimeMs,
                    },
                });
            } else if (item.subjectId.startsWith('i/')) {
                assignments.push({
                    type: 'inst',
                    inst: item.subjectId.substring(2),
                    role: {
                        role: role,
                        expireTimeMs: item.expireTimeMs,
                    },
                });
            }
        }

        return {
            assignments,
        };
    }

    async getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult> {
        let result = await this._dynamo
            .get({
                TableName: this._policiesTableName,
                Key: {
                    recordName,
                    marker,
                },
            })
            .promise();

        let item: DynamoDBPolicy = result.Item as DynamoDBPolicy;
        if (item) {
            return {
                success: true,
                document: item.document,
                markers: item.markers,
            };
        }

        return {
            success: false,
            errorCode: 'policy_not_found',
            errorMessage: 'Policy not found.',
        };
    }

    async updateUserPolicy(
        recordName: string,
        marker: string,
        policy: UserPolicyRecord
    ): Promise<UpdateUserPolicyResult> {
        const item: DynamoDBPolicy = {
            recordName,
            marker,
            document: policy.document,
            markers: policy.markers,
        };
        let result = await this._dynamo.put({
            TableName: this._policiesTableName,
            Item: item,
        });

        return {
            success: true,
        };
    }

    async assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult> {
        const roles =
            type === 'user'
                ? await this.listRolesForUser(recordName, subjectId)
                : await this.listRolesForInst(recordName, subjectId);

        const filtered = roles.filter(
            (r) =>
                r.role !== role.role ||
                getExpireTime(r.expireTimeMs) <= role.expireTimeMs
        );

        if (type === 'user') {
            return await this.updateUserRoles(recordName, subjectId, {
                roles: [...filtered, role],
            });
        } else {
            return await this.updateInstRoles(recordName, subjectId, {
                roles: [...filtered, role],
            });
        }
    }

    async revokeSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: string
    ): Promise<UpdateUserRolesResult> {
        const roles =
            type === 'user'
                ? await this.listRolesForUser(recordName, subjectId)
                : await this.listRolesForInst(recordName, subjectId);

        const filtered = roles.filter((r) => r.role !== role);

        if (type === 'user') {
            return await this.updateUserRoles(recordName, subjectId, {
                roles: [...filtered],
            });
        } else {
            return await this.updateInstRoles(recordName, subjectId, {
                roles: [...filtered],
            });
        }
    }

    async updateUserRoles(
        recordName: string,
        userId: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        const roles = await this.listRolesForUser(recordName, userId);

        return await this._updateRoles(
            recordName,
            `u/${userId}`,
            update,
            roles
        );
    }

    async updateInstRoles(
        recordName: string,
        inst: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        const roles = await this.listRolesForInst(recordName, inst);
        return await this._updateRoles(recordName, `i/${inst}`, update, roles);
    }

    private async _updateRoles(
        recordName: string,
        subjectId: string,
        update: UpdateRolesUpdate,
        roles: AssignedRole[]
    ): Promise<UpdateUserRolesResult> {
        const newRoles = differenceBy(update.roles, roles, (r) => r.role);
        const removedRoles = differenceBy(roles, update.roles, (r) => r.role);

        if (newRoles.length <= 0 && removedRoles.length <= 0) {
            return {
                success: true,
            };
        }

        const subjectItem: DynamoDBSubjectRoles = {
            recordName,
            subjectId,
            roles: update.roles,
        };
        let items: dynamodb.DocumentClient.TransactWriteItemList = [
            {
                Put: {
                    TableName: this._subjectRolesTableName,
                    Item: subjectItem,
                },
            },
        ];

        for (let role of newRoles) {
            const roleItem: DynamoDBRole = {
                recordName,
                role: role.role,
                markers: [ACCOUNT_MARKER],
            };
            items.push({
                Put: {
                    TableName: this._rolesTableName,
                    Item: roleItem,
                    ConditionExpression:
                        'attribute_not_exists(recordName) AND attribute_not_exists(role)',
                },
            });

            const subjectItem: DynamoDBRoleSubjects = {
                roleId: `${recordName}/${role.role}`,
                subjectId,
                expireTimeMs: role.expireTimeMs,
            };

            items.push({
                Put: {
                    TableName: this._roleSubjectsTableName,
                    Item: subjectItem,
                },
            });
        }

        for (let role of removedRoles) {
            items.push({
                Delete: {
                    TableName: this._roleSubjectsTableName,
                    Key: {
                        roleId: `${recordName}/${role.role}`,
                        subjectId,
                    },
                },
            });
        }

        await this._dynamo
            .transactWrite({
                TransactItems: items,
            })
            .promise();

        return {
            success: true,
        };
    }
}

interface DynamoDBPolicy {
    recordName: string;
    marker: string;
    document: PolicyDocument;
    markers: string[];
}

interface DynamoDBSubjectRoles {
    subjectId: string;
    recordName: string;
    roles: AssignedRole[];
}

interface DynamoDBRoleSubjects {
    roleId: string;
    subjectId: string;
    expireTimeMs: number | null;
}

interface DynamoDBRole {
    recordName: string;
    role: string;
    markers: string[];
}
