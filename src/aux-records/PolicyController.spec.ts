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
    ACCOUNT_MARKER,
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
import { InvalidZone } from 'luxon';

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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['other']: {
                        document: otherPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
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
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
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
                        ['public']: {
                            document: publicPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
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
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
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
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
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
                    action: 'data.read',
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
                    action: 'data.read',
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['other']: {
                        document: otherPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                        document: {
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
                        markers: [ACCOUNT_MARKER],
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                        document: {
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
                        markers: [ACCOUNT_MARKER],
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                        document: {
                            permissions: [
                                {
                                    type: 'file.delete',
                                    role: 'developer',
                                    maxFileSizeInBytes: 100,
                                },
                            ],
                        },
                        markers: ['secret'],
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
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

        describe('event.count', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'event.count',
                    eventName: 'myEvent',
                    resourceMarkers: ['secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should deny the request if no markers are provided', async () => {
                const result = await controller.authorizeRequest({
                    action: 'event.count',
                    eventName: 'myEvent',
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
                    action: 'event.count',
                    eventName: 'myEvent',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if the user has event.count permission for the marker', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.count',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if the user has event.count permission for one of the markers', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.count',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
                    userId,
                    resourceMarkers: ['other', 'secret'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should allow the request if no User ID is provided but the policy allows public reading', async () => {
                const publicPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.count',
                            role: true,
                            events: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['public']: {
                            document: publicPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
                    resourceMarkers: ['public'],
                });

                expect(result.allowed).toBe(true);
            });

            it('should deny the request if the user does not have a event.count permission for the marker', async () => {
                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
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
                        permission: 'event.count',
                        role: null,
                    },
                });
            });

            it('should deny the request if no User ID is provided and the policy does not allow public reading', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the user has event.count permission but it does not allow the given address', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.count',
                            role: 'developer',
                            events: '^different$',
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(['developer']),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
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
                        permission: 'event.count',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.count',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies = {
                    [recordName]: {
                        ['secret']: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    },
                };

                store.roles = {
                    [recordName]: {
                        [userId]: new Set(),
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.count',
                    eventName: 'myEvent',
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
                        permission: 'event.count',
                        role: null,
                    },
                });
            });

            it('should deny the request if given a record key to a different record', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'event.count',
                    eventName: 'myEvent',
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
                    action: 'event.count',
                    eventName: 'myEvent',
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
                        permission: 'event.count',
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
                    action: 'event.count',
                    eventName: 'myEvent',
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
                    action: 'event.count',
                    eventName: 'myEvent',
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
                        permission: 'event.count',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'event.count',
                    eventName: 'myEvent',
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
                    action: 'event.count',
                    eventName: 'myEvent',
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
                    action: 'event.count',
                    eventName: 'myEvent',
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

        describe('event.update', () => {
            it('should allow requests that dont update markers if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
                                        },
                                    },
                                ],
                            },
                            {
                                marker: 'secret',
                                actions: [
                                    {
                                        action: 'event.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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

            it('should allow the request if the user has event.update access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: 'developer',
                                            events: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has event.update access to one of the given resources markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: 'developer',
                                            events: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have event.update access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                        permission: 'event.update',
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
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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

            it('should deny the request if the user does not have policy.assign access for new markers from the same role as the event.update role', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer', 'other']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'other',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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

            it('should deny the request if the user does has policy.assign access for new markers but does not have event.update access for the existing marker', async () => {
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
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                        permission: 'event.update',
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
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                const testPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                        // {
                        //     type: 'policy.unassign',
                        //     role: 'developer',
                        //     policies: true
                        // },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['test']: {
                        document: testPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                    action: 'event.update',
                    eventName: 'myEvent',
                    existingMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the event.update permission does not allow the given address', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.update',
                            role: 'developer',
                            events: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'not_allowed_address',
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
                        permission: 'event.update',
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
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                        {
                            type: 'policy.unassign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'address',
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
                            type: 'event.update',
                            role: 'developer',
                            events: true,
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
                            type: 'event.update',
                            role: 'developer',
                            events: true,
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                    ['other']: {
                        document: otherPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.update',
                    eventName: 'address',
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
                                        action: 'event.update',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: 'developer',
                                            events: true,
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
                                        action: 'event.update',
                                        grantingPolicy: otherPolicy,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: 'developer',
                                            events: true,
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                        permission: 'event.update',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                        permission: 'event.update',
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                        permission: 'event.update',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.update',
                    eventName: 'myEvent',
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
                                        action: 'event.update',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.update',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                                            action: 'event.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'event.update',
                                                role: ADMIN_ROLE_NAME,
                                                events: true,
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
                                            action: 'event.update',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'event.update',
                                                role: ADMIN_ROLE_NAME,
                                                events: true,
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
                    action: 'event.update',
                    eventName: 'myEvent',
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

        describe('event.increment', () => {
            it('should allow requests that dont update markers if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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

            it('should allow the request if the user has event.increment access to the given resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.increment',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: 'developer',
                                            events: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should allow the request if the user has event.increment access to one of the given resources markers', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.increment',
                            role: 'developer',
                            events: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPolicy: secretPolicy,
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: 'developer',
                                            events: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have event.increment access', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                        permission: 'event.increment',
                        role: null,
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.increment',
                    eventName: 'myEvent',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the event.increment permission does not allow the given address', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'event.increment',
                            role: 'developer',
                            events: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    ['secret']: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.increment',
                    eventName: 'not_allowed_address',
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
                        permission: 'event.increment',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                        permission: 'event.increment',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                        permission: 'event.increment',
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                        permission: 'event.increment',
                        role: null,
                    },
                });
            });

            it('should skip inst role checks when a record key is used', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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
                                        action: 'event.increment',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'event.increment',
                                            role: ADMIN_ROLE_NAME,
                                            events: true,
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
                                            action: 'event.increment',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'event.increment',
                                                role: ADMIN_ROLE_NAME,
                                                events: true,
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
                                            action: 'event.increment',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'event.increment',
                                                role: ADMIN_ROLE_NAME,
                                                events: true,
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
                    action: 'event.increment',
                    eventName: 'myEvent',
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

        describe('policy.grantPermission', () => {
            it('should deny the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'policy.grantPermission',
                    policy: 'myPolicy',
                    recordKeyOrRecordName: recordKey,
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.grantPermission',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'myPolicy',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.grantPermission',
                                        grantingPermission: {
                                            type: 'policy.grantPermission',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
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

            it('should allow the request if the user has policy.grantPermission access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const accountPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.grantPermission',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: accountPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'myPolicy',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.grantPermission',
                                        grantingPolicy: accountPolicy,
                                        grantingPermission: {
                                            type: 'policy.grantPermission',
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

            it('should deny the request if the user does not have policy.grantPermission access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'myPolicy',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.grantPermission',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'myPolicy',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the policy.grantPermission permission does not allow the given policy', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.grantPermission',
                            role: 'developer',
                            policies: '^allowed_address$',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'not_allowed_address',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.grantPermission',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.grantPermission',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.grantPermission',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.grantPermission',
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
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.grantPermission',
                        role: null,
                    },
                });
            });

            it('should not skip inst role checks when a record key is used', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.grantPermission',
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
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.grantPermission',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.grantPermission',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.grantPermission',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.grantPermission',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.grantPermission',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.grantPermission',
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
                    action: 'policy.grantPermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
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

        describe('policy.revokePermission', () => {
            it('should deny the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'policy.revokePermission',
                    policy: 'myPolicy',
                    recordKeyOrRecordName: recordKey,
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.revokePermission',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'myPolicy',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.revokePermission',
                                        grantingPermission: {
                                            type: 'policy.revokePermission',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
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

            it('should allow the request if the user has policy.revokePermission access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const accountPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.revokePermission',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: accountPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'myPolicy',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.revokePermission',
                                        grantingPolicy: accountPolicy,
                                        grantingPermission: {
                                            type: 'policy.revokePermission',
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

            it('should deny the request if the user does not have policy.revokePermission access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'myPolicy',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.revokePermission',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'myPolicy',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the policy.revokePermission permission does not allow the given policy', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.revokePermission',
                            role: 'developer',
                            policies: '^allowed_address$',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'not_allowed_address',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.revokePermission',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.revokePermission',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.revokePermission',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.revokePermission',
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
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.revokePermission',
                        role: null,
                    },
                });
            });

            it('should not skip inst role checks when a record key is used', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.revokePermission',
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
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.revokePermission',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.revokePermission',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.revokePermission',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.revokePermission',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.revokePermission',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.revokePermission',
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
                    action: 'policy.revokePermission',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
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

        describe('policy.read', () => {
            it('should deny the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'policy.read',
                    policy: 'myPolicy',
                    recordKeyOrRecordName: recordKey,
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.read',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'myPolicy',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.read',
                                        grantingPermission: {
                                            type: 'policy.read',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
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

            it('should allow the request if the user has policy.read access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const accountPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.read',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: accountPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'myPolicy',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.read',
                                        grantingPolicy: accountPolicy,
                                        grantingPermission: {
                                            type: 'policy.read',
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

            it('should deny the request if the user does not have policy.read access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'myPolicy',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.read',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'myPolicy',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the policy.read permission does not allow the given policy', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.read',
                            role: 'developer',
                            policies: '^allowed_address$',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'not_allowed_address',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'myAddress',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'policy.read',
                    policy: 'myAddress',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.read',
                    policy: 'myAddress',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.read',
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
                    action: 'policy.read',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.read',
                        role: null,
                    },
                });
            });

            it('should not skip inst role checks when a record key is used', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'policy.read',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.read',
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
                    action: 'policy.read',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.read',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.read',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.read',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.read',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.read',
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
                    action: 'policy.read',
                    policy: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
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

        describe('policy.list', () => {
            it('should deny the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'policy.list',
                    recordKeyOrRecordName: recordKey,
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.list',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.list',
                                        grantingPermission: {
                                            type: 'policy.list',
                                            role: ADMIN_ROLE_NAME,
                                            policies: true,
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

            it('should allow the request if the user has policy.list access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const accountPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.list',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: accountPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.list',
                                        grantingPolicy: accountPolicy,
                                        grantingPermission: {
                                            type: 'policy.list',
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

            it('should deny the request if the user does not have policy.list access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.list',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the policy.list permission does not allow the given policy', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'policy.list',
                            role: 'developer',
                            policies: '^allowed_address$',
                        },
                        {
                            type: 'policy.assign',
                            role: 'developer',
                            policies: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.list',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.list',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'policy.list',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'policy.list',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.list',
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
                    action: 'policy.list',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.list',
                        role: null,
                    },
                });
            });

            it('should not skip inst role checks when a record key is used', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'policy.list',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'policy.list',
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
                    action: 'policy.list',
                    userId,
                    instances: ['instance1', 'instance2'],
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'policy.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'policy.list',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.list',
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'policy.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'policy.list',
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
                    action: 'policy.list',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
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

        describe('role.list', () => {
            it('should deny the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'role.list',
                    recordKeyOrRecordName: recordKey,
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.list',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.list',
                                        grantingPermission: {
                                            type: 'role.list',
                                            role: ADMIN_ROLE_NAME,
                                            roles: true,
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

            it('should allow the request if the user has role.list access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const accountPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'role.list',
                            role: 'developer',
                            roles: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: accountPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.list',
                                        grantingPolicy: accountPolicy,
                                        grantingPermission: {
                                            type: 'role.list',
                                            role: 'developer',
                                            roles: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have role.list access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'role.list',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the role.list permission does not allow all roles', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'role.list',
                            role: 'developer',
                            roles: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.list',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.list',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'role.list',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.list',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'role.list',
                                            role: ADMIN_ROLE_NAME,
                                            roles: true,
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
                    action: 'role.list',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.list',
                        role: null,
                    },
                });
            });

            it('should not skip inst role checks when a record key is used', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'role.list',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.list',
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
                    action: 'role.list',
                    userId,
                    instances: ['instance1', 'instance2'],
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.list',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'role.list',
                                            role: ADMIN_ROLE_NAME,
                                            roles: true,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.list',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.list',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.list',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
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
                    action: 'role.list',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
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

        describe('role.read', () => {
            it('should deny the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'role.read',
                    role: 'myRole',
                    recordKeyOrRecordName: recordKey,
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.read',
                        role: null,
                    },
                });
            });

            it('should allow the request if the user has the admin role assigned', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'myRole',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.read',
                                        grantingPermission: {
                                            type: 'role.read',
                                            role: ADMIN_ROLE_NAME,
                                            roles: true,
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

            it('should allow the request if the user has policy.read access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const accountPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'role.read',
                            role: 'developer',
                            roles: true,
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: accountPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'myRole',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.read',
                                        grantingPolicy: accountPolicy,
                                        grantingPermission: {
                                            type: 'role.read',
                                            role: 'developer',
                                            roles: true,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    instances: [],
                });
            });

            it('should deny the request if the user does not have role.read access to the account resource marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'myRole',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'role.read',
                    },
                });
            });

            it('should deny the request if given no userId or record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'myRole',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                });
            });

            it('should deny the request if the policy.read permission does not allow the given policy', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const secretPolicy: PolicyDocument = {
                    permissions: [
                        {
                            type: 'role.read',
                            role: 'developer',
                            roles: '^allowed_address$',
                        },
                    ],
                };

                store.policies[recordName] = {
                    [ACCOUNT_MARKER]: {
                        document: secretPolicy,
                        markers: [ACCOUNT_MARKER],
                    },
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'not_allowed_address',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if the user has no role assigned', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'myAddress',
                    userId,
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.read',
                        role: null,
                    },
                });
            });

            it('should deny the request if given an invalid record key', async () => {
                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: wrongRecordKey,
                    action: 'role.read',
                    role: 'myAddress',
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                });
            });

            it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.read',
                    role: 'myAddress',
                    userId,
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'role.read',
                                            role: ADMIN_ROLE_NAME,
                                            roles: true,
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
                    action: 'role.read',
                    role: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.read',
                        role: null,
                    },
                });
            });

            it('should not skip inst role checks when a record key is used', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordKey,
                    action: 'role.read',
                    role: 'myAddress',
                    userId,
                    instances: ['instance'],
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
                        marker: ACCOUNT_MARKER,
                        permission: 'role.read',
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
                    action: 'role.read',
                    role: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
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
                                marker: ACCOUNT_MARKER,
                                actions: [
                                    {
                                        action: 'role.read',
                                        grantingPolicy:
                                            DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                        grantingPermission: {
                                            type: 'role.read',
                                            role: ADMIN_ROLE_NAME,
                                            roles: true,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.read',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.read',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.read',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.read',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
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
                    action: 'role.read',
                    role: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2', 'instance3'],
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

        describe('role.grant', () => {
            const typeCases = [
                ['user', { targetUserId: 'targetUserId' }] as const,
                ['inst', { targetInstance: 'targetInstance' }] as const,
            ];

            describe.each(typeCases)('%s', (desc, target) => {
                it('should deny the request if given a record key', async () => {
                    const result = await controller.authorizeRequest({
                        action: 'role.grant',
                        role: 'myRole',
                        recordKeyOrRecordName: recordKey,
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                            role: null,
                        },
                    });
                });

                it('should allow the request if the user has the admin role assigned', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'myRole',
                        userId,
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.grant',
                                            grantingPermission: {
                                                type: 'role.grant',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
                                                userIds: true,
                                                instances: true,
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

                it('should allow the request if the user has role.grant access to the account resource marker', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const accountPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.grant',
                                role: 'developer',
                                roles: true,
                                userIds: true,
                                instances: true,
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: accountPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'myRole',
                        userId,
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.grant',
                                            grantingPolicy: accountPolicy,
                                            grantingPermission: {
                                                type: 'role.grant',
                                                role: 'developer',
                                                roles: true,
                                                userIds: true,
                                                instances: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        instances: [],
                    });
                });

                it('should deny the request if the user does not have role.grant access to the account resource marker', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'myRole',
                        userId,
                        ...target,
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
                            role: null,
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                        },
                    });
                });

                it('should deny the request if given no userId or record key', async () => {
                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'myRole',
                        ...target,
                    });

                    expect(result).toEqual({
                        allowed: false,
                        errorCode: 'not_logged_in',
                        errorMessage:
                            'The user must be logged in. Please provide a sessionKey or a recordKey.',
                    });
                });

                it('should deny the request if the role.grant permission does not allow the given role', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const secretPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.grant',
                                role: 'developer',
                                roles: '^allowed_address$',
                                userIds: true,
                                instances: true,
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'not_allowed_address',
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                            role: null,
                        },
                    });
                });

                it('should deny the request if the role.grant permission does not allow the given target', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const secretPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.grant',
                                role: 'developer',
                                roles: true,
                                userIds: ['notTargetId'],
                                instances: '^notTargetInst$',
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'not_allowed_address',
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                            role: null,
                        },
                    });
                });

                it('should deny the request if the expiration time is longer than the allowed duration', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const secretPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.grant',
                                role: 'developer',
                                roles: true,
                                userIds: true,
                                instances: true,
                                maxDurationMs: 1000,
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'not_allowed_address',
                        userId,
                        ...target,
                        expireTimeMs: Infinity,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                            role: null,
                        },
                    });
                });

                it('should deny the request if the user has no role assigned', async () => {
                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'myAddress',
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                            role: null,
                        },
                    });
                });

                it('should deny the request if given an invalid record key', async () => {
                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: wrongRecordKey,
                        action: 'role.grant',
                        role: 'myRole',
                        ...target,
                    });

                    expect(result).toEqual({
                        allowed: false,
                        errorCode: 'record_not_found',
                        errorMessage: 'Record not found.',
                    });
                });

                it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.grant',
                        role: 'myAddress',
                        userId,
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.grant',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.grant',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
                                                userIds: true,
                                                instances: true,
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
                        action: 'role.grant',
                        role: 'myAddress',
                        userId,
                        instances: ['instance'],
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
                            role: null,
                        },
                    });
                });

                it('should not skip inst role checks when a record key is used', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordKey,
                        action: 'role.grant',
                        role: 'myAddress',
                        userId,
                        instances: ['instance'],
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.grant',
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
                        action: 'role.grant',
                        role: 'myAddress',
                        userId,
                        instances: ['instance1', 'instance2'],
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.grant',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.grant',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
                                                userIds: true,
                                                instances: true,
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
                                        marker: ACCOUNT_MARKER,
                                        actions: [
                                            {
                                                action: 'role.grant',
                                                grantingPolicy:
                                                    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                                grantingPermission: {
                                                    type: 'role.grant',
                                                    role: ADMIN_ROLE_NAME,
                                                    roles: true,
                                                    userIds: true,
                                                    instances: true,
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
                                        marker: ACCOUNT_MARKER,
                                        actions: [
                                            {
                                                action: 'role.grant',
                                                grantingPolicy:
                                                    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                                grantingPermission: {
                                                    type: 'role.grant',
                                                    role: ADMIN_ROLE_NAME,
                                                    roles: true,
                                                    userIds: true,
                                                    instances: true,
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
                        action: 'role.grant',
                        role: 'myAddress',
                        userId,
                        instances: ['instance1', 'instance2', 'instance3'],
                        ...target,
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

            it('should deny the request if no target is given', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.grant',
                    role: 'myRole',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'role.grant',
                    },
                });
            });

            it('should deny the request if both a target user and inst is given', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.grant',
                    role: 'myRole',
                    userId,
                    targetUserId: 'targetUserId',
                    targetInstance: 'targetInstance',
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'role.grant',
                    },
                });
            });
        });

        describe('role.revoke', () => {
            const typeCases = [
                ['user', { targetUserId: 'targetUserId' }] as const,
                ['inst', { targetInstance: 'targetInstance' }] as const,
            ];

            describe.each(typeCases)('%s', (desc, target) => {
                it('should deny the request if given a record key', async () => {
                    const result = await controller.authorizeRequest({
                        action: 'role.revoke',
                        role: 'myRole',
                        recordKeyOrRecordName: recordKey,
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
                            role: null,
                        },
                    });
                });

                it('should allow the request if the user has the admin role assigned', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'myRole',
                        userId,
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.revoke',
                                            grantingPermission: {
                                                type: 'role.revoke',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
                                                userIds: true,
                                                instances: true,
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

                it('should allow the request if the user has role.revoke access to the account resource marker', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const accountPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.revoke',
                                role: 'developer',
                                roles: true,
                                userIds: true,
                                instances: true,
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: accountPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'myRole',
                        userId,
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.revoke',
                                            grantingPolicy: accountPolicy,
                                            grantingPermission: {
                                                type: 'role.revoke',
                                                role: 'developer',
                                                roles: true,
                                                userIds: true,
                                                instances: true,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        instances: [],
                    });
                });

                it('should deny the request if the user does not have role.revoke access to the account resource marker', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'myRole',
                        userId,
                        ...target,
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
                            role: null,
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
                        },
                    });
                });

                it('should deny the request if given no userId or record key', async () => {
                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'myRole',
                        ...target,
                    });

                    expect(result).toEqual({
                        allowed: false,
                        errorCode: 'not_logged_in',
                        errorMessage:
                            'The user must be logged in. Please provide a sessionKey or a recordKey.',
                    });
                });

                it('should deny the request if the role.revoke permission does not allow the given role', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const secretPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.revoke',
                                role: 'developer',
                                roles: '^allowed_address$',
                                userIds: true,
                                instances: true,
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'not_allowed_address',
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
                            role: null,
                        },
                    });
                });

                it('should deny the request if the role.revoke permission does not allow the given target', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set(['developer']),
                    };

                    const secretPolicy: PolicyDocument = {
                        permissions: [
                            {
                                type: 'role.revoke',
                                role: 'developer',
                                roles: true,
                                userIds: ['notTargetId'],
                                instances: '^notTargetInst$',
                            },
                        ],
                    };

                    store.policies[recordName] = {
                        [ACCOUNT_MARKER]: {
                            document: secretPolicy,
                            markers: [ACCOUNT_MARKER],
                        },
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'allowed_address',
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
                            role: null,
                        },
                    });
                });

                it('should deny the request if the user has no role assigned', async () => {
                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'myAddress',
                        userId,
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
                            role: null,
                        },
                    });
                });

                it('should deny the request if given an invalid record key', async () => {
                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: wrongRecordKey,
                        action: 'role.revoke',
                        role: 'myRole',
                        ...target,
                    });

                    expect(result).toEqual({
                        allowed: false,
                        errorCode: 'record_not_found',
                        errorMessage: 'Record not found.',
                    });
                });

                it('should allow the request if the user is an admin even though there is no policy for the account marker', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordName,
                        action: 'role.revoke',
                        role: 'myAddress',
                        userId,
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.revoke',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.revoke',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
                                                userIds: true,
                                                instances: true,
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
                        action: 'role.revoke',
                        role: 'myAddress',
                        userId,
                        instances: ['instance'],
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
                            role: null,
                        },
                    });
                });

                it('should not skip inst role checks when a record key is used', async () => {
                    store.roles[recordName] = {
                        [userId]: new Set([ADMIN_ROLE_NAME]),
                    };

                    const result = await controller.authorizeRequest({
                        recordKeyOrRecordName: recordKey,
                        action: 'role.revoke',
                        role: 'myAddress',
                        userId,
                        instances: ['instance'],
                        ...target,
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
                            marker: ACCOUNT_MARKER,
                            permission: 'role.revoke',
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
                        action: 'role.revoke',
                        role: 'myAddress',
                        userId,
                        instances: ['instance1', 'instance2'],
                        ...target,
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
                                    marker: ACCOUNT_MARKER,
                                    actions: [
                                        {
                                            action: 'role.revoke',
                                            grantingPolicy:
                                                DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                            grantingPermission: {
                                                type: 'role.revoke',
                                                role: ADMIN_ROLE_NAME,
                                                roles: true,
                                                userIds: true,
                                                instances: true,
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
                                        marker: ACCOUNT_MARKER,
                                        actions: [
                                            {
                                                action: 'role.revoke',
                                                grantingPolicy:
                                                    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                                grantingPermission: {
                                                    type: 'role.revoke',
                                                    role: ADMIN_ROLE_NAME,
                                                    roles: true,
                                                    userIds: true,
                                                    instances: true,
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
                                        marker: ACCOUNT_MARKER,
                                        actions: [
                                            {
                                                action: 'role.revoke',
                                                grantingPolicy:
                                                    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                                                grantingPermission: {
                                                    type: 'role.revoke',
                                                    role: ADMIN_ROLE_NAME,
                                                    roles: true,
                                                    userIds: true,
                                                    instances: true,
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
                        action: 'role.revoke',
                        role: 'myAddress',
                        userId,
                        instances: ['instance1', 'instance2', 'instance3'],
                        ...target,
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

            it('should deny the request if no target is given', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.revoke',
                    role: 'myRole',
                    userId,
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'role.revoke',
                    },
                });
            });

            it('should deny the request if both a target user and inst is given', async () => {
                store.roles[recordName] = {
                    [userId]: new Set([ADMIN_ROLE_NAME]),
                };

                const result = await controller.authorizeRequest({
                    recordKeyOrRecordName: recordName,
                    action: 'role.revoke',
                    role: 'myRole',
                    userId,
                    targetUserId: 'targetUserId',
                    targetInstance: 'targetInstance',
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
                        role: null,
                        marker: ACCOUNT_MARKER,
                        permission: 'role.revoke',
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

    describe('grantMarkerPermission()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant a permission to a marker', async () => {
            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should do nothing if the marker already has the permission', async () => {
            store.policies[recordName] = {
                ['test']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should add the given permission if it has different options from the existing one', async () => {
            store.policies[recordName] = {
                ['test']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: 'abc',
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: 'abc',
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should do nothing if the user is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    id: userId,
                    kind: 'user',
                    marker: 'account',
                    permission: 'policy.grantPermission',
                    role: null,
                    type: 'missing_permission',
                },
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should do nothing if the inst is not authorized', async () => {
            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
                instances: ['inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    id: 'inst',
                    kind: 'inst',
                    marker: 'account',
                    permission: 'policy.grantPermission',
                    role: null,
                    type: 'missing_permission',
                },
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should work if both the user and the instance have the admin role', async () => {
            store.roles[recordName]['inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
                instances: ['inst'],
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });
    });

    describe('revokeMarkerPermission()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            store.policies[recordName] = {
                ['test']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
        });

        it('should remove a permission from a policy', async () => {
            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should remove all matching permissions from a policy', async () => {
            store.policies[recordName] = {
                ['test']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should do nothing if the permission was not found', async () => {
            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: 'abc',
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should do nothing if the policy doesnt exist', async () => {
            delete store.policies[recordName]['test'];

            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should do nothing if the user is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    id: userId,
                    kind: 'user',
                    marker: 'account',
                    permission: 'policy.revokePermission',
                    role: null,
                    type: 'missing_permission',
                },
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should do nothing if the inst is not authorized', async () => {
            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
                instances: ['inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    id: 'inst',
                    kind: 'inst',
                    marker: 'account',
                    permission: 'policy.revokePermission',
                    role: null,
                    type: 'missing_permission',
                },
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should work if both the user and the inst have admin permissions', async () => {
            store.roles[recordName]['inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.revokeMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    type: 'data.read',
                    role: 'developer',
                    addresses: true,
                },
                instances: ['inst'],
            });

            expect(result).toEqual({
                success: true,
            });

            const policy = await store.getUserPolicy(recordName, 'test');

            expect(policy).toEqual({
                success: true,
                document: {
                    permissions: [],
                },
                markers: [ACCOUNT_MARKER],
            });
        });
    });

    describe('readUserPolicy()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            store.policies[recordName] = {
                ['test']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
        });

        it('should return the policy', async () => {
            const result = await controller.readUserPolicy(
                recordName,
                userId,
                'test'
            );

            expect(result).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.readUserPolicy(
                recordName,
                userId,
                'test'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'policy.read',
                    id: userId,
                    kind: 'user',
                    marker: 'account',
                    role: null,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.readUserPolicy(
                recordName,
                userId,
                'test',
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'policy.read',
                    kind: 'inst',
                    id: 'inst',
                    marker: 'account',
                    role: null,
                },
            });
        });

        it('should return an unsuccessful result if the policy doesnt exist', async () => {
            const result = await controller.readUserPolicy(
                recordName,
                userId,
                'does not exist'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: 'The policy was not found.',
            });
        });

        it('should return the policy if both the user and the inst have admin permissions', async () => {
            store.roles[recordName]['inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.readUserPolicy(
                recordName,
                userId,
                'test',
                ['inst']
            );

            expect(result).toEqual({
                success: true,
                document: {
                    permissions: [
                        {
                            type: 'data.read',
                            role: 'developer',
                            addresses: true,
                        },
                    ],
                },
                markers: [ACCOUNT_MARKER],
            });
        });
    });

    describe('listUserPolicies()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            store.policies[recordName] = {
                ['abc']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.list',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                ['test']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.read',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                ['test2']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.create',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };
        });

        it('should return the policies', async () => {
            const result = await controller.listUserPolicies(
                recordName,
                userId,
                null
            );

            expect(result).toEqual({
                success: true,
                policies: [
                    {
                        marker: 'abc',
                        document: {
                            permissions: [
                                {
                                    type: 'data.list',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                    {
                        marker: 'test',
                        document: {
                            permissions: [
                                {
                                    type: 'data.read',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                    {
                        marker: 'test2',
                        document: {
                            permissions: [
                                {
                                    type: 'data.create',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                ],
            });
        });

        it('should return the policies that are after the given marker', async () => {
            const result = await controller.listUserPolicies(
                recordName,
                userId,
                'test'
            );

            expect(result).toEqual({
                success: true,
                policies: [
                    {
                        marker: 'test2',
                        document: {
                            permissions: [
                                {
                                    type: 'data.create',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                ],
            });
        });

        it('should return the policies if both the user and the inst have the admin role', async () => {
            store.roles[recordName]['inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.listUserPolicies(
                recordName,
                userId,
                null,
                ['inst']
            );

            expect(result).toEqual({
                success: true,
                policies: [
                    {
                        marker: 'abc',
                        document: {
                            permissions: [
                                {
                                    type: 'data.list',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                    {
                        marker: 'test',
                        document: {
                            permissions: [
                                {
                                    type: 'data.read',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                    {
                        marker: 'test2',
                        document: {
                            permissions: [
                                {
                                    type: 'data.create',
                                    role: 'developer',
                                    addresses: true,
                                },
                            ],
                        },
                        markers: [ACCOUNT_MARKER],
                    },
                ],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];
            const result = await controller.listUserPolicies(
                recordName,
                userId,
                null
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'policy.list',
                    kind: 'user',
                    id: userId,
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listUserPolicies(
                recordName,
                userId,
                null,
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'policy.list',
                    kind: 'inst',
                    id: 'inst',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });
    });

    describe('listUserRoles()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['testId']: new Set(['role1', 'role2', 'abc']),
            };
        });

        it('should list the roles for the given user', async () => {
            const result = await controller.listUserRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: Infinity,
                    },
                ],
            });
        });

        it('should list the roles if the current user is the same as the target user', async () => {
            const result = await controller.listUserRoles(
                recordName,
                'testId',
                'testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: Infinity,
                    },
                ],
            });
        });

        it('should not allow listing the roles for the own user account if an instance is involved', async () => {
            const result = await controller.listUserRoles(
                recordName,
                'testId',
                'testId',
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'user',
                    id: 'testId',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listUserRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'user',
                    id: userId,
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listUserRoles(
                recordName,
                userId,
                'testId',
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'inst',
                    id: 'inst',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });
    });

    describe('listInstRoles()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['testId']: new Set(['role1', 'role2', 'abc']),
            };
        });

        it('should list the roles for the given inst', async () => {
            const result = await controller.listInstRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: Infinity,
                    },
                ],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listInstRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'user',
                    id: userId,
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listInstRoles(
                recordName,
                userId,
                'testId',
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'inst',
                    id: 'inst',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });
    });

    describe('listRoleAssignments()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['testId']: new Set(['role1', 'role2', 'abc']),
                ['testId2']: new Set(['role1', 'role2', 'abc']),
                ['testId4']: new Set(['role2']),
                ['testId3']: new Set(['role1']),
            };
        });

        it('should list the users that are assigned the given role', async () => {
            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                'role1'
            );

            expect(result).toEqual({
                success: true,
                assignments: [
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'role1',
                            expireTimeMs: Infinity,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'role1',
                            expireTimeMs: Infinity,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId3',
                        role: {
                            role: 'role1',
                            expireTimeMs: Infinity,
                        },
                    },
                ],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                'role1'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'user',
                    id: userId,
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                'role1',
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.list',
                    kind: 'inst',
                    id: 'inst',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });
        });
    });

    describe('grantRole()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant the role to the given user', async () => {
            const result = await controller.grantRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: Infinity,
                },
            ]);
        });

        it('should be able to set an expiration time', async () => {
            const expireTime = Date.now() + 100000;
            const result = await controller.grantRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
                expireTimeMs: expireTime,
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: expireTime,
                },
            ]);
        });

        it('should grant the role to the given instance', async () => {
            const result = await controller.grantRole(recordName, userId, {
                instance: 'inst',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForInst(recordName, 'inst');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: Infinity,
                },
            ]);
        });

        it('should deny the request if the current user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.grantRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.grant',
                    kind: 'user',
                    id: userId,
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });

        it('should deny the request if one of the given instances is not authorized', async () => {
            const result = await controller.grantRole(
                recordName,
                userId,
                {
                    userId: 'testId',
                    role: 'role1',
                },
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.grant',
                    kind: 'inst',
                    id: 'inst',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });
    });

    describe('revokeRole()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            store.roleAssignments[recordName] = {
                ['testId']: [
                    {
                        role: 'role1',
                        expireTimeMs: Infinity,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: Infinity,
                    },
                ],
            };
        });

        it('should revoke the role from the given user', async () => {
            const result = await controller.revokeRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: Infinity,
                },
            ]);
        });

        it('should revoke the role from the given inst', async () => {
            const result = await controller.revokeRole(recordName, userId, {
                instance: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForInst(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: Infinity,
                },
            ]);
        });

        it('should deny the request if the current user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.revokeRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.revoke',
                    kind: 'user',
                    id: userId,
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: Infinity,
                },
                {
                    role: 'role2',
                    expireTimeMs: Infinity,
                },
            ]);
        });

        it('should deny the request if one of the instances are not authorized', async () => {
            const result = await controller.revokeRole(
                recordName,
                userId,
                {
                    userId: 'testId',
                    role: 'role1',
                },
                ['inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'role.revoke',
                    kind: 'inst',
                    id: 'inst',
                    marker: ACCOUNT_MARKER,
                    role: null,
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: Infinity,
                },
                {
                    role: 'role2',
                    expireTimeMs: Infinity,
                },
            ]);
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
