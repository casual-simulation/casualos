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
import { RecordsController } from './RecordsController';

describe('PolicyController', () => {
    let authStore: MemoryAuthStore;
    let authMessenger: MemoryAuthMessenger;
    let authController: AuthController;

    let recordsStore: MemoryRecordsStore;
    let recordsController: RecordsController;

    let store: MemoryPolicyStore;
    let controller: PolicyController;

    let userId: string;
    let sessionKey: string;
    let recordKey: string;
    let recordName: string;

    let wrongRecordKey: string;

    beforeEach(async () => {
        authStore = new MemoryAuthStore();
        authMessenger = new MemoryAuthMessenger();
        authController = new AuthController(
            authStore,
            authMessenger,
            {
                subscriptions: [],
                successUrl: 'success_url',
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                webhookSecret: 'secret',
            },
            true
        );
        recordsStore = new MemoryRecordsStore();
        recordsController = new RecordsController(recordsStore);

        store = new MemoryPolicyStore();
        controller = new PolicyController(
            authController,
            recordsController,
            store
        );

        const loginRequest = await authController.requestLogin({
            address: 'test@example.com',
            addressType: 'email',
            ipAddress: '123.456.789',
        });

        if (!loginRequest.success) {
            throw new Error('Unable to request login!');
        }

        const code = authMessenger.messages.find(
            (m) => m.address === 'test@example.com'
        );

        if (!code) {
            throw new Error('Message not found!');
        }

        const loginResult = await authController.completeLogin({
            code: code.code,
            requestId: loginRequest.requestId,
            userId: loginRequest.userId,
            ipAddress: '123.456.789',
        });

        if (!loginResult.success) {
            throw new Error('Unable to login!');
        }

        userId = loginResult.userId;
        sessionKey = loginResult.sessionKey;

        const createRecordKeyResult =
            await recordsController.createPublicRecordKey(
                'testRecord',
                'subjectfull',
                userId
            );
        if (!createRecordKeyResult.success) {
            throw new Error('Unable to create record key!');
        }

        recordName = createRecordKeyResult.recordName;
        recordKey = createRecordKeyResult.recordKey;

        const createWrongRecordKeyResult =
            await recordsController.createPublicRecordKey(
                'wrongRecord',
                'subjectfull',
                userId
            );
        if (!createWrongRecordKeyResult.success) {
            throw new Error('Unable to create record key!');
        }

        wrongRecordKey = createWrongRecordKeyResult.recordKey;
    });

    describe('authorizeRequest()', () => {
        describe('data.create', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    recordKey: recordKey,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    subject: {
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
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    subject: {
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
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    subject: {
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
                    recordName,
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
                    recordName,
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
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
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
                    recordName,
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
                    recordName,
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
                    recordName,
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
                    recordName,
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

            it('should deny the request if given a record key to a different record', async () => {
                const result = await controller.authorizeRequest({
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    recordKey: wrongRecordKey,
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                });
            });

            it('should deny the request if there is no policy for the given marker', async () => {
                store.roles[recordName] = {
                    [userId]: new Set(['developer']),
                };

                const result = await controller.authorizeRequest({
                    recordName,
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
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    resourceMarkers: ['secret'],
                });

                expect(result).toEqual({
                    allowed: true,
                    subject: {
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
                    recordName,
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
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    recordKey,
                    instances: ['instance'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    subject: {
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
                    recordName,
                    action: 'data.create',
                    address: 'myAddress',
                    userId,
                    instances: ['instance1', 'instance2'],
                    resourceMarkers: [PUBLIC_READ_MARKER],
                });

                expect(result).toEqual({
                    allowed: true,
                    subject: {
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
                    recordName,
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
