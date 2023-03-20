import { AuthController } from './AuthController';
import { AuthMessenger } from './AuthMessenger';
import { AuthStore } from './AuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { PolicyController } from './PolicyController';
import {
    ADMIN_ROLE_NAME,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
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
