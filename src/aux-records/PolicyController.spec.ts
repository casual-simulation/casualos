import { AuthController } from './AuthController';
import { AuthMessenger } from './AuthMessenger';
import { AuthStore } from './AuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import {
    AuthorizeRequest,
    AuthorizeResult,
    PolicyController,
    willMarkersBeRemaining,
} from './PolicyController';
import {
    ADMIN_ROLE_NAME,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    PolicyDocument,
    PUBLIC_READ_MARKER,
} from './PolicyPermissions';
import { PolicyStore } from './PolicyStore';
import { MemoryPolicyStore } from './MemoryPolicyStore';
import {
    formatV1RecordKey,
    parseRecordKey,
    RecordsController,
} from './RecordsController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from './TestUtils';

console.log = jest.fn();

describe('PolicyController', () => {
    let store: MemoryPolicyStore;
    let controller: PolicyController;

    let userId: string;
    let sessionKey: string;
    let recordKey: string;
    let recordName: string;

    let wrongRecordKey: string;

    beforeEach(async () => {
        const services = createTestControllers();

        store = services.policyStore;
        controller = services.policies;

        const user = await createTestUser(services);

        userId = user.userId;
        sessionKey = user.sessionKey;

        const testRecordKey = await createTestRecordKey(services, userId);
        recordKey = testRecordKey.recordKey;
        recordName = testRecordKey.recordName;

        const [name, password] = parseRecordKey(recordKey);
        wrongRecordKey = formatV1RecordKey('wrong record name', password);
    });

    describe('authorizeRequest()', () => {
        describe('data.create', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.create',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.create',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.create',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.create',
                                        grantingPermission: {
                                            type: 'data.create',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has data.create and policy.assign access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.create',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.create',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: 'developer',
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has data.create and policy.assign access to all of the resource markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const otherPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['other']: otherPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret', 'other'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has data.create but does not have policy.assign access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        role: 'developer',
                        marker: 'secret',
                        permission: 'policy.assign',
                    },
                });
            });

            it('should deny the request if the user has data.create but does not have policy.assign access from the same role', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer', 'other']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            // Even though this permission allows setting all policies,
                            // The user is not able to use multiple roles to satisy the data.create action
                            type: 'policy.assign',
                            role: 'other',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        role: 'developer',
                        marker: 'secret',
                        permission: 'policy.assign',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the does not have data.create access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'wrong',
                            addresses: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the data.create permission does not allow the given address', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'developer',
                            addresses: '^allowed_address$',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'not_allowed_address',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user does not have policy.assign access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.create',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        role: 'developer',
                        marker: 'secret',
                        permission: 'policy.assign',
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: PUBLIC_READ_MARKER,
                        permission: 'data.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'data.create',
                    address: 'myAddress',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.create',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.create',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: PUBLIC_READ_MARKER,
                        permission: 'data.create',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.create',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.create',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.create',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.create',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                        {
                                            action: 'policy.assign',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.assign',
                                                role: ADMIN_ROLE_NAME,
                                                policies: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.create',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.create',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                        {
                                            action: 'policy.assign',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.assign',
                                                role: ADMIN_ROLE_NAME,
                                                policies: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('data.read', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'data.read',
                    address: 'myAddress',
                    resourceMarkers: ['secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.read',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow the request if it is readable by everyone', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if the user has data.read permission for the marker', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: secretPolicy,
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if the user has data.read permission for one of the markers', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: secretPolicy,
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['other', 'secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if no User ID is provided but the policy allows public reading', async () => {
                const publicPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.read',
                            role: true,
                            addresses: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['public']: publicPolicy,
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    resourceMarkers: ['public'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should deny the request if the user does not have a data.read permission for the marker', async () => {
                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if no User ID is provided and the policy does not allow public reading', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the user has data.read permission but it does not allow the given address', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: '^different$',
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: secretPolicy,
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: secretPolicy,
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if given a record key to a different record', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'data.read',
                    address: 'myAddress',
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the marker', async () => {
                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.read',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has admin permissions even if there is no policy for the marker', async () => {
                store.roles = {
                    [recordName]: {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: 'secret',
                        permission: 'data.read',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.read',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: ['secret'],
                });

                expect(result.allowed).toEqual(true);
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('data.update', () => {
            it('should allow requests that dont update markers if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.update',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.update',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    existingMarkers: [],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow requests that remove markers if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.update',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER, 'secret'],
                    removedMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.unassign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.unassign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has data.update access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has data.update access to one of the given resources markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['other', 'secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have data.update access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user does not have policy.assign access for new markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'test',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if the user does not have policy.assign access for new markers from the same role as the data.update role', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer', 'other']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'other',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'test',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if the user does has policy.assign access for new markers but does not have data.update access for the existing marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user does not have policy.unassign access for removed markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                        // {
                        //     type: 'policy.unassign',
                        //     role: 'developer',
                        //     policies: true
                        // },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret', 'test'],
                    removedMarkers: ['test'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'test',
                        permission: 'policy.unassign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the data.update permission does not allow the given address', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'not_allowed_address',
                    userId,
                    existingMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if the update would remove all markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.unassign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'address',
                    userId,
                    existingMarkers: ['secret'],
                    removedMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers_remaining',
                    },
                });
            });

            it('should allow requests that replace all markers with new ones', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.unassign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                const otherPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.update',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['other']: otherPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'address',
                    userId,
                    existingMarkers: ['secret'],
                    removedMarkers: ['secret'],
                    addedMarkers: ['other'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.unassign',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'policy.unassign',
                                            role: 'developer',
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'other',
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy: otherPolicy,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy: otherPolicy,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: 'developer',
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: PUBLIC_READ_MARKER,
                        permission: 'data.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'data.update',
                    address: 'myAddress',
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.update',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    existingMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: PUBLIC_READ_MARKER,
                        permission: 'data.update',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.update',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.update',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.update',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.update',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('data.delete', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.delete',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.delete',
                    address: 'myAddress',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has data.delete access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.delete',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has data.delete access for one of the markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.delete',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['other', 'secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have data.delete access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.delete',
                        role: null,
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the data.delete permission does not allow the given address', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.delete',
                            role: 'developer',
                            addresses: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'not_allowed_address',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.delete',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: PUBLIC_READ_MARKER,
                        permission: 'data.delete',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'data.delete',
                    address: 'myAddress',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'data.delete',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: PUBLIC_READ_MARKER,
                        permission: 'data.delete',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.delete',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.delete',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.delete',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.delete',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.delete',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.delete',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('data.list', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.list',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });
            });

            it('should allow the request if the user has data.list access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.list',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });
            });

            it('should allow the request if the user has data.list access to one of the resources markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.list',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['other', 'secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret', 'other'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'other',
                                actions: [],
                            },
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: 'developer',
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['other', 'secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret', 'other'],
                        },
                    ],
                });
            });

            it('should filter out items that the user does not have data.list access to', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: true,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                });
            });

            it('should filter out all non-public items if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: null,
                    subject: {
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [],
                });
            });

            it('should filter out items if the data.list permission does not allow their address', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'data.list',
                            role: 'developer',
                            addresses: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'not_allowed_address',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [],
                });
            });

            it('should filter out all non-public items if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: true,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'data.list',
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should filter out all non-public items if there is no policy for the items marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: true,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                });
            });

            it('should allow all items if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });
            });

            it('should filter out items that are non-public when requested from an inst that does not have a role', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    instances: ['instance'],
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'allowed',
                            role: true,
                            markers: [
                                {
                                    marker: 'secret',
                                    actions: [],
                                },
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: true,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                    allowedDataItems: [
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                });
            });

            it('should filter out items that are non-public when requested from an inst that is admin, but the user is not', async () => {
                store.roles[recordName] = {
                    ['instance']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    instances: ['instance'],
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: true,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                    allowedDataItems: [
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                    ],
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'data.list',
                    userId,
                    instances: ['instance'],
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    instances: ['instance1', 'instance2'],
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'data.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'data.list',
                                            role: ADMIN_ROLE_NAME,
                                            addresses: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'data.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'data.list',
                                                role: ADMIN_ROLE_NAME,
                                                addresses: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                    allowedDataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'data.list',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    dataItems: [
                        {
                            address: 'testAddress',
                            markers: ['secret'],
                        },
                        {
                            address: 'testAddress3',
                            markers: [PUBLIC_READ_MARKER],
                        },
                        {
                            address: 'testAddress2',
                            markers: ['secret'],
                        },
                    ],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('file.create', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.create',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'application/json',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.create',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [],
                    fileSizeInBytes: 100,
                    fileMimeType: 'application/json',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has file.create and policy.assign access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: 'developer',
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: 'developer',
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have file.create and policy.assign access to all the given markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret', 'other'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'other',
                        permission: 'file.create',
                        role: 'developer',
                    },
                });
            });

            it('should allow the request if the file size equals the max file size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: 'developer',
                                            maxFileSizeInBytes: 100,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: 'developer',
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user has file.create but does not have policy.assign access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if the user has file.create but does not have policy.assign access from the same role', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer', 'other']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                        },
                        {
                            // Even though this permission allows setting all policies,
                            // The user is not able to use multiple roles to satisy the file.create action
                            type: 'policy.assign',
                            role: 'other',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileMimeType: 'text/plain',
                    fileSizeInBytes: 1000,
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the does not have file.create access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'wrong',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'video/mp4',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the file.create permission does not allow the file because it is too large', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the file.create permission does not allow the file because it has the wrong MIME Type', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                            allowedMimeTypes: ['text/plain'],
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'video/mp4',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user does not have policy.assign access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.create',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: PUBLIC_READ_MARKER,
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'file.create',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: PUBLIC_READ_MARKER,
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should deny the request if the inst is not allowed to upload files over a size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance']: new Set(['developer']),
                };

                store.policies[recordName] = {
                    secret: {
                        permissions: [
                            {
                                type: 'file.create',
                                role: 'developer',
                                maxFileSizeInBytes: 100,
                            },
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: 'secret',
                        permission: 'file.create',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'file.create',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the file', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.create',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.create',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'file.create',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.create',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                        {
                                            action: 'policy.assign',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.assign',
                                                role: ADMIN_ROLE_NAME,
                                                policies: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'file.create',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.create',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                        {
                                            action: 'policy.assign',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.assign',
                                                role: ADMIN_ROLE_NAME,
                                                policies: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.create',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('file.read', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.read',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'application/json',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.read',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [],
                    fileSizeInBytes: 100,
                    fileMimeType: 'application/json',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has file.read access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.read',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: 'developer',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has file.read access one of the markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.read',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret', 'other'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: 'developer',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the file size equals the max file size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.read',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: 'developer',
                                            maxFileSizeInBytes: 100,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    resourceMarkers: ['secret'],
                    fileMimeType: 'text/plain',
                    fileSizeInBytes: 1000,
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the does not have file.read access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.read',
                            role: 'wrong',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'video/mp4',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the file.read permission does not allow the file because it is too large', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.read',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the file.read permission does not allow the file because it has the wrong MIME Type', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.read',
                            role: 'developer',
                            allowedMimeTypes: ['text/plain'],
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'video/mp4',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'file.read',
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should allow the request if the file is public', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: true,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy:
                                            DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the inst is not allowed to read files over a size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance']: new Set(['developer']),
                };

                store.policies[recordName] = {
                    secret: {
                        permissions: [
                            {
                                type: 'file.read',
                                role: 'developer',
                                maxFileSizeInBytes: 100,
                            },
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: 'secret',
                        permission: 'file.read',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'file.read',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the file', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.read',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'file.read',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.read',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'file.read',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.read',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.read',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 1000,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('file.delete', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.delete',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.delete',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    resourceMarkers: [],
                    fileSizeInBytes: 100,
                    fileMimeType: 'application/json',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has file.delete access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.delete',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: 'developer',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has file.delete access to one of the given resource markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.delete',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['other', 'secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: 'developer',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have file.delete access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should allow the request if the file size equals the max file size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.delete',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: 'developer',
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: 'developer',
                                            maxFileSizeInBytes: 100,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user is not allowed to delete files over a size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.delete',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the file.read permission does not allow the file because it has the wrong MIME Type', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.delete',
                            role: 'developer',
                            allowedMimeTypes: ['text/plain'],
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'video/mp4',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: PUBLIC_READ_MARKER,
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'file.delete',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: PUBLIC_READ_MARKER,
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'file.delete',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should deny the request if the inst is not allowed to read files over a size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance']: new Set(['developer']),
                };

                store.policies[recordName] = {
                    secret: {
                        permissions: [
                            {
                                type: 'file.delete',
                                role: 'developer',
                                maxFileSizeInBytes: 100,
                            },
                        ],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    instances: ['instance'],
                    resourceMarkers: ['secret'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: 'secret',
                        permission: 'file.delete',
                        role: null,
                    },
                });
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.delete',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.delete',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'file.delete',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.delete',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'file.delete',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.delete',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.delete',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        describe('file.update', () => {
            it('should deny requests that dont update markers', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.update',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.update',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    existingMarkers: [],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'no_markers',
                    },
                });
            });

            it('should allow requests that remove markers if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'file.update',
                    recordKeyOrRecordName: recordKey,
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER, 'secret'],
                    removedMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.unassign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.unassign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have policy.assign access for new markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'test',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if the user does not have policy.assign access for new markers from the same role as the file.update role', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer', 'other']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                        {
                            type: 'policy.assign',
                            role: 'other',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'test',
                        permission: 'policy.assign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if the user does has policy.assign access for new markers but does not have file.update access for the existing marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user does not have policy.unassign access for removed markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                        // {
                        //     type: 'policy.unassign',
                        //     role: 'developer',
                        //     policies: true
                        // },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret', 'test'],
                    removedMarkers: ['test'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'test',
                        permission: 'policy.unassign',
                        role: 'developer',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    existingMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the file.update permission does not allow files over the given size', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                            maxFileSizeInBytes: 100,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'file.update',
                            role: 'developer',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: secretPolicy,
                    ['test']: testPolicy,
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                    fileSizeInBytes: 101,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: [PUBLIC_READ_MARKER],
                    addedMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: PUBLIC_READ_MARKER,
                        permission: 'file.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'file.update',
                    existingMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: userId,
                        marker: 'secret',
                        permission: 'file.update',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    existingMarkers: ['secret'],
                    addedMarkers: ['test'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'test',
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the request is coming from an inst and no role has been provided to said inst', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    instances: ['instance'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                    addedMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'inst',
                        id: 'instance',
                        marker: PUBLIC_READ_MARKER,
                        permission: 'file.update',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'file.update',
                    userId,
                    instances: ['instance'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                    addedMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: userId,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance',
                            authorizationType: 'not_required',
                        },
                    ],
                });
            });

            it('should allow the request if all the instances have roles for the data', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    instances: ['instance1', 'instance2'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                    addedMarkers: ['secret'],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: true,
                    recordName,
                    recordKeyOwnerId: null,
                    authorizerId: userId,
                    subject: {
                        userId,
                        role: ADMIN_ROLE_NAME,
                        subjectPolicy: 'subjectfull',
                        markers: [
                            {
                                marker: PUBLIC_READ_MARKER,
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'file.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'file.update',
                                            role: ADMIN_ROLE_NAME,
                                        },
                                    },
                                    {
                                        action: 'policy.assign',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.assign',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [
                        {
                            inst: 'instance1',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'file.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.update',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                    ],
                                },
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'file.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.update',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                        {
                                            action: 'policy.assign',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.assign',
                                                role: ADMIN_ROLE_NAME,
                                                policies: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            inst: 'instance2',
                            authorizationType: 'allowed',
                            role: ADMIN_ROLE_NAME,
                            markers: [
                                {
                                    marker: PUBLIC_READ_MARKER,
                                    actions: [
                                        {
                                            action: 'file.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.update',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                    ],
                                },
                                {
                                    marker: 'secret',
                                    actions: [
                                        {
                                            action: 'file.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'file.update',
                                                role: ADMIN_ROLE_NAME,
                                            },
                                        },
                                        {
                                            action: 'policy.assign',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.assign',
                                                role: ADMIN_ROLE_NAME,
                                                policies: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                });
            });

            it('should deny the request if more than 2 instances are provided', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                    ['instance1']: new Set([ADMIN_ROLE_NAME]),
                    ['instance2']: new Set([ADMIN_ROLE_NAME]),
                    ['instance3']: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'file.update',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
                    existingMarkers: [PUBLIC_READ_MARKER],
                    fileSizeInBytes: 100,
                    fileMimeType: 'text/plain',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage: `This action is not authorized because more than 2 instances are loaded.`,
                    reason: {
                        type: 'too_many_insts',
                    },
                });
            });
        });

        it('should deny the request if given an unrecognized action', async () => {
            const result = await controller.authorizeRequest({
                action: 'missing',
            } as any);

            expect(result).toEqual({
                allowed: false,
                errorCode: 'action_not_supported',
                errorMessage: 'The given action is not supported.',
            });
        });
    });
});

describe('willMarkersBeRemaining()', () => {
    it('should return true if no markers are being removed', () => {
        const existing = ['first', 'second'];
        const removed = [] as string[];
        const added = [] as string[];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(true);
    });

    it('should return false if all markers are being removed', () => {
        const existing = ['first', 'second'];
        const removed = ['second', 'first'];
        const added = [] as string[];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(false);
    });

    it('should return true if all markers are being replaced', () => {
        const existing = ['first', 'second'];
        const removed = ['first', 'second'];
        const added = ['third'];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(true);
    });

    it('should return true if only adding markers', () => {
        const existing = ['first', 'second'];
        const removed = [] as string[];
        const added = ['third'];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(true);
    });
});
