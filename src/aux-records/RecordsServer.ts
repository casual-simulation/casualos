/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { tryDecodeUriComponent } from './Utils';
import type {
    AuthController,
    NoSessionKeyResult,
    ValidateSessionKeyResult,
} from './AuthController';
import {
    INVALID_REQUEST_ERROR_MESSAGE,
    MAX_EMAIL_ADDRESS_LENGTH,
    MAX_SMS_ADDRESS_LENGTH,
    PRIVO_OPEN_ID_PROVIDER,
    validateSessionKey,
} from './AuthController';
import {
    isSuperUserRole,
    parseSessionKey,
} from '@casual-simulation/aux-common';
import type { LivekitController } from './LivekitController';
import type { RecordsController } from './RecordsController';
import type { EventRecordsController } from './EventRecordsController';
import type { DataRecordsController } from './DataRecordsController';
import type { FileRecordsController } from './FileRecordsController';
import type {
    CreateManageSubscriptionRequest,
    SubscriptionController,
} from './SubscriptionController';
import type { ZodError } from 'zod';
import { z } from 'zod';
import { HUME_CONFIG, LOOM_CONFIG } from './RecordsStore';
import type { RateLimitController } from './RateLimitController';
import { tryParseJson } from '@casual-simulation/aux-common';
import {
    AVAILABLE_PERMISSIONS_VALIDATION,
    ENTITLEMENT_FEATURE_VALIDATION,
    ENTITLEMENT_VALIDATION,
    PRIVATE_MARKER,
    RESOURCE_KIND_VALIDATION,
    getProcedureMetadata,
    procedure,
} from '@casual-simulation/aux-common';
import type { PolicyController } from './PolicyController';
import type { AIController } from './AIController';
import type { AIChatMessage } from './AIChatInterface';
import { AI_CHAT_MESSAGE_SCHEMA } from './AIChatInterface';
import type { WebsocketController } from './websockets/WebsocketController';
import type {
    AddUpdatesMessage,
    LoginMessage,
    RequestMissingPermissionMessage,
    RequestMissingPermissionResponseMessage,
    SendActionMessage,
    TimeSyncRequestMessage,
    WatchBranchMessage,
    WebsocketRequestMessage,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import {
    WebsocketEventTypes,
    websocketEventSchema,
    websocketRequestMessageSchema,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { DEFAULT_BRANCH_NAME } from '@casual-simulation/aux-common';
import type {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericHttpResponse,
    GenericWebsocketRequest,
    KnownErrorCodes,
    DenialReason,
    Entitlement,
    Procedure,
    ProcedureOutput,
    ProcedureOutputStream,
    Procedures,
    RPCContext,
} from '@casual-simulation/aux-common';
import { getStatusCode } from '@casual-simulation/aux-common';
import type { ModerationController } from './ModerationController';
import { COM_ID_CONFIG_SCHEMA, COM_ID_PLAYER_CONFIG } from './ComIdConfig';
import type { LoomController } from './LoomController';
import type { Tracer } from '@opentelemetry/api';
import { SpanKind, ValueType, trace } from '@opentelemetry/api';
import { traceHttpResponse, traced } from './tracing/TracingDecorators';
import {
    SEMATTRS_HTTP_CLIENT_IP,
    SEMATTRS_HTTP_HOST,
    SEMATTRS_HTTP_METHOD,
    SEMATTRS_HTTP_TARGET,
    SEMATTRS_HTTP_URL,
    SEMATTRS_HTTP_USER_AGENT,
} from '@opentelemetry/semantic-conventions';
import {
    ADDRESS_VALIDATION,
    COM_ID_VALIDATION,
    DISPLAY_NAME_VALIDATION,
    ERASE_DATA_SCHEMA,
    ERASE_FILE_SCHEMA,
    EVENT_NAME_VALIDATION,
    GET_DATA_SCHEMA,
    INSTANCES_ARRAY_VALIDATION,
    LIST_FILES_SCHEMA,
    MARKER_VALIDATION,
    MARKERS_VALIDATION,
    NAME_VALIDATION,
    READ_FILE_SCHEMA,
    RECORD_DATA_SCHEMA,
    RECORD_FILE_SCHEMA,
    RECORD_KEY_VALIDATION,
    RECORD_NAME_VALIDATION,
    STUDIO_DISPLAY_NAME_VALIDATION,
    STUDIO_ID_VALIDATION,
    UPDATE_FILE_SCHEMA,
} from './Validations';
import type { WebhookRecordsController } from './webhooks/WebhookRecordsController';
import {
    eraseItemProcedure,
    getItemProcedure,
    listItemsProcedure,
    recordItemProcedure,
} from './crud/CrudHelpers';
import { merge, omit } from 'lodash';
import type { NotificationRecordsController } from './notifications/NotificationRecordsController';
import {
    PUSH_NOTIFICATION_PAYLOAD,
    PUSH_SUBSCRIPTION_SCHEMA,
} from './notifications';
import type { PackageRecordsController } from './packages/PackageRecordsController';
import type {
    PackageRecordVersionInput,
    PackageVersionRecordsController,
    PackageVersionReviewInput,
} from './packages/version/PackageVersionRecordsController';
import type {
    PackageRecordVersionKey,
    PackageVersionSpecifier,
} from './packages/version/PackageVersionRecordsStore';
import { getPackageVersionSpecifier } from './packages/version/PackageVersionRecordsStore';
import type { PublicRecordKeyPolicy } from '@casual-simulation/aux-common/records/RecordKeys';

declare const GIT_TAG: string;
declare const GIT_HASH: string;

export const NOT_LOGGED_IN_RESULT = {
    success: false as const,
    errorCode: 'not_logged_in' as const,
    errorMessage:
        'The user is not logged in. A session key must be provided for this operation.' as const,
};

export const UNACCEPTABLE_SESSION_KEY = {
    success: false as const,
    errorCode: 'unacceptable_session_key' as const,
    errorMessage:
        'The given session key is invalid. It must be a correctly formatted string.',
};

export const UNACCEPTABLE_USER_ID = {
    success: false,
    errorCode: 'unacceptable_user_id' as const,
    errorMessage:
        'The given user ID is invalid. It must be a correctly formatted string.',
};

export const INVALID_ORIGIN_RESULT = {
    success: false as const,
    errorCode: 'invalid_origin' as const,
    errorMessage: 'The request must be made from an authorized origin.',
};

export const OPERATION_NOT_FOUND_RESULT = {
    success: false as const,
    errorCode: 'operation_not_found' as const,
    errorMessage: 'An operation could not be found for the given request.',
};

export const UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON = {
    success: false as const,
    errorCode: 'unacceptable_request' as const,
    errorMessage:
        'The request body was not properly formatted. It should be valid JSON.',
};

export const SUBSCRIPTIONS_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'Subscriptions are not supported by this server.',
};

export const AI_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'AI features are not supported by this server.',
};

export const LOOM_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'Loom features are not supported by this server.',
};

export const INSTS_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'Inst features are not supported by this server.',
};

export const MODERATION_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'Moderation features are not supported by this server.',
};

/**
 * Defines a basic interface for an HTTP route.
 */
export interface Route<T, TQuery = any> {
    /**
     * The path that the route must match.
     */
    path: string;

    /**
     * The schema that should be used for the route.
     * If the method can contain a request body, then the schema applies to the body.
     * Otherwise, it will apply to the query parameters.
     */
    schema?: z.ZodType<T, z.ZodTypeDef, any>;

    /**
     * The schema that should be used for the query parameters.
     * If omitted, then the query parameters will not be validated using this schema.
     *
     * Additionally, this only works if a schema is provided.
     */
    querySchema?: z.ZodType<TQuery, z.ZodTypeDef, any>;

    /**
     * The method for the route.
     */
    method: GenericHttpRequest['method'];

    /**
     * The name for the route.
     * If omitted, then the route will not be named.
     */
    name?: string;

    /**
     * The handler that should be called when the route is matched.
     * @param request The request.
     * @param data The data that was parsed from the request.
     * @param query The query parameters that were parsed from the request.
     */
    handler: (
        request: GenericHttpRequest,
        data?: T,
        query?: TQuery
    ) => Promise<GenericHttpResponse>;

    /**
     * The set of origins that are allowed for the route.
     * If true, then all origins are allowed.
     * If 'account', then only the configured account origins are allowed.
     * If 'api', then only the configured API origins are allowed.
     * If omitted, then it is up to the handler to determine if the origin is allowed.
     */
    allowedOrigins?: Set<string> | true | 'account' | 'api';
}

const RECORDS_SERVER_METER = 'RecordsServer';

export interface RecordsServerOptions {
    /**
     * The set of origins that are allowed to make requests to account endpoints.
     */
    allowedAccountOrigins: Set<string>;

    /**
     * The set of origins that are allowed to make requests to API endpoints.
     */
    allowedApiOrigins: Set<string>;

    /**
     * The controller that should be used for handling authentication requests.
     */
    authController: AuthController;

    /**
     * The controller that should be used for handling livekit requests.
     */
    livekitController: LivekitController;

    /**
     * The controller that should be used for handling records requests.
     */
    recordsController: RecordsController;

    /**
     * The controller that should be used for handling event records requests.
     */
    eventsController: EventRecordsController;

    /**
     * The controller that should be used for handling data records requests.
     */
    dataController: DataRecordsController;

    /**
     * The controller that should be used for handling manual data records requests.
     */
    manualDataController: DataRecordsController;

    /**
     * The controller that should be used for handling file requests.
     */
    filesController: FileRecordsController;

    /**
     * The controller that should be used for handling subscription requests.
     * If null, then subscriptions are not supported.
     */
    subscriptionController?: SubscriptionController | null;

    /**
     * The controller that should be used for handling rate limits.
     * If null, then rate limiting will not be used.
     */
    rateLimitController?: RateLimitController | null;

    /**
     * The controller that should be used for handling policy requests.
     */
    policyController: PolicyController;

    /**
     * The controller that should be used for handling AI requests.
     */
    aiController?: AIController | null;

    /**
     * The controller that should be used for handling websocket requests.
     * If null, then websockets are not supported.
     */
    websocketController?: WebsocketController | null;

    /**
     * The controller that should be used for handling moderation requests.
     * If null, then moderation is not supported.
     */
    moderationController?: ModerationController | null;

    /**
     * The controller that should be used for handling loom requests.
     * If null, then loom is not supported.
     */
    loomController?: LoomController | null;

    /**
     * The controller that should be used for handling webhooks.
     * If null, then webhooks are not supported.
     */
    webhooksController?: WebhookRecordsController | null;

    /**
     * The controller that should be used for handling rate limits for websockets.
     * If null, then the default rate limit controller will be used.
     */
    websocketRateLimitController?: RateLimitController | null;

    /**
     * The controller that should be used for handling notifications.
     * If null, then notifications are not supported.
     */
    notificationsController?: NotificationRecordsController | null;

    /**
     * The controller that should be used for handling packages.
     * If null, then packages are not supported.
     */
    packagesController?: PackageRecordsController | null;

    /**
     * The controller that should be used for handling package versions.
     * If null, then package versions are not supported.
     */
    packageVersionController?: PackageVersionRecordsController | null;
}

/**
 * Defines a class that represents a generic HTTP server suitable for Records HTTP Requests.
 */
export class RecordsServer {
    private _auth: AuthController;
    private _livekit: LivekitController;
    private _records: RecordsController;
    private _events: EventRecordsController;
    private _data: DataRecordsController;
    private _manualData: DataRecordsController;
    private _files: FileRecordsController;
    private _subscriptions: SubscriptionController | null;
    private _aiController: AIController | null;
    private _websocketController: WebsocketController | null;
    private _moderationController: ModerationController | null;
    private _loomController: LoomController | null;
    private _webhooksController: WebhookRecordsController | null;
    private _notificationsController: NotificationRecordsController | null;
    private _packagesController: PackageRecordsController | null;
    private _packageVersionController: PackageVersionRecordsController | null;

    /**
     * The set of origins that are allowed for API requests.
     */
    private _allowedApiOrigins: Set<string>;

    /**
     * The set of origins that are allowed for account management requests.
     */
    private _allowedAccountOrigins: Set<string>;
    private _rateLimit: RateLimitController;
    private _websocketRateLimit: RateLimitController;
    private _policyController: PolicyController;

    /**
     * The map of paths to routes that they match.
     */
    private _routes: Map<string, Route<any>> = new Map();

    private _procedures: ReturnType<RecordsServer['_createProcedures']>;

    /**
     * The tracer that is used for tracing requests.
     */
    private _tracer: Tracer;

    /**
     * The set of origins that are allowed for account management requests.
     */
    get allowedAccountOrigins() {
        return this._allowedAccountOrigins;
    }

    /**
     * The set of origins that are allowed for API requests.
     */
    get allowedApiOrigins() {
        return this._allowedApiOrigins;
    }

    /**
     * The set of procedures that the server has.
     */
    get procedures() {
        return this._procedures;
    }

    constructor({
        allowedAccountOrigins,
        allowedApiOrigins,
        authController,
        livekitController,
        recordsController,
        eventsController,
        dataController,
        manualDataController,
        filesController,
        subscriptionController,
        websocketController,
        websocketRateLimitController,
        rateLimitController,
        policyController,
        aiController,
        moderationController,
        loomController,
        webhooksController,
        notificationsController,
        packagesController,
        packageVersionController,
    }: RecordsServerOptions) {
        this._allowedAccountOrigins = allowedAccountOrigins;
        this._allowedApiOrigins = allowedApiOrigins;
        this._auth = authController;
        this._livekit = livekitController;
        this._records = recordsController;
        this._events = eventsController;
        this._data = dataController;
        this._manualData = manualDataController;
        this._files = filesController;
        this._subscriptions = subscriptionController;
        this._rateLimit = rateLimitController;
        this._websocketRateLimit =
            websocketRateLimitController ?? rateLimitController;
        this._policyController = policyController;
        this._aiController = aiController;
        this._websocketController = websocketController;
        this._moderationController = moderationController;
        this._loomController = loomController;
        this._webhooksController = webhooksController;
        this._notificationsController = notificationsController;
        this._packagesController = packagesController;
        this._packageVersionController = packageVersionController;
        this._tracer = trace.getTracer(
            'RecordsServer',
            typeof GIT_TAG === 'undefined' ? undefined : GIT_TAG
        );
        this._procedures = this._createProcedures();
        this._setupRoutes();
    }

    private _createProcedures() {
        return {
            getUserInfo: procedure()
                .origins('account')
                .inputs(
                    z.object({
                        userId: z.string(),
                    })
                )
                .handler(async ({ userId }, context) => {
                    const authorization = context.sessionKey;

                    if (!authorization) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const result = await this._auth.getUserInfo({
                        userId,
                        sessionKey: authorization,
                    });

                    if (result.success === false) {
                        return result;
                    }

                    return {
                        success: true,
                        name: result.name,
                        avatarUrl: result.avatarUrl,
                        avatarPortraitUrl: result.avatarPortraitUrl,
                        email: result.email,
                        phoneNumber: result.phoneNumber,
                        hasActiveSubscription: result.hasActiveSubscription,
                        subscriptionTier: result.subscriptionTier,
                        privacyFeatures: result.privacyFeatures,
                        displayName: result.displayName,
                        role: result.role,
                    } as const;
                }),

            isEmailValid: procedure()
                .origins('account')
                .http('POST', '/api/v2/email/valid')
                .inputs(z.object({ email: z.string() }))
                .handler(async ({ email }) => {
                    return await this._auth.isValidEmailAddress(email);
                }),
            isDisplayNameValid: procedure()
                .origins('account')
                .http('POST', '/api/v2/displayName/valid')
                .inputs(
                    z.object({
                        displayName: z.string(),
                        name: NAME_VALIDATION.optional(),
                    })
                )
                .handler(async ({ displayName, name }) => {
                    return await this._auth.isValidDisplayName(
                        displayName,
                        name
                    );
                }),

            createAccount: procedure()
                .origins('account')
                .http('POST', '/api/v2/createAccount')
                .inputs(z.object({}))
                .handler(async (_, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._auth.createAccount({
                        userRole: validation.role,
                        ipAddress: context.ipAddress,
                    });

                    return result;
                }),

            listSessions: procedure()
                .origins('account')
                .http('GET', '/api/v2/sessions')
                .inputs(
                    z
                        .object({
                            expireTimeMs: z.coerce.number().int().optional(),
                            userId: z.string().optional(),
                        })
                        .default({})
                )
                .handler(async ({ expireTimeMs, userId }, context) => {
                    const sessionKey = context.sessionKey;

                    if (!sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const parsed = parseSessionKey(sessionKey);

                    if (!parsed) {
                        return UNACCEPTABLE_SESSION_KEY;
                    }

                    const [sessionKeyUserId] = parsed;

                    const result = await this._auth.listSessions({
                        userId: userId ?? sessionKeyUserId,
                        sessionKey,
                        expireTimeMs,
                    });

                    return result;
                }),
            replaceSession: procedure()
                .origins('account')
                .http('POST', '/api/v2/replaceSession')
                .handler(async (_, context) => {
                    const sessionKey = context.sessionKey;
                    if (!sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const result = await this._auth.replaceSession({
                        sessionKey: sessionKey,
                        ipAddress: context.ipAddress,
                    });

                    return result;
                }),
            revokeAllSessions: procedure()
                .origins('account')
                .http('POST', '/api/v2/revokeAllSessions')
                .inputs(
                    z.object({
                        userId: z.string(),
                    })
                )
                .handler(async ({ userId }, context) => {
                    const authorization = context.sessionKey;

                    if (!authorization) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const result = await this._auth.revokeAllSessions({
                        userId: userId,
                        sessionKey: authorization,
                    });

                    return result;
                }),

            revokeSession: procedure()
                .origins('account')
                .http('POST', '/api/v2/revokeSession')
                .inputs(
                    z.object({
                        userId: z.string().optional(),
                        sessionId: z.string().optional(),
                        sessionKey: z.string().optional(),
                    })
                )
                .handler(
                    async (
                        { userId, sessionId, sessionKey: sessionKeyToRevoke },
                        context
                    ) => {
                        // Parse the User ID and Session ID from the sessionKey that is provided in
                        // session key that should be revoked
                        if (!!sessionKeyToRevoke) {
                            const parsed = parseSessionKey(sessionKeyToRevoke);
                            if (parsed) {
                                userId = parsed[0];
                                sessionId = parsed[1];
                            }
                        }

                        const authorization = context.sessionKey;

                        if (!authorization) {
                            return NOT_LOGGED_IN_RESULT;
                        }

                        const result = await this._auth.revokeSession({
                            userId,
                            sessionId,
                            sessionKey: authorization,
                        });

                        return result;
                    }
                ),

            completeLogin: procedure()
                .origins('account')
                .http('POST', '/api/v2/completeLogin')
                .inputs(
                    z.object({
                        userId: z.string(),
                        requestId: z.string(),
                        code: z.string(),
                    })
                )
                .handler(async ({ userId, requestId, code }, context) => {
                    const result = await this._auth.completeLogin({
                        userId,
                        requestId,
                        code,
                        ipAddress: context.ipAddress,
                    });

                    return result;
                }),

            requestLogin: procedure()
                .origins('account')
                .http('POST', '/api/v2/login')
                .inputs(
                    z.object({
                        address: z.string(),
                        addressType: z.enum(['email', 'phone']),
                    })
                )
                .handler(async ({ address, addressType }, context) => {
                    const result = await this._auth.requestLogin({
                        address,
                        addressType,
                        ipAddress: context.ipAddress,
                    });

                    return result;
                }),

            requestPrivoLogin: procedure()
                .origins('account')
                .http('POST', '/api/v2/login/privo')
                .inputs(z.object({}))
                .handler(async (_, context) => {
                    const result = await this._auth.requestOpenIDLogin({
                        provider: PRIVO_OPEN_ID_PROVIDER,
                        ipAddress: context.ipAddress,
                    });

                    return result;
                }),

            processOAuthCode: procedure()
                .origins('account')
                .http('POST', '/api/v2/oauth/code')
                .inputs(
                    z.object({
                        code: z.string().nonempty(),
                        state: z.string().nonempty(),
                    })
                )
                .handler(async ({ code, state }, context) => {
                    const result =
                        await this._auth.processOpenIDAuthorizationCode({
                            ipAddress: context.ipAddress,
                            authorizationCode: code,
                            state,
                        });

                    return result;
                }),

            completeOAuthLogin: procedure()
                .origins('account')
                .http('POST', '/api/v2/oauth/complete')
                .inputs(
                    z.object({
                        requestId: z.string().nonempty(),
                    })
                )
                .handler(async ({ requestId }, context) => {
                    const result = await this._auth.completeOpenIDLogin({
                        ipAddress: context.ipAddress,
                        requestId,
                    });

                    return result;
                }),

            requestPrivoSignUp: procedure()
                .origins('account')
                .http('POST', '/api/v2/register/privo')
                .inputs(
                    z.object({
                        email: z.string().min(1).email().optional(),
                        parentEmail: z.string().min(1).email().optional(),
                        name: NAME_VALIDATION,
                        dateOfBirth: z.coerce.date(),
                        displayName: DISPLAY_NAME_VALIDATION,
                    })
                )
                .handler(
                    async (
                        { email, parentEmail, name, dateOfBirth, displayName },
                        context
                    ) => {
                        const result = await this._auth.requestPrivoSignUp({
                            email,
                            parentEmail,
                            name,
                            dateOfBirth,
                            displayName,
                            ipAddress: context.ipAddress,
                        });

                        return result;
                    }
                ),

            requestPrivacyFeaturesChange: procedure()
                .origins('account')
                .http('POST', '/api/v2/privacyFeatures/change')
                .inputs(
                    z.object({
                        userId: z.string(),
                    })
                )
                .handler(async ({ userId }, context) => {
                    const sessionKey = context.sessionKey;

                    if (!sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const result =
                        await this._auth.requestPrivacyFeaturesChange({
                            userId,
                            sessionKey,
                        });

                    return result;
                }),

            getWebAuthnRegistrationOptions: procedure()
                .origins(true)
                .http('GET', '/api/v2/webauthn/register/options')
                .handler(async (_, context) => {
                    // We don't validate origin because the AuthController will validate it based on the allowed
                    // relying parties.
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._auth.requestWebAuthnRegistration(
                        {
                            userId: validation.userId,
                            originOrHost:
                                context.origin ??
                                context.httpRequest?.headers.origin ??
                                context.httpRequest?.headers[
                                    'x-dev-proxy-host'
                                ] ??
                                context.httpRequest?.headers.host,
                        }
                    );

                    return result;
                }),

            registerWebAuthn: procedure()
                .origins(true)
                .http('POST', '/api/v2/webauthn/register')
                .inputs(
                    z.object({
                        response: z.object({
                            id: z.string().nonempty(),
                            rawId: z.string().nonempty(),
                            response: z.object({
                                clientDataJSON: z.string().nonempty(),
                                attestationObject: z.string().nonempty(),
                                authenticatorData: z
                                    .string()
                                    .nonempty()
                                    .optional(),
                                transports: z
                                    .array(z.string().min(1).max(64))
                                    .optional(),
                                publicKeyAlgorithm: z.number().optional(),
                                publicKey: z.string().nonempty().optional(),
                            }),
                            authenticatorAttachment: z
                                .enum(['cross-platform', 'platform'])
                                .optional(),
                            clientExtensionResults: z.object({
                                appid: z.boolean().optional(),
                                credProps: z
                                    .object({
                                        rk: z.boolean().optional(),
                                    })
                                    .optional(),
                                hmacCreateSecret: z.boolean().optional(),
                            }),
                            type: z.literal('public-key'),
                        }),
                    })
                )
                .handler(async ({ response }, context) => {
                    // We don't validate origin because the AuthController will validate it based on the allowed
                    // relying parties.
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result =
                        await this._auth.completeWebAuthnRegistration({
                            userId: validation.userId,
                            response: response as any,
                            originOrHost:
                                context.origin ??
                                context.httpRequest?.headers.origin ??
                                context.httpRequest?.headers[
                                    'x-dev-proxy-host'
                                ] ??
                                context.httpRequest?.headers.host,
                            userAgent:
                                context.httpRequest?.headers['user-agent'],
                        });

                    return result;
                }),

            getWebAuthnLoginOptions: procedure()
                .origins(true)
                .http('GET', '/api/v2/webauthn/login/options')
                .handler(async (_, context) => {
                    // We don't validate origin because the AuthController will validate it based on the allowed
                    // relying parties.

                    const result = await this._auth.requestWebAuthnLogin({
                        ipAddress: context.ipAddress,
                        originOrHost:
                            context.origin ??
                            context.httpRequest?.headers.origin ??
                            context.httpRequest?.headers['x-dev-proxy-host'] ??
                            context.httpRequest?.headers.host,
                    });

                    return result;
                }),

            completeWebAuthnLogin: procedure()
                .origins(true)
                .http('POST', '/api/v2/webauthn/login')
                .inputs(
                    z.object({
                        requestId: z.string().nonempty(),
                        response: z.object({
                            id: z.string().nonempty(),
                            rawId: z.string().nonempty(),
                            response: z.object({
                                clientDataJSON: z.string().nonempty(),
                                authenticatorData: z.string().nonempty(),
                                signature: z.string().nonempty(),
                                userHandle: z.string().nonempty().optional(),
                            }),
                            authenticatorAttachment: z
                                .enum(['cross-platform', 'platform'])
                                .optional(),
                            clientExtensionResults: z.object({
                                appid: z.boolean().optional(),
                                credProps: z
                                    .object({
                                        rk: z.boolean().optional(),
                                    })
                                    .optional(),
                                hmacCreateSecret: z.boolean().optional(),
                            }),
                            type: z.literal('public-key'),
                        }),
                    })
                )
                .handler(async ({ response, requestId }, context) => {
                    // We don't validate origin because the AuthController will validate it based on the allowed
                    // relying parties.

                    const result = await this._auth.completeWebAuthnLogin({
                        requestId: requestId,
                        ipAddress: context.ipAddress,
                        response: response as any,
                        originOrHost:
                            context.origin ??
                            context.httpRequest?.headers.origin ??
                            context.httpRequest?.headers['x-dev-proxy-host'] ??
                            context.httpRequest?.headers.host,
                    });

                    return result;
                }),

            listUserAuthenticators: procedure()
                .origins('account')
                .http('GET', '/api/v2/webauthn/authenticators')
                .handler(async (_, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._auth.listUserAuthenticators(
                        validation.userId
                    );

                    return result;
                }),

            deleteUserAuthenticator: procedure()
                .origins('account')
                .http('POST', '/api/v2/webauthn/authenticators/delete')
                .inputs(
                    z.object({
                        authenticatorId: z.string().nonempty(),
                    })
                )
                .handler(async ({ authenticatorId }, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._auth.deleteUserAuthenticator(
                        validation.userId,
                        authenticatorId
                    );

                    return result;
                }),

            createMeetToken: procedure()
                .origins('api')
                .http('POST', '/api/v2/meet/token')
                .inputs(
                    z.object({
                        roomName: z.string(),
                        userName: z.string(),
                    })
                )
                .handler(async ({ roomName, userName }) => {
                    const result = await this._livekit.issueToken(
                        roomName,
                        userName
                    );
                    return result;
                }),

            createRecord: procedure()
                .origins('account')
                .http('POST', '/api/v2/records')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        ownerId: z
                            .string({
                                invalid_type_error: 'ownerId must be a string.',
                                required_error: 'ownerId is required.',
                            })
                            .nonempty('ownerId must not be empty.')
                            .optional(),
                        studioId: z
                            .string({
                                invalid_type_error:
                                    'studioId must be a string.',
                                required_error: 'studioId is required.',
                            })
                            .nonempty('studioId must not be empty.')
                            .optional(),
                    })
                )
                .handler(async ({ recordName, ownerId, studioId }, context) => {
                    if (!recordName || typeof recordName !== 'string') {
                        return {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage:
                                'recordName is required and must be a string.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._records.createRecord({
                        recordName,
                        ownerId,
                        studioId,
                        userId: validation.userId,
                    });

                    return result;
                }),

            addEventCount: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/events/count')
                .inputs(
                    z.object({
                        recordKey: RECORD_KEY_VALIDATION,
                        eventName: EVENT_NAME_VALIDATION,
                        count: z.number({
                            invalid_type_error: 'count must be a number.',
                            required_error: 'count is required.',
                        }),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordKey, eventName, count, instances },
                        context
                    ) => {
                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );

                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const userId = validation.userId;

                        const result = await this._events.addCount(
                            recordKey,
                            eventName,
                            count,
                            userId,
                            instances
                        );

                        return result;
                    }
                ),

            getEventCount: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/events/count')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        eventName: z
                            .string({
                                required_error: 'eventName is required.',
                                invalid_type_error:
                                    'eventName must be a string.',
                            })
                            .nonempty('eventName must not be empty'),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, eventName, instances }, context) => {
                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );

                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const userId = validation.userId;
                        const result = await this._events.getCount(
                            recordName,
                            eventName,
                            userId,
                            instances
                        );
                        return result;
                    }
                ),

            listEvents: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/events/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        eventName: z
                            .string({
                                invalid_type_error:
                                    'eventName must be a string.',
                                required_error: 'eventName is required.',
                            })
                            .nonempty('eventName must be non-empty.')
                            .optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, eventName, instances }, context) => {
                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }
                        const userId = validation.userId;

                        const result = await this._events.listEvents(
                            recordName,
                            eventName,
                            userId,
                            instances
                        );
                        return result;
                    }
                ),

            updateEvent: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/events')
                .inputs(
                    z.object({
                        recordKey: RECORD_KEY_VALIDATION,
                        eventName: EVENT_NAME_VALIDATION,
                        count: z.number().optional(),
                        markers: MARKERS_VALIDATION.optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordKey, eventName, count, markers, instances },
                        context
                    ) => {
                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );

                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const userId = validation.userId;

                        const result = await this._events.updateEvent({
                            recordKeyOrRecordName: recordKey,
                            userId,
                            eventName,
                            count,
                            markers,
                            instances,
                        });

                        return result;
                    }
                ),

            deleteManualData: procedure()
                .origins('api')
                .http('DELETE', '/api/v2/records/manual/data')
                .inputs(
                    z.object({
                        recordKey: RECORD_KEY_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async (data, context) =>
                    this._baseEraseRecordData(this._manualData, data, context)
                ),

            getManualData: procedure()
                .origins(true)
                .http('GET', '/api/v2/records/manual/data')
                .inputs(GET_DATA_SCHEMA)
                .handler(async (data, context) =>
                    this._baseGetRecordData(this._manualData, data, context)
                ),

            recordManualData: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/manual/data')
                .inputs(RECORD_DATA_SCHEMA)
                .handler(async (data, context) =>
                    this._baseRecordData(this._manualData, data, context)
                ),

            getFile: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/file')
                .inputs(READ_FILE_SCHEMA)
                .handler(async (data, context) =>
                    this._readFile(data, context)
                ),

            listFiles: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/file/list')
                .inputs(LIST_FILES_SCHEMA)
                .handler(async (data, context) =>
                    this._listFiles(data, context)
                ),

            eraseFile: procedure()
                .origins('api')
                .http('DELETE', '/api/v2/records/file')
                .inputs(ERASE_FILE_SCHEMA)
                .handler(async (data, context) =>
                    this._eraseFile(data, context)
                ),

            recordFile: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/file')
                .inputs(RECORD_FILE_SCHEMA)
                .handler(async (data, context) =>
                    this._recordFile(data, context)
                ),

            updateFile: procedure()
                .origins('api')
                .http('PUT', '/api/v2/records/file')
                .inputs(UPDATE_FILE_SCHEMA)
                .handler(async (data, context) =>
                    this._updateFile(data, context)
                ),

            scanFileForModeration: procedure()
                .origins('account')
                .http('POST', '/api/v2/records/file/scan')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        fileName: z.string().min(1),
                    })
                )
                .handler(async ({ recordName, fileName }, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }
                    if (!isSuperUserRole(validation.role)) {
                        return {
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                        } as const;
                    }
                    const result = await this._moderationController.scanFile({
                        recordName,
                        fileName,
                    });

                    return result;
                }),

            scheduleModerationScans: procedure()
                .origins('account')
                .http('POST', '/api/v2/moderation/schedule/scan')
                .inputs(z.object({}))
                .handler(async (input, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }
                    if (!isSuperUserRole(validation.role)) {
                        return {
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                        } as const;
                    }

                    const result =
                        await this._moderationController.scheduleModerationScans();

                    return result;
                }),

            eraseData: procedure()
                .origins('api')
                .http('DELETE', '/api/v2/records/data')
                .inputs(ERASE_DATA_SCHEMA)
                .handler(async (data, context) =>
                    this._baseEraseRecordData(this._data, data, context)
                ),

            getData: procedure()
                .origins(true)
                .http('GET', '/api/v2/records/data')
                .inputs(GET_DATA_SCHEMA)
                .handler(async (data, context) =>
                    this._baseGetRecordData(this._data, data, context)
                ),

            listData: procedure()
                .origins(true)
                .http('GET', '/api/v2/records/data/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION.nullable().optional(),
                        marker: MARKER_VALIDATION.optional(),
                        sort: z.enum(['ascending', 'descending']).optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, instances, marker, sort },
                        context
                    ) => {
                        if (!recordName || typeof recordName !== 'string') {
                            return {
                                success: false,
                                errorCode: 'unacceptable_request',
                                errorMessage:
                                    'recordName is required and must be a string.',
                            } as const;
                        }
                        if (
                            address !== null &&
                            typeof address !== 'undefined' &&
                            typeof address !== 'string'
                        ) {
                            return {
                                success: false,
                                errorCode: 'unacceptable_request',
                                errorMessage:
                                    'address must be null or a string.',
                            } as const;
                        }

                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (
                            sessionKeyValidation.success === false &&
                            sessionKeyValidation.errorCode !== 'no_session_key'
                        ) {
                            return sessionKeyValidation;
                        }

                        if (!marker) {
                            const result = await this._data.listData(
                                recordName,
                                address || null,
                                sessionKeyValidation.userId,
                                instances
                            );
                            return result;
                        } else {
                            const result = await this._data.listDataByMarker({
                                recordKeyOrName: recordName,
                                marker: marker,
                                startingAddress: address,
                                sort: sort,
                                userId: sessionKeyValidation.userId,
                                instances,
                            });

                            return result;
                        }
                    }
                ),

            recordData: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/data')
                .inputs(RECORD_DATA_SCHEMA)
                .handler(async (data, context) =>
                    this._baseRecordData(this._data, data, context)
                ),

            recordWebhook: recordItemProcedure(
                this._auth,
                this._webhooksController,
                z.discriminatedUnion('targetResourceKind', [
                    z.object({
                        address: ADDRESS_VALIDATION,
                        targetResourceKind: z.enum(['data', 'file']),
                        targetRecordName: RECORD_NAME_VALIDATION,
                        targetAddress: ADDRESS_VALIDATION,
                        markers: MARKERS_VALIDATION.optional().default([
                            PRIVATE_MARKER,
                        ]),
                    }),
                    z.object({
                        address: ADDRESS_VALIDATION,
                        targetResourceKind: z.literal('inst'),
                        targetRecordName:
                            RECORD_NAME_VALIDATION.optional().nullable(),
                        targetAddress: ADDRESS_VALIDATION,
                        markers: MARKERS_VALIDATION.optional().default([
                            PRIVATE_MARKER,
                        ]),
                    }),
                ]),
                procedure()
                    .origins('api')
                    .http('POST', '/api/v2/records/webhook')
            ),

            getWebhook: getItemProcedure(
                this._auth,
                this._webhooksController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/webhook')
            ),

            listWebhooks: listItemsProcedure(
                this._auth,
                this._webhooksController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/webhook/list')
            ),

            runWebhook: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/webhook/run')
                .inputs(
                    z.any(),
                    z
                        .object({
                            recordName: RECORD_NAME_VALIDATION,
                            address: z.string().min(1),
                            instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        })
                        .catchall(z.string())
                )
                .handler(
                    async (
                        data: any,
                        context,
                        { recordName, address, instances, ...rest }
                    ) => {
                        if (!this._webhooksController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }
                        if (!context.httpRequest) {
                            return {
                                success: false,
                                errorCode: 'unacceptable_request',
                                errorMessage:
                                    'webhooks have to be called from an http request',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const bannedHeaders = [
                            'authorization',
                            'cookie',
                            'set-cookie',
                            'clear-site-data',
                            'access-control-allow-origin',
                            'access-control-max-age',
                            'access-control-allow-credentials',
                            'date',
                            'server',
                            'keep-alive',
                            'connection',
                            'transfer-encoding',
                        ];

                        const result =
                            await this._webhooksController.handleWebhook({
                                recordName,
                                address,
                                instances,
                                userId: validation.userId,
                                request: {
                                    method: context.httpRequest.method,
                                    ipAddress: context.httpRequest.ipAddress,
                                    path: '/api/v2/records/webhook/run',
                                    body: JSON.stringify(data),
                                    headers: omit(
                                        context.httpRequest.headers,
                                        ...bannedHeaders
                                    ),
                                    query: rest,
                                    pathParams: {},
                                },
                            });

                        if (result.success === false) {
                            return result;
                        }

                        const headers: GenericHttpHeaders = {};
                        if (result.response.headers) {
                            for (let key in result.response.headers) {
                                const lowerKey = key.toLowerCase();
                                if (bannedHeaders.includes(lowerKey)) {
                                    continue;
                                }
                                headers[lowerKey] =
                                    result.response.headers[key];
                            }
                        }

                        return {
                            success: true,
                            response: {
                                statusCode: result.response.statusCode,
                                headers,
                                body: result.response.body,
                            } as GenericHttpResponse,
                        };
                    },
                    async (output, context) => {
                        if (output.success === false) {
                            // Use defaults
                            return {};
                        } else if (output.success === true) {
                            return output.response;
                        }
                    }
                ),

            eraseWebhook: eraseItemProcedure(
                this._auth,
                this._webhooksController,
                procedure()
                    .origins('api')
                    .http('DELETE', '/api/v2/records/webhook')
            ),

            listWebhookRuns: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/webhook/runs/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        requestTimeMs: z.number().int().optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, requestTimeMs, instances },
                        context
                    ) => {
                        if (!this._webhooksController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (validation.success === false) {
                            if (validation.errorCode === 'no_session_key') {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return validation;
                        }

                        const result =
                            await this._webhooksController.listWebhookRuns({
                                recordName,
                                address,
                                userId: validation.userId,
                                requestTimeMs,
                                instances,
                            });

                        return result;
                    }
                ),

            getWebhookRun: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/webhook/runs/info')
                .inputs(
                    z.object({
                        runId: z.string().min(1),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ runId, instances }, context) => {
                    if (!this._webhooksController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._webhooksController.getWebhookRun(
                        {
                            runId,
                            userId: validation.userId,
                            instances,
                        }
                    );

                    return result;
                }),

            recordNotification: recordItemProcedure(
                this._auth,
                this._notificationsController,
                z.object({
                    address: ADDRESS_VALIDATION,
                    description: z.string().min(1),
                    markers: MARKERS_VALIDATION.optional().default([
                        PRIVATE_MARKER,
                    ]),
                }),
                procedure()
                    .origins('api')
                    .http('POST', '/api/v2/records/notification')
            ),

            getNotification: getItemProcedure(
                this._auth,
                this._notificationsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/notification')
            ),

            listNotifications: listItemsProcedure(
                this._auth,
                this._notificationsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/notification/list')
            ),

            listNotificationSubscriptions: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/notification/list/subscriptions')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, address, instances }, context) => {
                        if (!this._notificationsController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );

                        if (validation.success === false) {
                            if (validation.errorCode === 'no_session_key') {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return validation;
                        }

                        const result =
                            await this._notificationsController.listSubscriptions(
                                {
                                    recordName,
                                    address,
                                    userId: validation.userId,
                                    instances,
                                }
                            );

                        return result;
                    }
                ),

            listUserNotificationSubscriptions: procedure()
                .origins('api')
                .http(
                    'GET',
                    '/api/v2/records/notification/list/user/subscriptions'
                )
                .inputs(
                    z.object({
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ instances }, context) => {
                    if (!this._notificationsController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result =
                        await this._notificationsController.listSubscriptionsForUser(
                            {
                                userId: validation.userId,
                                instances,
                            }
                        );

                    return result;
                }),

            eraseNotification: eraseItemProcedure(
                this._auth,
                this._notificationsController,
                procedure()
                    .origins('api')
                    .http('DELETE', '/api/v2/records/notification')
            ),

            registerPushSubscription: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/notification/register')
                .inputs(
                    z.object({
                        pushSubscription: PUSH_SUBSCRIPTION_SCHEMA,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ pushSubscription, instances }, context) => {
                    if (!this._notificationsController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (
                        validation.success === false &&
                        validation.errorCode !== 'no_session_key'
                    ) {
                        return validation;
                    }

                    const result =
                        await this._notificationsController.registerPushSubscription(
                            {
                                userId: validation.userId,
                                pushSubscription,
                                instances,
                            }
                        );

                    return result;
                }),

            subscribeToNotification: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/notification/subscribe')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        pushSubscription: PUSH_SUBSCRIPTION_SCHEMA,
                    })
                )
                .handler(
                    async (
                        { recordName, address, instances, pushSubscription },
                        context
                    ) => {
                        if (!this._notificationsController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }
                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const result =
                            await this._notificationsController.subscribeToNotification(
                                {
                                    recordName,
                                    address,
                                    userId: validation.userId,
                                    pushSubscription,
                                    instances,
                                }
                            );

                        return result;
                    }
                ),

            unsubscribeFromNotification: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/notification/unsubscribe')
                .inputs(
                    z.object({
                        subscriptionId: z.string(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ subscriptionId, instances }, context) => {
                    if (!this._notificationsController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result =
                        await this._notificationsController.unsubscribeFromNotification(
                            {
                                subscriptionId,
                                userId: validation.userId,
                                instances,
                            }
                        );

                    return result;
                }),

            sendNotification: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/notification/send')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        payload: PUSH_NOTIFICATION_PAYLOAD,
                        topic: z.string().optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, instances, payload, topic },
                        context
                    ) => {
                        if (!this._notificationsController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (validation.success === false) {
                            if (validation.errorCode === 'no_session_key') {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return validation;
                        }

                        const result =
                            await this._notificationsController.sendNotification(
                                {
                                    recordName,
                                    address,
                                    userId: validation.userId,
                                    payload,
                                    topic,
                                    instances,
                                }
                            );

                        return result;
                    }
                ),

            getNotificationsApplicationServerKey: procedure()
                .origins('api')
                .http(
                    'GET',
                    '/api/v2/records/notification/applicationServerKey'
                )
                .handler(async () => {
                    if (!this._notificationsController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }

                    const result =
                        await this._notificationsController.getApplicationServerKey();

                    return result;
                }),

            getPackage: getItemProcedure(
                this._auth,
                this._packagesController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/package')
            ),

            recordPackage: recordItemProcedure(
                this._auth,
                this._packagesController,
                z.object({
                    address: ADDRESS_VALIDATION,
                    markers: MARKERS_VALIDATION,
                }),
                procedure()
                    .origins('api')
                    .http('POST', '/api/v2/records/package')
            ),

            erasePackage: eraseItemProcedure(
                this._auth,
                this._packagesController,
                procedure()
                    .origins('api')
                    .http('DELETE', '/api/v2/records/package')
            ),

            listPackages: listItemsProcedure(
                this._auth,
                this._packagesController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/package/list')
            ),

            getPackageVersion: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/package/version')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        major: z.coerce.number().int().optional().nullable(),
                        minor: z.coerce.number().int().optional().nullable(),
                        patch: z.coerce.number().int().optional().nullable(),
                        tag: z.string().optional().nullable(),
                        sha256: z.string().optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        key: z.string().min(1).optional(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            address,
                            major,
                            minor,
                            patch,
                            tag,
                            sha256,
                            key,
                            instances,
                        },
                        context
                    ) => {
                        if (!this._packageVersionController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (validation.success === false) {
                            if (validation.errorCode === 'no_session_key') {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return validation;
                        }

                        const keyResult = getPackageVersionSpecifier(
                            key,
                            major,
                            minor,
                            patch,
                            tag,
                            sha256
                        );

                        if (keyResult.success === false) {
                            return keyResult;
                        }

                        const result =
                            await this._packageVersionController.getItem({
                                recordName,
                                address,
                                userId: validation.userId,
                                key: keyResult.key,
                                instances,
                            });

                        return result;
                    }
                ),

            recordPackageVersion: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/package/version')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        item: z.object({
                            address: ADDRESS_VALIDATION,
                            key: z.object({
                                major: z.number().int(),
                                minor: z.number().int(),
                                patch: z.number().int(),
                                tag: z
                                    .string()
                                    .max(16)
                                    .nullable()
                                    .optional()
                                    .default(''),
                            }),
                            auxFileRequest: z.object({
                                fileSha256Hex: z.string().min(1).max(123),
                                fileByteLength: z.number().positive().int(),
                                fileMimeType: z.string().min(1).max(128),
                                fileDescription: z
                                    .string()
                                    .min(1)
                                    .max(128)
                                    .optional(),
                            }),
                            entitlements: z.array(ENTITLEMENT_VALIDATION),
                            description: z.string(),
                            markers: MARKERS_VALIDATION.optional(),
                        }),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ recordName, item, instances }, context) => {
                    if (!this._packageVersionController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result =
                        await this._packageVersionController.recordItem({
                            recordKeyOrRecordName: recordName,
                            userId: validation.userId,
                            item: {
                                address: item.address,
                                key: {
                                    major: item.key.major,
                                    minor: item.key.minor,
                                    patch: item.key.patch,
                                    tag: item.key.tag ?? '',
                                },
                                auxFileRequest:
                                    item.auxFileRequest as PackageRecordVersionInput['auxFileRequest'],
                                entitlements:
                                    item.entitlements as Entitlement[],
                                description: item.description,
                                markers: item.markers,
                            },
                            instances,
                        });

                    return result;
                }),

            listPackageVersions: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/package/version/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, address, instances }, context) => {
                        if (!this._packageVersionController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const result =
                            await this._packageVersionController.listItems({
                                userId: validation.userId,
                                recordName: recordName,
                                address: address,
                                instances: instances ?? [],
                            });

                        return result;
                    }
                ),

            erasePackageVersion: procedure()
                .origins('api')
                .http('DELETE', '/api/v2/records/package/version')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        key: z.object({
                            major: z.number().int(),
                            minor: z.number().int(),
                            patch: z.number().int(),
                            tag: z.string().max(16).default(''),
                        }),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, key, instances },
                        context
                    ) => {
                        if (!this._packageVersionController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (validation.success === false) {
                            if (validation.errorCode === 'no_session_key') {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return validation;
                        }

                        const result =
                            await this._packageVersionController.eraseItem({
                                recordName,
                                address,
                                key: key as PackageRecordVersionKey,
                                userId: validation.userId,
                                instances: instances ?? [],
                            });

                        return result;
                    }
                ),

            reviewPackageVersion: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/package/version/review')
                .inputs(
                    z.object({
                        packageVersionId: z.string().min(1).max(36),
                        review: z.object({
                            id: z.string().min(1).max(36).optional(),
                            approved: z.boolean(),
                            approvalType: z
                                .enum(['normal', 'super'])
                                .nullable(),
                            reviewStatus: z.enum([
                                'pending',
                                'approved',
                                'rejected',
                            ]),
                            reviewComments: z.string().min(1).max(4096),
                        }),
                    })
                )
                .handler(async ({ packageVersionId, review }, context) => {
                    if (!this._packageVersionController) {
                        return {
                            success: false,
                            errorCode: 'not_supported',
                            errorMessage: 'This feature is not supported.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result =
                        await this._packageVersionController.reviewItem({
                            packageVersionId,
                            userId: validation.userId,
                            review: review as PackageVersionReviewInput,
                        });

                    return result;
                }),

            installPackage: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/package/install')
                .inputs(
                    z.object({
                        recordName:
                            RECORD_NAME_VALIDATION.optional().nullable(),
                        inst: z.string().min(1),
                        branch: z.string().optional().nullable(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        package: z.object({
                            recordName: RECORD_NAME_VALIDATION,
                            address: ADDRESS_VALIDATION,
                            key: z
                                .union([
                                    z
                                        .string()
                                        .describe(
                                            'The package version to install as a string'
                                        ),
                                    z
                                        .object({
                                            major: z
                                                .number()
                                                .int()
                                                .optional()
                                                .nullable(),
                                            minor: z
                                                .number()
                                                .int()
                                                .optional()
                                                .nullable(),
                                            patch: z
                                                .number()
                                                .int()
                                                .optional()
                                                .nullable(),
                                            tag: z
                                                .string()
                                                .optional()
                                                .nullable(),
                                            sha256: z
                                                .string()
                                                .optional()
                                                .nullable(),
                                        })
                                        .describe(
                                            'The package version specifier to install'
                                        ),
                                ])
                                .optional()
                                .nullable(),
                        }),
                    })
                )
                .handler(
                    async (
                        { recordName, inst, branch, package: pkg, instances },
                        context
                    ) => {
                        if (!this._websocketController) {
                            return INSTS_NOT_SUPPORTED_RESULT;
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );
                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const result =
                            await this._websocketController.installPackage({
                                userId: validation.userId,
                                userRole: validation.role,
                                recordName: recordName ?? null,
                                inst,
                                branch,
                                package: pkg as PackageVersionSpecifier,
                                instances,
                            });

                        return result;
                    }
                ),

            listInstalledPackages: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/package/install/list')
                .inputs(
                    z.object({
                        recordName:
                            RECORD_NAME_VALIDATION.optional().nullable(),
                        inst: z.string().min(1),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ recordName, inst, instances }, context) => {
                    if (!this._websocketController) {
                        return INSTS_NOT_SUPPORTED_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (
                        validation.success === false &&
                        validation.errorCode !== 'no_session_key'
                    ) {
                        return validation;
                    }

                    const result =
                        await this._websocketController.listInstalledPackages({
                            userId: validation.userId,
                            userRole: validation.role,
                            recordName: recordName ?? null,
                            inst,
                            instances,
                        });

                    return result;
                }),

            listRecords: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/list')
                .inputs(
                    z.object({
                        studioId: z.string().nonempty().optional(),
                        userId: z.string().optional(),
                    })
                )
                .handler(async ({ studioId, userId }, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    if (studioId) {
                        const result = await this._records.listStudioRecords(
                            studioId,
                            validation.userId
                        );
                        return result;
                    } else if (userId && userId !== validation.userId) {
                        if (!isSuperUserRole(validation.role)) {
                            return {
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                            } as const;
                        }

                        const result = await this._records.listRecords(userId);

                        return result;
                    } else {
                        const result = await this._records.listRecords(
                            validation.userId
                        );
                        return result;
                    }
                }),

            createRecordKey: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/key')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        policy: z.string({
                            invalid_type_error: 'policy must be a string.',
                            required_error: 'policy is required.',
                        }),
                    })
                )
                .handler(async ({ recordName, policy }, context) => {
                    if (!recordName || typeof recordName !== 'string') {
                        return {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage:
                                'recordName is required and must be a string.',
                        };
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._records.createPublicRecordKey(
                        recordName,
                        policy as PublicRecordKeyPolicy,
                        validation.userId
                    );

                    return result;
                }),

            grantPermission: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/permissions')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        permission: AVAILABLE_PERMISSIONS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, permission, instances }, context) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        if (permission.marker) {
                            const result =
                                await this._policyController.grantMarkerPermission(
                                    {
                                        recordKeyOrRecordName: recordName,
                                        marker: permission.marker,
                                        userId: sessionKeyValidation.userId,
                                        permission: permission as any,
                                        instances,
                                    }
                                );

                            return result;
                        } else if (
                            permission.resourceKind &&
                            permission.resourceId
                        ) {
                            const result =
                                await this._policyController.grantResourcePermission(
                                    {
                                        recordKeyOrRecordName: recordName,
                                        permission: permission as any,
                                        userId: sessionKeyValidation.userId,
                                        instances,
                                    }
                                );

                            return result;
                        }

                        return {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage:
                                'The given permission must have either a marker or a resourceId.',
                        } as const;
                    }
                ),

            revokePermission: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/permissions/revoke')
                .inputs(
                    z.object({
                        permissionId: z
                            .string({
                                invalid_type_error:
                                    'permissionId must be a string.',
                                required_error: 'permissionId is required.',
                            })
                            .nonempty('permissionId must not be empty'),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ permissionId, instances }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result =
                        await this._policyController.revokePermission({
                            permissionId,
                            userId: sessionKeyValidation.userId,
                            instances,
                        });

                    return result;
                }),

            listPermissions: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/permissions/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        marker: MARKER_VALIDATION.optional(),
                        resourceKind: RESOURCE_KIND_VALIDATION.optional(),
                        resourceId: z
                            .string({
                                invalid_type_error:
                                    'resourceId must be a string.',
                                required_error: 'resourceId is required.',
                            })
                            .optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, marker, resourceKind, resourceId },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        if (resourceKind && resourceId) {
                            const result =
                                await this._policyController.listPermissionsForResource(
                                    recordName,
                                    resourceKind,
                                    resourceId,
                                    sessionKeyValidation.userId
                                );
                            return result;
                        } else if (marker) {
                            const result =
                                await this._policyController.listPermissionsForMarker(
                                    recordName,
                                    marker,
                                    sessionKeyValidation.userId
                                );
                            return result;
                        } else {
                            const result =
                                await this._policyController.listPermissions(
                                    recordName,
                                    sessionKeyValidation.userId
                                );
                            return result;
                        }
                    }
                ),

            listUserRoles: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/role/user/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        userId: z
                            .string({
                                invalid_type_error: 'userId must be a string.',
                                required_error: 'userId is required.',
                            })
                            .nonempty('userId must not be empty'),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ recordName, userId, instances }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._policyController.listUserRoles(
                        recordName,
                        sessionKeyValidation.userId,
                        userId,
                        instances
                    );

                    return result;
                }),

            listInstRoles: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/role/inst/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        inst: z
                            .string({
                                invalid_type_error: 'inst must be a string.',
                                required_error: 'inst is required.',
                            })
                            .nonempty('inst must not be empty'),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ recordName, inst, instances }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._policyController.listInstRoles(
                        recordName,
                        sessionKeyValidation.userId,
                        inst,
                        instances
                    );

                    return result;
                }),

            listRoleAssignments: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/role/assignments/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        startingRole: z
                            .string({
                                invalid_type_error:
                                    'startingRole must be a string.',
                                required_error: 'startingRole is required.',
                            })
                            .nonempty('startingRole must not be empty')
                            .optional(),
                        role: z
                            .string({
                                invalid_type_error: 'role must be a string.',
                                required_error: 'role is required.',
                            })
                            .nonempty('role must not be empty')
                            .optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, role, startingRole, instances },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        if (role) {
                            const result =
                                await this._policyController.listAssignedRoles(
                                    recordName,
                                    sessionKeyValidation.userId,
                                    role,
                                    instances
                                );

                            return result;
                        } else {
                            const result =
                                await this._policyController.listRoleAssignments(
                                    recordName,
                                    sessionKeyValidation.userId,
                                    startingRole,
                                    instances
                                );

                            return result;
                        }
                    }
                ),

            grantRole: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/role/grant')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        userId: z
                            .string({
                                invalid_type_error: 'userId must be a string.',
                                required_error: 'userId is required.',
                            })
                            .nonempty('userId must not be empty')
                            .optional(),
                        inst: z
                            .string({
                                invalid_type_error: 'inst must be a string.',
                                required_error: 'inst is required.',
                            })
                            .nonempty('inst must not be empty')
                            .optional(),
                        role: z
                            .string({
                                invalid_type_error: 'role must be a string.',
                                required_error: 'role is required.',
                            })
                            .nonempty('role must not be empty'),
                        expireTimeMs: z
                            .number({
                                invalid_type_error:
                                    'expireTimeMs must be a number.',
                                required_error: 'expireTimeMs is required.',
                            })
                            .positive('expireTimeMs must be positive')
                            .optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            userId,
                            inst,
                            expireTimeMs,
                            role,
                            instances,
                        },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._policyController.grantRole(
                            recordName,
                            sessionKeyValidation.userId,
                            {
                                instance: inst,
                                userId: userId,
                                role,
                                expireTimeMs,
                            },
                            instances
                        );

                        return result;
                    }
                ),

            revokeRole: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/role/revoke')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        userId: z
                            .string({
                                invalid_type_error: 'userId must be a string.',
                                required_error: 'userId is required.',
                            })
                            .nonempty('userId must not be empty')
                            .optional(),
                        inst: z
                            .string({
                                invalid_type_error: 'inst must be a string.',
                                required_error: 'inst is required.',
                            })
                            .nonempty('inst must not be empty')
                            .optional(),
                        role: z
                            .string({
                                invalid_type_error: 'role must be a string.',
                                required_error: 'role is required.',
                            })
                            .nonempty('role must not be empty'),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, userId, inst, role, instances },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._policyController.revokeRole(
                            recordName,
                            sessionKeyValidation.userId,
                            {
                                instance: inst,
                                userId: userId,
                                role,
                            },
                            instances
                        );

                        return result;
                    }
                ),

            grantEntitlement: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/entitlement/grants')
                .inputs(
                    z.object({
                        packageId: z.string().min(1).max(36),
                        userId: z.string().optional().nullable(),
                        recordName: RECORD_NAME_VALIDATION,
                        feature: ENTITLEMENT_FEATURE_VALIDATION,
                        scope: z.literal('designated'),
                        expireTimeMs: z.number().min(1),
                    })
                )
                .handler(
                    async (
                        {
                            packageId,
                            userId,
                            recordName,
                            feature,
                            scope,
                            expireTimeMs,
                        },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result =
                            await this._policyController.grantEntitlement({
                                packageId,
                                userId: sessionKeyValidation.userId,
                                userRole: sessionKeyValidation.role,
                                grantingUserId:
                                    userId ?? sessionKeyValidation.userId,
                                recordName,
                                feature,
                                scope,
                                expireTimeMs,
                            });

                        return result;
                    }
                ),

            revokeEntitlement: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/entitlement/revoke')
                .inputs(
                    z.object({
                        grantId: z.string(),
                    })
                )
                .handler(async ({ grantId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result =
                        await this._policyController.revokeEntitlement({
                            userId: sessionKeyValidation.userId,
                            userRole: sessionKeyValidation.role,
                            grantId,
                        });

                    return result;
                }),

            listGrantedEntitlements: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/entitlement/grants/list')
                .inputs(
                    z.object({
                        packageId: z
                            .string()
                            .min(1)
                            .max(36)
                            .optional()
                            .nullable(),
                    })
                )
                .handler(async ({ packageId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result =
                        await this._policyController.listGrantedEntitlements({
                            userId: sessionKeyValidation.userId,
                            packageId: packageId,
                        });

                    return result;
                }),

            aiChat: procedure()
                .origins('api')
                .http('POST', '/api/v2/ai/chat')
                .inputs(
                    z.object({
                        model: z.string().nonempty().optional(),
                        messages: z.array(AI_CHAT_MESSAGE_SCHEMA).nonempty(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        temperature: z.number().min(0).max(2).optional(),
                        topP: z.number().optional(),
                        presencePenalty: z.number().min(-2).max(2).optional(),
                        frequencyPenalty: z.number().min(-2).max(2).optional(),
                        stopWords: z.array(z.string()).max(4).optional(),
                    })
                )
                .handler(
                    async (
                        { model, messages, instances, ...options },
                        context
                    ) => {
                        if (!this._aiController) {
                            return AI_NOT_SUPPORTED_RESULT;
                        }

                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._aiController.chat({
                            ...options,
                            model,
                            messages: messages as AIChatMessage[],
                            userId: sessionKeyValidation.userId,
                            userSubscriptionTier:
                                sessionKeyValidation.subscriptionTier,
                        });

                        return result;
                    }
                ),

            aiChatStream: procedure()
                .origins('api')
                .http('POST', '/api/v2/ai/chat/stream')
                .inputs(
                    z.object({
                        model: z.string().nonempty().optional(),
                        messages: z.array(AI_CHAT_MESSAGE_SCHEMA).nonempty(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        temperature: z.number().min(0).max(2).optional(),
                        topP: z.number().optional(),
                        presencePenalty: z.number().min(-2).max(2).optional(),
                        frequencyPenalty: z.number().min(-2).max(2).optional(),
                        stopWords: z.array(z.string()).max(4).optional(),
                    })
                )
                .handler(async ({ model, messages, ...options }, context) => {
                    if (!this._aiController) {
                        return AI_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = this._aiController.chatStream({
                        ...options,
                        model,
                        messages: messages as AIChatMessage[],
                        userId: sessionKeyValidation.userId,
                        userSubscriptionTier:
                            sessionKeyValidation.subscriptionTier,
                    });

                    return result;
                }),

            createAiSkybox: procedure()
                .origins('api')
                .http('POST', '/api/v2/ai/skybox')
                .inputs(
                    z.object({
                        prompt: z.string().nonempty().max(600),
                        negativePrompt: z
                            .string()
                            .nonempty()
                            .max(600)
                            .optional(),
                        blockadeLabs: z
                            .object({
                                skyboxStyleId: z.number().optional(),
                                remixImagineId: z.number().optional(),
                                seed: z.number().optional(),
                            })
                            .optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { prompt, negativePrompt, instances, blockadeLabs },
                        context
                    ) => {
                        if (!this._aiController) {
                            return AI_NOT_SUPPORTED_RESULT;
                        }

                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._aiController.generateSkybox({
                            prompt,
                            negativePrompt,
                            blockadeLabs,
                            userId: sessionKeyValidation.userId,
                            userSubscriptionTier:
                                sessionKeyValidation.subscriptionTier,
                        });

                        return result;
                    }
                ),

            getAiSkybox: procedure()
                .origins('api')
                .http('GET', '/api/v2/ai/skybox')
                .inputs(
                    z.object({
                        skyboxId: z
                            .string({
                                invalid_type_error:
                                    'skyboxId must be a string.',
                                required_error: 'skyboxId is required.',
                            })
                            .nonempty('skyboxId must not be empty'),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ skyboxId, instances }, context) => {
                    if (!this._aiController) {
                        return AI_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._aiController.getSkybox({
                        skyboxId,
                        userId: sessionKeyValidation.userId,
                        userSubscriptionTier:
                            sessionKeyValidation.subscriptionTier,
                    });

                    return result;
                }),

            createAiImage: procedure()
                .origins('api')
                .http('POST', '/api/v2/ai/image')
                .inputs(
                    z.object({
                        prompt: z
                            .string({
                                invalid_type_error: 'prompt must be a string.',
                                required_error: 'prompt is required.',
                            })
                            .nonempty('prompt must not be empty'),
                        model: z
                            .string({
                                invalid_type_error: 'model must be a string.',
                                required_error: 'model is required.',
                            })
                            .nonempty('model must not be empty')
                            .optional(),
                        negativePrompt: z.string().nonempty().optional(),
                        width: z.number().positive().int().optional(),
                        height: z.number().positive().int().optional(),
                        seed: z.number().positive().int().optional(),
                        numberOfImages: z.number().positive().int().optional(),
                        steps: z.number().positive().int().optional(),
                        sampler: z.string().nonempty().optional(),
                        cfgScale: z.number().min(0).int().optional(),
                        clipGuidancePreset: z.string().nonempty().optional(),
                        stylePreset: z.string().nonempty().optional(),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        {
                            prompt,
                            model,
                            negativePrompt,
                            width,
                            height,
                            seed,
                            numberOfImages,
                            steps,
                            sampler,
                            cfgScale,
                            clipGuidancePreset,
                            stylePreset,
                            instances,
                        },
                        context
                    ) => {
                        if (!this._aiController) {
                            return AI_NOT_SUPPORTED_RESULT;
                        }

                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._aiController.generateImage({
                            model,
                            prompt,
                            negativePrompt,
                            width,
                            height,
                            seed,
                            numberOfImages,
                            steps,
                            sampler,
                            cfgScale,
                            clipGuidancePreset,
                            stylePreset,
                            userId: sessionKeyValidation.userId,
                            userSubscriptionTier:
                                sessionKeyValidation.subscriptionTier,
                        });

                        return result;
                    }
                ),

            getHumeAccessToken: procedure()
                .origins('api')
                .http('GET', '/api/v2/ai/hume/token')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION.optional(),
                    })
                )
                .handler(async ({ recordName }, context) => {
                    if (!this._aiController) {
                        return AI_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._aiController.getHumeAccessToken({
                        userId: sessionKeyValidation.userId,
                        recordName,
                    });

                    return result;
                }),

            createSloydModel: procedure()
                .origins('api')
                .http('POST', '/api/v2/ai/sloyd/model')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION.optional(),
                        outputMimeType: z
                            .enum(['model/gltf+json', 'model/gltf-binary'])
                            .default('model/gltf+json'),
                        prompt: z.string().min(1),
                        levelOfDetail: z.number().min(0.01).max(1).optional(),
                        baseModelId: z.string().optional(),
                        thumbnail: z
                            .object({
                                type: z.literal('image/png'),
                                width: z.number().int().min(1),
                                height: z.number().int().min(1),
                            })
                            .optional(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            outputMimeType,
                            prompt,
                            levelOfDetail,
                            baseModelId,
                            thumbnail,
                        },
                        context
                    ) => {
                        if (!this._aiController) {
                            return AI_NOT_SUPPORTED_RESULT;
                        }

                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result =
                            await this._aiController.sloydGenerateModel({
                                userId: sessionKeyValidation.userId,
                                recordName:
                                    recordName ?? sessionKeyValidation.userId,
                                outputMimeType,
                                prompt,
                                levelOfDetail,
                                baseModelId,
                                thumbnail: thumbnail as any,
                            });

                        return result;
                    }
                ),

            getLoomAccessToken: procedure()
                .origins('api')
                .http('GET', '/api/v2/loom/token')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                    })
                )
                .handler(async ({ recordName }, context) => {
                    if (!this._loomController) {
                        return LOOM_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._loomController.getToken({
                        userId: sessionKeyValidation.userId,
                        recordName: recordName,
                    });

                    return result;
                }),

            createOpenAIRealtimeSession: procedure()
                .origins('api')
                .http('POST', '/api/v2/ai/openai/realtime/session')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        request: z.object({
                            model: z.string().min(1),
                            instructions: z.string().min(1).optional(),
                            modalities: z
                                .array(z.enum(['audio', 'text']))
                                .max(2)
                                .optional(),
                            maxResponseOutputTokens: z
                                .number()
                                .int()
                                .min(1)
                                .optional(),
                            inputAudioFormat: z
                                .enum(['pcm16', 'g711_ulaw', 'g711_alaw'])
                                .optional(),
                            inputAudioNoiseReduction: z
                                .object({
                                    type: z
                                        .enum(['near_field', 'far_field'])
                                        .optional(),
                                })
                                .optional()
                                .nullable(),
                            inputAudioTranscription: z
                                .object({
                                    language: z.string().min(1).optional(),
                                    model: z.string().min(1).optional(),
                                    prompt: z.string().min(1).optional(),
                                })
                                .optional()
                                .nullable(),
                            outputAudioFormat: z
                                .enum(['pcm16', 'g711_ulaw', 'g711_alaw'])
                                .optional(),
                            temperature: z.number().min(0).max(2).optional(),
                            toolChoice: z.string().optional(),
                            tools: z
                                .array(
                                    z.object({
                                        description: z.string().optional(),
                                        name: z.string(),
                                        parameters: z.any().optional(),
                                        type: z.enum(['function']).optional(),
                                    })
                                )
                                .optional(),
                            turnDetection: z
                                .object({
                                    createResponse: z.boolean().optional(),
                                    eagerness: z
                                        .enum(['low', 'medium', 'high'])
                                        .optional(),
                                    interruptResponse: z.boolean().optional(),
                                    prefixPaddingMs: z
                                        .number()
                                        .min(0)
                                        .optional(),
                                    silenceDurationMs: z
                                        .number()
                                        .min(0)
                                        .optional(),
                                    threshold: z.number().min(0).optional(),
                                    type: z
                                        .enum(['server_vad', 'semantic_vad'])
                                        .optional(),
                                })
                                .optional()
                                .nullable(),
                            voice: z.string().min(1).optional(),
                        }),
                    })
                )
                .handler(async ({ recordName, request }, context) => {
                    if (!this._aiController) {
                        return AI_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result =
                        await this._aiController.createOpenAIRealtimeSessionToken(
                            {
                                userId: sessionKeyValidation.userId,
                                recordName: recordName,
                                request: {
                                    model: request.model,
                                    ...request,
                                },
                            }
                        );

                    return result;
                }),

            getStudio: procedure()
                .origins('account')
                .http('GET', '/api/v2/studios')
                .inputs(
                    z.object({
                        studioId: STUDIO_ID_VALIDATION,
                    })
                )
                .handler(async ({ studioId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._records.getStudio(
                        studioId,
                        sessionKeyValidation.userId
                    );
                    return result;
                }),

            createStudio: procedure()
                .origins('account')
                .http('POST', '/api/v2/studios')
                .inputs(
                    z.object({
                        displayName: STUDIO_DISPLAY_NAME_VALIDATION,
                        ownerStudioComId: z
                            .string({
                                invalid_type_error:
                                    'ownerStudioComId must be a string.',
                                required_error: 'ownerStudioComId is required.',
                            })
                            .nonempty('ownerStudioComId must not be empty')
                            .nullable()
                            .optional(),
                    })
                )
                .handler(async ({ displayName, ownerStudioComId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    if (!ownerStudioComId) {
                        const result = await this._records.createStudio(
                            displayName,
                            sessionKeyValidation.userId
                        );
                        return result;
                    } else {
                        const result = await this._records.createStudioInComId(
                            displayName,
                            sessionKeyValidation.userId,
                            ownerStudioComId
                        );
                        return result;
                    }
                }),

            updateStudio: procedure()
                .origins('account')
                .http('PUT', '/api/v2/studios')
                .inputs(
                    z.object({
                        id: STUDIO_ID_VALIDATION,
                        displayName: STUDIO_DISPLAY_NAME_VALIDATION.optional(),
                        logoUrl: z
                            .string({
                                invalid_type_error: 'logoUrl must be a string.',
                                required_error: 'logoUrl is required.',
                            })
                            .url()
                            .min(1)
                            .max(512)
                            .nullable()
                            .optional(),
                        logoBackgroundColor: z
                            .string({
                                invalid_type_error:
                                    'logoBackgroundColor must be a string.',
                                required_error:
                                    'logoBackgroundColor is required.',
                            })
                            .min(1)
                            .max(32)
                            .nullable()
                            .optional(),
                        comIdConfig: COM_ID_CONFIG_SCHEMA.optional(),
                        playerConfig: COM_ID_PLAYER_CONFIG.optional(),
                        loomConfig: LOOM_CONFIG.optional(),
                        humeConfig: HUME_CONFIG.optional(),
                    })
                )
                .handler(
                    async (
                        {
                            id,
                            displayName,
                            logoUrl,
                            comIdConfig,
                            playerConfig,
                            loomConfig,
                            humeConfig,
                        },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._records.updateStudio({
                            userId: sessionKeyValidation.userId,
                            studio: {
                                id,
                                displayName,
                                logoUrl,
                                comIdConfig,
                                playerConfig,
                                loomConfig,
                                humeConfig,
                            },
                        });
                        return result;
                    }
                ),

            requestStudioComId: procedure()
                .origins('account')
                .http('POST', '/api/v2/studios/requestComId')
                .inputs(
                    z.object({
                        studioId: STUDIO_ID_VALIDATION,
                        comId: COM_ID_VALIDATION,
                    })
                )
                .handler(async ({ studioId, comId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._records.requestComId({
                        studioId,
                        userId: sessionKeyValidation.userId,
                        requestedComId: comId,
                        ipAddress: context.ipAddress,
                    });

                    return result;
                }),

            listStudios: procedure()
                .origins('api')
                .http('GET', '/api/v2/studios/list')
                .inputs(
                    z.object({
                        comId: z.string().nonempty().nullable().optional(),
                        userId: z.string().optional(),
                    })
                )
                .handler(async ({ comId, userId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    if (userId && userId !== sessionKeyValidation.userId) {
                        if (!isSuperUserRole(sessionKeyValidation.role)) {
                            return {
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                            } as const;
                        }
                    } else {
                        userId = sessionKeyValidation.userId;
                    }

                    if (comId) {
                        const result = await this._records.listStudiosByComId(
                            userId,
                            comId
                        );
                        return result;
                    } else {
                        const result = await this._records.listStudios(userId);
                        return result;
                    }
                }),

            listStudioMembers: procedure()
                .origins('account')
                .http('GET', '/api/v2/studios/members/list')
                .inputs(
                    z.object({
                        studioId: STUDIO_ID_VALIDATION,
                    })
                )
                .handler(async ({ studioId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._records.listStudioMembers(
                        studioId,
                        sessionKeyValidation.userId
                    );
                    return result;
                }),

            addStudioMember: procedure()
                .origins('account')
                .http('POST', '/api/v2/studios/members')
                .inputs(
                    z.object({
                        studioId: STUDIO_ID_VALIDATION,
                        addedUserId: z
                            .string({
                                invalid_type_error:
                                    'addedUserId must be a string.',
                                required_error: 'addedUserId is required.',
                            })
                            .nonempty('addedUserId must not be empty')
                            .optional(),
                        addedEmail: z
                            .string({
                                invalid_type_error:
                                    'addedEmail must be a string.',
                                required_error: 'addedEmail is required.',
                            })
                            .nonempty('addedEmail must not be empty')
                            .optional(),
                        addedPhoneNumber: z
                            .string({
                                invalid_type_error:
                                    'addedPhoneNumber must be a string.',
                                required_error: 'addedPhoneNumber is required.',
                            })
                            .nonempty('addedPhoneNumber must not be empty')
                            .optional(),
                        addedDisplayName: z
                            .string({
                                invalid_type_error:
                                    'addedDisplayName must be a string.',
                                required_error: 'addedDisplayName is required.',
                            })
                            .nonempty('addedDisplayName must not be empty')
                            .optional(),
                        role: z.union([
                            z.literal('admin'),
                            z.literal('member'),
                        ]),
                    })
                )
                .handler(
                    async (
                        {
                            studioId,
                            addedUserId,
                            addedEmail,
                            addedPhoneNumber,
                            addedDisplayName,
                            role,
                        },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (sessionKeyValidation.success === false) {
                            if (
                                sessionKeyValidation.errorCode ===
                                'no_session_key'
                            ) {
                                return NOT_LOGGED_IN_RESULT;
                            }
                            return sessionKeyValidation;
                        }

                        const result = await this._records.addStudioMember({
                            studioId,
                            userId: sessionKeyValidation.userId,
                            role,
                            addedUserId,
                            addedEmail,
                            addedPhoneNumber,
                            addedDisplayName,
                        });
                        return result;
                    }
                ),

            removeStudioMember: procedure()
                .origins('account')
                .http('DELETE', '/api/v2/studios/members')
                .inputs(
                    z.object({
                        studioId: STUDIO_ID_VALIDATION,
                        removedUserId: z
                            .string({
                                invalid_type_error:
                                    'removedUserId must be a string.',
                                required_error: 'removedUserId is required.',
                            })
                            .nonempty('removedUserId must not be empty')
                            .optional(),
                    })
                )
                .handler(async ({ studioId, removedUserId }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (sessionKeyValidation.success === false) {
                        if (
                            sessionKeyValidation.errorCode === 'no_session_key'
                        ) {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return sessionKeyValidation;
                    }

                    const result = await this._records.removeStudioMember({
                        studioId,
                        userId: sessionKeyValidation.userId,
                        removedUserId,
                    });
                    return result;
                }),

            getPlayerConfig: procedure()
                .origins('api')
                .http('GET', '/api/v2/player/config')
                .inputs(
                    z.object({
                        comId: z.string().nonempty(),
                    })
                )
                .handler(async ({ comId }, context) => {
                    const result = await this._records.getPlayerConfig(comId);
                    return result;
                }),

            getSubscriptions: procedure()
                .origins('account')
                .http('GET', '/api/v2/subscriptions')
                .inputs(
                    z.object({
                        studioId: z
                            .string({
                                invalid_type_error:
                                    'studioId must be a string.',
                                required_error: 'studioId is required.',
                            })
                            .nonempty('studioId must be non-empty.')
                            .optional(),
                        userId: z
                            .string({
                                invalid_type_error: 'userId must be a string.',
                                required_error: 'userId is required.',
                            })
                            .nonempty('userId must be non-empty.')
                            .optional(),
                    })
                )
                .handler(async ({ studioId, userId }, context) => {
                    if (!this._subscriptions) {
                        return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKey = context.sessionKey;

                    if (!sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const result =
                        await this._subscriptions.getSubscriptionStatus({
                            sessionKey,
                            userId,
                            studioId,
                        });

                    if (!result.success) {
                        return result;
                    }

                    return {
                        success: true,
                        publishableKey: result.publishableKey,
                        subscriptions: result.subscriptions.map((s) => ({
                            active: s.active,
                            statusCode: s.statusCode,
                            productName: s.productName,
                            startDate: s.startDate,
                            endedDate: s.endedDate,
                            cancelDate: s.cancelDate,
                            canceledDate: s.canceledDate,
                            currentPeriodStart: s.currentPeriodStart,
                            currentPeriodEnd: s.currentPeriodEnd,
                            renewalInterval: s.renewalInterval,
                            intervalLength: s.intervalLength,
                            intervalCost: s.intervalCost,
                            currency: s.currency,
                            featureList: s.featureList,
                        })),
                        purchasableSubscriptions:
                            result.purchasableSubscriptions.map((s) => ({
                                id: s.id,
                                name: s.name,
                                description: s.description,
                                featureList: s.featureList,
                                prices: s.prices,
                                defaultSubscription: s.defaultSubscription,
                            })),
                    } as const;
                }),

            getManageSubscriptionLink: procedure()
                .origins('account')
                .http('POST', '/api/v2/subscriptions/manage')
                .inputs(
                    z.object({
                        userId: z
                            .string({
                                invalid_type_error: 'userId must be a string.',
                                required_error: 'userId is required.',
                            })
                            .nonempty('userId must not be empty.')
                            .optional(),
                        studioId: z
                            .string({
                                invalid_type_error:
                                    'studioId must be a string.',
                                required_error: 'studioId is required.',
                            })
                            .nonempty('studioId must not be empty.')
                            .optional(),
                        subscriptionId: z.string().optional(),
                        expectedPrice: z
                            .object({
                                currency: z.string(),
                                cost: z.number(),
                                interval: z.enum([
                                    'month',
                                    'year',
                                    'week',
                                    'day',
                                ]),
                                intervalLength: z.number(),
                            })
                            .optional(),
                    })
                )
                .handler(
                    async (
                        { userId, studioId, subscriptionId, expectedPrice },
                        context
                    ) => {
                        if (!this._subscriptions) {
                            return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                        }

                        const sessionKey = context.sessionKey;

                        if (!sessionKey) {
                            return NOT_LOGGED_IN_RESULT;
                        }

                        const result =
                            await this._subscriptions.createManageSubscriptionLink(
                                {
                                    sessionKey,
                                    userId,
                                    studioId,
                                    subscriptionId,
                                    expectedPrice:
                                        expectedPrice as CreateManageSubscriptionRequest['expectedPrice'],
                                }
                            );

                        if (!result.success) {
                            return result;
                        }

                        return {
                            success: true,
                            url: result.url,
                        };
                    }
                ),

            updateSubscription: procedure()
                .origins('account')
                .http('POST', '/api/v2/subscriptions/update')
                .inputs(
                    z.object({
                        userId: z.string().optional(),
                        studioId: z.string().optional(),
                        subscriptionId: z.string().nullable(),
                        subscriptionStatus: z
                            .enum([
                                'active',
                                'canceled',
                                'ended',
                                'past_due',
                                'unpaid',
                                'incomplete',
                                'incomplete_expired',
                                'trialing',
                                'paused',
                            ])
                            .nullable(),
                        subscriptionPeriodStartMs: z
                            .number()
                            .positive()
                            .int()
                            .nullable(),
                        subscriptionPeriodEndMs: z
                            .number()
                            .positive()
                            .int()
                            .nullable(),
                    })
                )
                .handler(
                    async (
                        {
                            userId,
                            studioId,
                            subscriptionId,
                            subscriptionStatus,
                            subscriptionPeriodStartMs,
                            subscriptionPeriodEndMs,
                        },
                        context
                    ) => {
                        if (!this._subscriptions) {
                            return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                        }

                        const sessionKey = context.sessionKey;

                        if (!sessionKey) {
                            return NOT_LOGGED_IN_RESULT;
                        }

                        const validation = await this._validateSessionKey(
                            sessionKey
                        );
                        if (validation.success === false) {
                            return validation;
                        }

                        const result =
                            await this._subscriptions.updateSubscription({
                                currentUserId: validation.userId,
                                currentUserRole: validation.role,
                                userId,
                                studioId,
                                subscriptionId,
                                subscriptionStatus,
                                subscriptionPeriodStartMs,
                                subscriptionPeriodEndMs,
                            });

                        return result;
                    }
                ),

            listInsts: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/insts/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION.optional(),
                        inst: z.string().optional(),
                    })
                )
                .handler(async ({ recordName, inst }, context) => {
                    if (!this._websocketController) {
                        return INSTS_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKey = context.sessionKey;

                    if (!sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        sessionKey
                    );

                    if (validation.success === false) {
                        return validation;
                    }

                    const userId = validation.userId;

                    const result = await this._websocketController.listInsts(
                        recordName,
                        userId,
                        inst
                    );
                    return result;
                }),

            deleteInst: procedure()
                .origins('account')
                .http('DELETE', '/api/v2/records/insts')
                .inputs(
                    z.object({
                        recordKey: RECORD_KEY_VALIDATION.optional(),
                        recordName: RECORD_NAME_VALIDATION.optional(),
                        inst: z.string().optional(),
                    })
                )
                .handler(async ({ recordKey, recordName, inst }, context) => {
                    if (!this._websocketController) {
                        return INSTS_NOT_SUPPORTED_RESULT;
                    }

                    const sessionKey = context.sessionKey;

                    if (!sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        sessionKey
                    );

                    if (validation.success === false) {
                        return validation;
                    }

                    const result = await this._websocketController.eraseInst(
                        recordKey ?? recordName,
                        inst,
                        validation.userId
                    );
                    return result;
                }),

            reportInst: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/insts/report')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION.nullable(),
                        inst: z.string().nonempty(),
                        automaticReport: z.boolean(),
                        reportReason: z.union([
                            z.literal('poor-performance'),
                            z.literal('spam'),
                            z.literal('harassment'),
                            z.literal('copyright-infringement'),
                            z.literal('obscene'),
                            z.literal('illegal'),
                            z.literal('other'),
                        ]),
                        reportReasonText: z.string().nonempty().trim(),
                        reportedUrl: z.string().url(),
                        reportedPermalink: z.string().url(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            inst,
                            automaticReport,
                            reportReason,
                            reportReasonText,
                            reportedUrl,
                            reportedPermalink,
                        },
                        context
                    ) => {
                        if (!this._moderationController) {
                            return MODERATION_NOT_SUPPORTED_RESULT;
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );

                        if (validation.success === false) {
                            if (validation.errorCode !== 'no_session_key') {
                                return validation;
                            }
                        }

                        const result =
                            await this._moderationController.reportInst({
                                recordName,
                                inst,
                                automaticReport,
                                reportReason,
                                reportReasonText,
                                reportedUrl,
                                reportedPermalink,
                                reportingIpAddress: context.ipAddress,
                                reportingUserId: validation.userId,
                            });

                        return result;
                    }
                ),

            getInstData: procedure()
                .origins(true)
                .http('GET', '/instData')
                .inputs(
                    z.object({
                        recordName:
                            RECORD_NAME_VALIDATION.nullable().optional(),
                        inst: z.string().nonempty(),
                        branch: z
                            .string()
                            .nonempty()
                            .default(DEFAULT_BRANCH_NAME),
                    })
                )
                .handler(async ({ recordName, inst, branch }, context) => {
                    let userId: string = null;
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            userId = null;
                        } else {
                            return validation;
                        }
                    } else {
                        userId = validation.userId;
                    }

                    const data = await this._websocketController.getBranchData(
                        userId,
                        recordName ?? null,
                        inst,
                        branch
                    );

                    return {
                        success: true,
                        ...data,
                    };
                }),

            listProcedures: procedure()
                .origins(true)
                .http('GET', '/api/v2/procedures')
                .inputs(z.object({}))
                .handler(async (_, context) => {
                    const procedures = this._procedures;
                    const metadata = getProcedureMetadata(procedures);
                    return {
                        success: true,
                        ...metadata,
                        version:
                            typeof GIT_TAG === 'string' ? GIT_TAG : undefined,
                        versionHash:
                            typeof GIT_HASH === 'string' ? GIT_HASH : undefined,
                    };
                }),
        };
    }

    private _setupRoutes() {
        const procs = this._procedures;
        for (let procedureName of Object.keys(procs)) {
            if (Object.prototype.hasOwnProperty.call(procs, procedureName)) {
                const procedure = (procs as any)[procedureName];
                if (procedure.http) {
                    this._addProcedureRoute(procedure, procedureName);
                }
            }
        }

        this.addRoute({
            method: 'POST',
            path: '/api/v3/callProcedure',
            schema: z.object({
                procedure: z.string().nonempty(),
                input: z.any().optional(),
                query: z.any().optional(),
            }),
            handler: async (request, { procedure, input, query }) => {
                const proc = (procs as any)[procedure] as Procedure<
                    any,
                    ProcedureOutput,
                    any
                >;
                if (!proc) {
                    return returnResult({
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: `Unable to find procedure: ${procedure}`,
                    } as const);
                }

                const span = trace.getActiveSpan();
                if (span) {
                    span.updateName(`http:${procedure}`);
                    span.setAttribute('request.procedure', procedure);
                }

                const origins =
                    proc.allowedOrigins === 'account'
                        ? this._allowedAccountOrigins
                        : proc.allowedOrigins === 'api'
                        ? this._allowedApiOrigins
                        : proc.allowedOrigins ?? true;

                if (origins !== true && !validateOrigin(request, origins)) {
                    return formatResponse(
                        request,
                        returnResult(INVALID_ORIGIN_RESULT),
                        origins
                    );
                }

                const context: RPCContext = {
                    ipAddress: request.ipAddress,
                    sessionKey: getSessionKey(request),
                    httpRequest: request,
                    origin: request.headers.origin ?? null,
                };

                let result: ProcedureOutput;
                if (proc.schema) {
                    const parseResult = proc.schema.safeParse(input);
                    if (parseResult.success === false) {
                        return formatResponse(
                            request,
                            returnZodError(parseResult.error),
                            origins
                        );
                    }

                    let queryData: any;
                    if (proc.querySchema) {
                        const parseResult = proc.querySchema.safeParse(query);
                        if (parseResult.success === false) {
                            return formatResponse(
                                request,
                                returnZodError(parseResult.error),
                                origins
                            );
                        }
                        queryData = parseResult.data;
                    }

                    result = await proc.handler(
                        parseResult.data,
                        context,
                        queryData
                    );
                } else {
                    result = await proc.handler(input, context);
                }

                return returnProcedureOutput(result);
            },
        });

        this.addRoute({
            method: 'POST',
            path: '/api/stripeWebhook',
            name: 'stripeWebhook',
            allowedOrigins: true,
            handler: (request) => this._stripeWebhook(request),
        });
    }

    /**
     * Adds the given procedure to the server.
     * @param name The name of the procedure.
     * @param procedure The procedure that should be added.
     */
    addProcedure<TInput, TOutput extends ProcedureOutput, TQuery>(
        name: string,
        procedure: Procedure<TInput, TOutput, TQuery>
    ) {
        if (name in this._procedures) {
            throw new Error(
                `A procedure already exists with the name: ${name}`
            );
        }
        (this._procedures as any)[name] = procedure;
        if (procedure.http) {
            this._addProcedureRoute(procedure, name);
        }
    }

    /**
     * Adds the given procedures to the server.
     * @param procedures The procedures that should be added.
     */
    addProcedures(procedures: Procedures) {
        for (let name of Object.keys(procedures)) {
            this.addProcedure(name, procedures[name]);
        }
    }

    /**
     * Adds the given procedural route to the server.
     * @param route The route that should be added.
     */
    private _addProcedureRoute<T, TQuery>(
        procedure: Procedure<T, ProcedureOutput, TQuery>,
        name: string
    ): void {
        if (!procedure.http) {
            throw new Error('Procedure must have an http route defined.');
        }

        const route = procedure.http;
        const r: Route<T> = {
            method: route.method,
            path: route.path,
            schema: procedure.schema,
            querySchema: procedure.querySchema,
            name: name,
            handler: async (request, data, query) => {
                const context: RPCContext = {
                    ipAddress: request.ipAddress,
                    sessionKey: getSessionKey(request),
                    httpRequest: request,
                    origin: request.headers.origin ?? null,
                };
                const result = await procedure.handler(data, context, query);
                const response = returnProcedureOutput(result);

                if (procedure.mapToResponse) {
                    const procedureResponse = await procedure.mapToResponse(
                        result,
                        context
                    );
                    return merge(response, procedureResponse);
                }

                return response;
            },
            allowedOrigins: procedure.allowedOrigins,
        };

        this.addRoute(r);
    }

    /**
     * Adds the given route to the server.
     */
    addRoute<T>(route: Route<T>) {
        const routeKey = `${route.method}:${route.path}`;
        if (this._routes.has(routeKey)) {
            throw new Error(
                `A route already exists for the given method and path: ${routeKey}`
            );
        }
        this._routes.set(routeKey, route);
    }

    /**
     * Forcefully adds the given route to the server, overwriting any routes that already exist.
     * @param route The route that should be added.
     */
    overrideRoute<T>(route: Route<T>) {
        const routeKey = `${route.method}:${route.path}`;
        this._routes.set(routeKey, route);
    }

    /**
     * Handles the given request and returns the specified response.
     * @param request The request that should be handled.
     */
    @traced(
        'RecordsServer',
        {
            kind: SpanKind.SERVER,
            root: true,
        },
        {
            histogram: {
                meter: RECORDS_SERVER_METER,
                name: 'records.http.duration',
                options: {
                    description:
                        'A distribution of the HTTP server request durations.',
                    unit: 'miliseconds',
                    valueType: ValueType.INT,
                },
                attributes: (
                    [request]: [GenericHttpRequest],
                    ret: GenericHttpResponse
                ) => ({
                    [SEMATTRS_HTTP_METHOD]: request.method,
                    ['http.status_code']: ret.statusCode,
                }),
            },
            errorCounter: {
                meter: RECORDS_SERVER_METER,
                name: 'records.http.errors',
                options: {
                    description: 'A count of the HTTP server errors.',
                },
            },
        }
    )
    @traceHttpResponse()
    async handleHttpRequest(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const span = trace.getActiveSpan();
        if (span) {
            const url = new URL(request.path, `http://${request.headers.host}`);
            span.setAttributes({
                [SEMATTRS_HTTP_METHOD]: request.method,
                [SEMATTRS_HTTP_URL]: url.href,
                [SEMATTRS_HTTP_TARGET]: request.path,
                [SEMATTRS_HTTP_CLIENT_IP]: request.ipAddress,
                [SEMATTRS_HTTP_HOST]: request.headers.host,
                [SEMATTRS_HTTP_USER_AGENT]: request.headers['user-agent'],
                ['http.origin']: request.headers.origin,
            });
        }

        let skipRateLimitCheck = false;
        if (!this._rateLimit) {
            skipRateLimitCheck = true;
        } else if (
            request.method == 'POST' &&
            request.path === '/api/stripeWebhook'
        ) {
            skipRateLimitCheck = true;
        }

        if (skipRateLimitCheck && span) {
            span.setAttribute('request.rateLimitCheck', 'skipped');
        }

        if (!skipRateLimitCheck) {
            const response = await this._rateLimit.checkRateLimit({
                ipAddress: request.ipAddress,
            });

            if (response.success === false) {
                if (response.errorCode === 'rate_limit_exceeded') {
                    return formatResponse(
                        request,
                        returnResult(response),
                        true
                    );
                } else {
                    console.log(
                        '[RecordsServer] Rate limit check failed. Allowing request to continue.'
                    );
                }
            }
        }

        if (
            request.method === 'GET' &&
            request.path.startsWith('/api/') &&
            request.path.endsWith('/metadata') &&
            !!request.pathParams.userId
        ) {
            return formatResponse(
                request,
                await this._getUserInfo(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'PUT' &&
            request.path.startsWith('/api/') &&
            request.path.endsWith('/metadata') &&
            !!request.pathParams.userId
        ) {
            return formatResponse(
                request,
                await this._putUserInfo(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path.startsWith('/api/') &&
            request.path.endsWith('/subscription') &&
            !!request.pathParams.userId
        ) {
            return formatResponse(
                request,
                await this._getSubscriptionInfo(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path.startsWith('/api/') &&
            request.path.endsWith('/subscription/manage') &&
            !!request.pathParams.userId
        ) {
            return formatResponse(
                request,
                await this._manageSubscription(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'OPTIONS' &&
            request.path.startsWith('/api/v2/records/file/')
        ) {
            return formatResponse(
                request,
                await this._handleRecordFileOptions(request),
                this._allowedApiOrigins
            );
        } else if (request.method === 'OPTIONS') {
            return formatResponse(
                request,
                await this._handleOptions(request),
                true
            );
        }

        const route = this._routes.get(`${request.method}:${request.path}`);
        if (route) {
            if (span && route.name) {
                span.updateName(`http:${route.name}`);
            }

            const origins =
                route.allowedOrigins === 'account'
                    ? this._allowedAccountOrigins
                    : route.allowedOrigins === 'api'
                    ? this._allowedApiOrigins
                    : route.allowedOrigins ?? true;

            if (origins !== true && !validateOrigin(request, origins)) {
                return formatResponse(
                    request,
                    returnResult(INVALID_ORIGIN_RESULT),
                    origins
                );
            }

            try {
                let response: GenericHttpResponse;
                if (route.schema) {
                    let data: any;
                    if (request.method === 'GET' || request.method === 'HEAD') {
                        const parseResult = route.schema.safeParse(
                            request.query
                        );
                        if (parseResult.success === false) {
                            return formatResponse(
                                request,
                                returnZodError(parseResult.error),
                                origins
                            );
                        }
                        data = parseResult.data;
                    } else {
                        if (typeof request.body !== 'string') {
                            return formatResponse(
                                request,
                                returnResult(
                                    UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON
                                ),
                                origins
                            );
                        }

                        const jsonResult = tryParseJson(request.body);

                        if (
                            !jsonResult.success ||
                            typeof jsonResult.value !== 'object'
                        ) {
                            return formatResponse(
                                request,
                                returnResult(
                                    UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON
                                ),
                                origins
                            );
                        }

                        const parseResult = route.schema.safeParse(
                            jsonResult.value
                        );
                        if (parseResult.success === false) {
                            return formatResponse(
                                request,
                                returnZodError(parseResult.error),
                                origins
                            );
                        }
                        data = parseResult.data;
                    }

                    let query: any;
                    if (route.querySchema) {
                        const parseResult = route.schema.safeParse(
                            request.query
                        );
                        if (parseResult.success === false) {
                            return formatResponse(
                                request,
                                returnZodError(parseResult.error),
                                origins
                            );
                        }
                        query = parseResult.data;
                    }

                    response = await route.handler(request, data, query);
                } else {
                    response = await route.handler(request);
                }

                if (response) {
                    return formatResponse(request, response, origins);
                } else {
                    return formatResponse(
                        request,
                        returnResult({ success: true }),
                        origins
                    );
                }
            } catch (err) {
                console.error(
                    '[RecordsServer] Error while handling request: ',
                    err,
                    request
                );
                return formatResponse(
                    request,
                    returnResult({
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    }),
                    origins
                );
            }
        }

        return formatResponse(
            request,
            returnResult(OPERATION_NOT_FOUND_RESULT),
            true
        );
    }

    /**
     * Handles the given request and returns the specified response.
     * @param request The request that should be handled.
     */
    @traced(
        'RecordsServer',
        {
            kind: SpanKind.SERVER,
        },
        {
            histogram: {
                meter: RECORDS_SERVER_METER,
                name: 'records.ws.duration',
                options: {
                    description:
                        'A distribution of the HTTP server request durations.',
                    unit: 'miliseconds',
                    valueType: ValueType.INT,
                },
                attributes: ([request]: [GenericWebsocketRequest], ret) => ({
                    'websocket.type': request.type,
                }),
            },
            errorCounter: {
                meter: RECORDS_SERVER_METER,
                name: 'records.ws.errors',
                options: {
                    description: 'A count of the Websocket server errors.',
                },
                attributes: ([request]: [GenericWebsocketRequest], ret) => ({
                    'websocket.type': request.type,
                }),
            },
        }
    )
    async handleWebsocketRequest(request: GenericWebsocketRequest) {
        if (!this._websocketController) {
            return;
        }

        const span = trace.getActiveSpan();
        if (span) {
            span.setAttributes({
                [SEMATTRS_HTTP_CLIENT_IP]: request.ipAddress,
                ['http.origin']: request.origin,
                ['websocket.type']: request.type,
                ['request.connectionId']: request.connectionId,
            });
        }

        let skipRateLimitCheck = false;
        if (!this._websocketRateLimit) {
            skipRateLimitCheck = true;
        } else if (request.type !== 'message') {
            skipRateLimitCheck = true;
        }

        if (!skipRateLimitCheck) {
            const response = await this._websocketRateLimit.checkRateLimit({
                ipAddress: request.ipAddress,
            });

            if (response.success === false) {
                if (response.errorCode === 'rate_limit_exceeded') {
                    await this._websocketController.rateLimitExceeded(
                        request.connectionId,
                        response.retryAfterSeconds ?? 0,
                        response.totalHits,
                        Date.now()
                    );
                    return;
                } else {
                    console.log(
                        '[RecordsServer] Websocket rate limit check failed. Allowing request to continue.'
                    );
                }
            }
        }

        if (skipRateLimitCheck && span) {
            span.setAttribute('request.rateLimitCheck', 'skipped');
        }

        if (request.type === 'connect') {
            console.log(
                `[RecordsServer] Connection recieved: `,
                request.connectionId
            );
        } else if (request.type === 'disconnect') {
            console.log(
                `[RecordsServer] Disconnection recieved: `,
                request.connectionId
            );
            await this._websocketController.disconnect(request.connectionId);
        } else if (request.type === 'message') {
            if (typeof request.body !== 'string') {
                // Bad request
                return;
            }

            const jsonResult = tryParseJson(request.body);

            if (!jsonResult.success || typeof jsonResult.value !== 'object') {
                return;
            }

            const parseResult = websocketEventSchema.safeParse(
                jsonResult.value
            );

            if (parseResult.success === false) {
                await this._sendWebsocketZodError(
                    request.connectionId,
                    null,
                    parseResult.error
                );
                return;
            }

            let [type, requestId, ...rest] = parseResult.data;

            if (type === WebsocketEventTypes.Message) {
                const [message] = rest;
                return await this._processWebsocketMessage(
                    request,
                    requestId,
                    message
                );
            } else if (type === WebsocketEventTypes.UploadRequest) {
                return await this._processWebsocketUploadRequest(
                    request,
                    requestId
                );
            } else if (type === WebsocketEventTypes.DownloadRequest) {
                const [url, method, headers] = rest;
                return await this._processWebsocketDownload(
                    request,
                    requestId,
                    url,
                    method,
                    headers
                );
            } else {
                // not supported
                return;
            }
        }
    }

    private async _sendWebsocketZodError(
        connectionId: string,
        requestId: number | null,
        error: ZodError<any>
    ) {
        await this._websocketController.sendError(connectionId, requestId, {
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage:
                'The request was invalid. One or more fields were invalid.',
            issues: error.issues,
        });
    }

    @traced('RecordsServer')
    private async _processWebsocketMessage(
        request: GenericWebsocketRequest,
        requestId: number,
        message: WebsocketRequestMessage
    ) {
        const span = trace.getActiveSpan();
        const messageResult = websocketRequestMessageSchema.safeParse(message);

        if (messageResult.success === false) {
            span?.setAttribute('request.messageType', 'invalid');
            await this._sendWebsocketZodError(
                request.connectionId,
                requestId,
                messageResult.error
            );
            return;
        }
        const data = messageResult.data;
        span?.setAttribute('request.messageType', data.type);

        if (data.type === 'login') {
            await this._websocketController.login(
                request.connectionId,
                requestId,
                data as LoginMessage
            );
        } else if (data.type === 'repo/watch_branch') {
            await this._websocketController.watchBranch(
                request.connectionId,
                data as WatchBranchMessage
            );
        } else if (data.type === 'repo/unwatch_branch') {
            await this._websocketController.unwatchBranch(
                request.connectionId,
                data.recordName,
                data.inst,
                data.branch
            );
        } else if (data.type === 'repo/add_updates') {
            await this._websocketController.addUpdates(
                request.connectionId,
                data as AddUpdatesMessage
            );
        } else if (data.type === 'repo/get_updates') {
            await this._websocketController.getUpdates(
                request.connectionId,
                data.recordName,
                data.inst,
                data.branch
            );
        } else if (data.type === 'repo/send_action') {
            await this._websocketController.sendAction(
                request.connectionId,
                data as SendActionMessage
            );
        } else if (data.type === 'repo/watch_branch_devices') {
            await this._websocketController.watchBranchDevices(
                request.connectionId,
                data.recordName,
                data.inst,
                data.branch
            );
        } else if (data.type === 'repo/unwatch_branch_devices') {
            await this._websocketController.unwatchBranchDevices(
                request.connectionId,
                data.recordName,
                data.inst,
                data.branch
            );
        } else if (data.type === 'repo/connection_count') {
            await this._websocketController.deviceCount(
                request.connectionId,
                data.recordName,
                data.inst,
                data.branch
            );
        } else if (data.type === 'sync/time') {
            await this._websocketController.syncTime(
                request.connectionId,
                data as TimeSyncRequestMessage,
                Date.now()
            );
        } else if (data.type === 'permission/request/missing') {
            await this._websocketController.requestMissingPermission(
                request.connectionId,
                data as RequestMissingPermissionMessage
            );
        } else if (data.type === 'permission/request/missing/response') {
            await this._websocketController.respondToPermissionRequest(
                request.connectionId,
                data as RequestMissingPermissionResponseMessage
            );
        } else if (data.type === 'http_request') {
            let headers: GenericHttpHeaders = {};

            for (let key in data.request.headers) {
                headers[key.toLowerCase()] = data.request.headers[key];
            }
            headers.origin = request.origin;

            const httpRequest: GenericHttpRequest = {
                path: data.request.path,
                method: data.request.method,
                pathParams: data.request.pathParams,
                body: data.request.body,
                query: data.request.query,
                headers: headers,
                ipAddress: request.ipAddress,
            };

            const result = await this.handleHttpRequest(httpRequest);
            if (
                typeof result.body === 'object' &&
                Symbol.asyncIterator in result.body
            ) {
                let response: Partial<GenericHttpResponse> = result;
                let index = 0;
                const i = result.body[Symbol.asyncIterator]();
                while (true) {
                    let { value, done } = await i.next();
                    await this._websocketController.messenger.sendMessage(
                        [request.connectionId],
                        {
                            type: 'http_partial_response',
                            id: data.id,
                            index: index,
                            final: done ? true : undefined,
                            response: {
                                ...response,
                                body: value,
                            },
                        }
                    );
                    response = {};
                    index += 1;

                    if (done) {
                        break;
                    }
                }
            } else {
                await this._websocketController.messenger.sendMessage(
                    [request.connectionId],
                    {
                        type: 'http_response',
                        id: data.id,
                        response: result,
                    }
                );
            }
        }
    }

    @traced('RecordsServer')
    private async _processWebsocketDownload(
        request: GenericWebsocketRequest,
        requestId: number,
        url: string,
        method: string,
        headers: GenericHttpHeaders
    ) {
        const connectionId = request.connectionId;
        const result = await this._websocketController.downloadRequest(
            connectionId,
            requestId,
            url,
            method,
            headers
        );

        if (result.success === false) {
            await this._websocketController.sendError(
                connectionId,
                requestId,
                result
            );
            return;
        }

        const parseResult = tryParseJson(result.message);

        if (!parseResult.success) {
            await this._websocketController.sendError(connectionId, requestId, {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'The request was invalid. The downloaded file must contain JSON.',
            });
            return;
        }

        await this._processWebsocketMessage(
            request,
            requestId,
            parseResult.value
        );
    }

    @traced('RecordsServer')
    private async _processWebsocketUploadRequest(
        request: GenericWebsocketRequest,
        requestId: number
    ) {
        const connectionId = request.connectionId;
        await this._websocketController.uploadRequest(connectionId, requestId);
    }

    // private _setupRoutes() {
    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/stripeWebhook',
    //         allowedOrigins: true,
    //         handler: (request) => this._stripeWebhook(request),
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/email/valid',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             email: z.string(),
    //         }),
    //         handler: async (request, { email }) => {
    //             const result = await this._auth.isValidEmailAddress(email);
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/displayName/valid',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             displayName: z.string(),
    //             name: NAME_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { displayName, name }) => {
    //             const result = await this._auth.isValidDisplayName(
    //                 displayName,
    //                 name
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/sessions',
    //         allowedOrigins: 'account',
    //         handler: async (request) => this._getSessions(request),
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/replaceSession',
    //         allowedOrigins: 'account',
    //         handler: (request) => this._postReplaceSession(request),
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/revokeAllSessions',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             userId: z.string(),
    //         }),
    //         handler: async (request, { userId }) => {
    //             const authorization = getSessionKey(request);

    //             if (!authorization) {
    //                 return returnResult(NOT_LOGGED_IN_RESULT);
    //             }

    //             const result = await this._auth.revokeAllSessions({
    //                 userId: userId,
    //                 sessionKey: authorization,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/revokeSession',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             userId: z.string().optional(),
    //             sessionId: z.string().optional(),
    //             sessionKey: z.string().optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { userId, sessionId, sessionKey: sessionKeyToRevoke }
    //         ) => {
    //             // Parse the User ID and Session ID from the sessionKey that is provided in
    //             // session key that should be revoked
    //             if (!!sessionKeyToRevoke) {
    //                 const parsed = parseSessionKey(sessionKeyToRevoke);
    //                 if (parsed) {
    //                     userId = parsed[0];
    //                     sessionId = parsed[1];
    //                 }
    //             }

    //             const authorization = getSessionKey(request);

    //             if (!authorization) {
    //                 return returnResult(NOT_LOGGED_IN_RESULT);
    //             }

    //             const result = await this._auth.revokeSession({
    //                 userId,
    //                 sessionId,
    //                 sessionKey: authorization,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/completeLogin',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             userId: z.string(),
    //             requestId: z.string(),
    //             code: z.string(),
    //         }),
    //         handler: async (request, { userId, requestId, code }) => {
    //             const result = await this._auth.completeLogin({
    //                 userId,
    //                 requestId,
    //                 code,
    //                 ipAddress: request.ipAddress,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/login',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             address: z.string(),
    //             addressType: z.enum(['email', 'phone']),
    //         }),
    //         handler: async (request, { address, addressType }) => {
    //             const result = await this._auth.requestLogin({
    //                 address,
    //                 addressType,
    //                 ipAddress: request.ipAddress,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/login/privo',
    //         allowedOrigins: 'account',
    //         schema: z.object({}),
    //         handler: async (request) => {
    //             const result = await this._auth.requestOpenIDLogin({
    //                 provider: PRIVO_OPEN_ID_PROVIDER,
    //                 ipAddress: request.ipAddress,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/oauth/code',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             code: z.string().nonempty(),
    //             state: z.string().nonempty(),
    //         }),
    //         handler: async (request, { code, state }) => {
    //             const result = await this._auth.processOpenIDAuthorizationCode({
    //                 ipAddress: request.ipAddress,
    //                 authorizationCode: code,
    //                 state,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/oauth/complete',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             requestId: z.string().nonempty(),
    //         }),
    //         handler: async (request, { requestId }) => {
    //             const result = await this._auth.completeOpenIDLogin({
    //                 ipAddress: request.ipAddress,
    //                 requestId,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/register/privo',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             email: z.string().min(1).email().optional(),
    //             parentEmail: z.string().min(1).email().optional(),
    //             name: NAME_VALIDATION,
    //             dateOfBirth: z.coerce.date(),
    //             displayName: DISPLAY_NAME_VALIDATION,
    //         }),
    //         handler: async (
    //             request,
    //             { email, parentEmail, name, dateOfBirth, displayName }
    //         ) => {
    //             const result = await this._auth.requestPrivoSignUp({
    //                 email,
    //                 parentEmail,
    //                 name,
    //                 dateOfBirth,
    //                 displayName,
    //                 ipAddress: request.ipAddress,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/webauthn/register/options',
    //         allowedOrigins: true,
    //         handler: async (request) => {
    //             // We don't validate origin because the AuthController will validate it based on the allowed
    //             // relying parties.

    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             const result = await this._auth.requestWebAuthnRegistration({
    //                 userId: validation.userId,
    //                 originOrHost:
    //                     request.headers.origin ??
    //                     request.headers['x-dev-proxy-host'] ??
    //                     request.headers.host,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/webauthn/register',
    //         allowedOrigins: true,
    //         schema: z.object({
    //             response: z.object({
    //                 id: z.string().nonempty(),
    //                 rawId: z.string().nonempty(),
    //                 response: z.object({
    //                     clientDataJSON: z.string().nonempty(),
    //                     attestationObject: z.string().nonempty(),
    //                     authenticatorData: z.string().nonempty().optional(),
    //                     transports: z
    //                         .array(z.string().min(1).max(64))
    //                         .optional(),
    //                     publicKeyAlgorithm: z.number().optional(),
    //                     publicKey: z.string().nonempty().optional(),
    //                 }),
    //                 authenticatorAttachment: z
    //                     .enum(['cross-platform', 'platform'])
    //                     .optional(),
    //                 clientExtensionResults: z.object({
    //                     appid: z.boolean().optional(),
    //                     credProps: z
    //                         .object({
    //                             rk: z.boolean().optional(),
    //                         })
    //                         .optional(),
    //                     hmacCreateSecret: z.boolean().optional(),
    //                 }),
    //                 type: z.literal('public-key'),
    //             }),
    //         }),
    //         handler: async (request, { response }) => {
    //             // We don't validate origin because the AuthController will validate it based on the allowed
    //             // relying parties.
    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             const result = await this._auth.completeWebAuthnRegistration({
    //                 userId: validation.userId,
    //                 response: response as any,
    //                 originOrHost:
    //                     request.headers.origin ??
    //                     request.headers['x-dev-proxy-host'] ??
    //                     request.headers.host,
    //                 userAgent: request.headers['user-agent'],
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/webauthn/login/options',
    //         allowedOrigins: true,
    //         handler: async (request) => {
    //             // We don't validate origin because the AuthController will validate it based on the allowed
    //             // relying parties.

    //             const result = await this._auth.requestWebAuthnLogin({
    //                 ipAddress: request.ipAddress,
    //                 originOrHost:
    //                     request.headers.origin ??
    //                     request.headers['x-dev-proxy-host'] ??
    //                     request.headers.host,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/webauthn/login',
    //         allowedOrigins: true,
    //         schema: z.object({
    //             requestId: z.string().nonempty(),
    //             response: z.object({
    //                 id: z.string().nonempty(),
    //                 rawId: z.string().nonempty(),
    //                 response: z.object({
    //                     clientDataJSON: z.string().nonempty(),
    //                     authenticatorData: z.string().nonempty(),
    //                     signature: z.string().nonempty(),
    //                     userHandle: z.string().nonempty().optional(),
    //                 }),
    //                 authenticatorAttachment: z
    //                     .enum(['cross-platform', 'platform'])
    //                     .optional(),
    //                 clientExtensionResults: z.object({
    //                     appid: z.boolean().optional(),
    //                     credProps: z
    //                         .object({
    //                             rk: z.boolean().optional(),
    //                         })
    //                         .optional(),
    //                     hmacCreateSecret: z.boolean().optional(),
    //                 }),
    //                 type: z.literal('public-key'),
    //             }),
    //         }),
    //         handler: async (request, { response, requestId }) => {
    //             // We don't validate origin because the AuthController will validate it based on the allowed
    //             // relying parties.

    //             const result = await this._auth.completeWebAuthnLogin({
    //                 requestId: requestId,
    //                 ipAddress: request.ipAddress,
    //                 response: response as any,
    //                 originOrHost:
    //                     request.headers.origin ??
    //                     request.headers['x-dev-proxy-host'] ??
    //                     request.headers.host,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/webauthn/authenticators',
    //         allowedOrigins: 'account',
    //         handler: async (request) => {
    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             const result = await this._auth.listUserAuthenticators(
    //                 validation.userId
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/webauthn/authenticators/delete',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             authenticatorId: z.string().nonempty(),
    //         }),
    //         handler: async (request, { authenticatorId }) => {
    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             const result = await this._auth.deleteUserAuthenticator(
    //                 validation.userId,
    //                 authenticatorId
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/meet/token',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             roomName: z.string(),
    //             userName: z.string(),
    //         }),
    //         handler: async (request, { roomName, userName }) => {
    //             const result = await this._livekit.issueToken(
    //                 roomName,
    //                 userName
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             ownerId: z
    //                 .string({
    //                     invalid_type_error: 'ownerId must be a string.',
    //                     required_error: 'ownerId is required.',
    //                 })
    //                 .nonempty('ownerId must not be empty.')
    //                 .optional(),
    //             studioId: z
    //                 .string({
    //                     invalid_type_error: 'studioId must be a string.',
    //                     required_error: 'studioId is required.',
    //                 })
    //                 .nonempty('studioId must not be empty.')
    //                 .optional(),
    //         }),
    //         handler: async (request, { recordName, ownerId, studioId }) => {
    //             if (!recordName || typeof recordName !== 'string') {
    //                 return returnResult({
    //                     success: false,
    //                     errorCode: 'unacceptable_request',
    //                     errorMessage:
    //                         'recordName is required and must be a string.',
    //                 });
    //             }

    //             const validation = await this._validateHttpSessionKey(request);
    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             const result = await this._records.createRecord({
    //                 recordName,
    //                 ownerId,
    //                 studioId,
    //                 userId: validation.userId,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/events/count',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordKey: RECORD_KEY_VALIDATION,
    //             eventName: EVENT_NAME_VALIDATION,
    //             count: z.number({
    //                 invalid_type_error: 'count must be a number.',
    //                 required_error: 'count is required.',
    //             }),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordKey, eventName, count, instances }
    //         ) => {
    //             const validation = await this._validateHttpSessionKey(request);

    //             if (
    //                 validation.success === false &&
    //                 validation.errorCode !== 'no_session_key'
    //             ) {
    //                 return returnResult(validation);
    //             }

    //             const userId = validation.userId;

    //             const result = await this._events.addCount(
    //                 recordKey,
    //                 eventName,
    //                 count,
    //                 userId,
    //                 instances
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/events/count',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             eventName: z
    //                 .string({
    //                     required_error: 'eventName is required.',
    //                     invalid_type_error: 'eventName must be a string.',
    //                 })
    //                 .nonempty('eventName must not be empty'),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { recordName, eventName, instances }) => {
    //             const validation = await this._validateHttpSessionKey(request);

    //             if (
    //                 validation.success === false &&
    //                 validation.errorCode !== 'no_session_key'
    //             ) {
    //                 return returnResult(validation);
    //             }

    //             const userId = validation.userId;
    //             const result = await this._events.getCount(
    //                 recordName,
    //                 eventName,
    //                 userId,
    //                 instances
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/events/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             eventName: z
    //                 .string({
    //                     invalid_type_error: 'eventName must be a string.',
    //                     required_error: 'eventName is required.',
    //                 })
    //                 .nonempty('eventName must be non-empty.')
    //                 .optional(),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { recordName, eventName, instances }) => {
    //             const validation = await this._validateHttpSessionKey(request);
    //             if (
    //                 validation.success === false &&
    //                 validation.errorCode !== 'no_session_key'
    //             ) {
    //                 return returnResult(validation);
    //             }
    //             const userId = validation.userId;

    //             const result = await this._events.listEvents(
    //                 recordName,
    //                 eventName,
    //                 userId,
    //                 instances
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/events',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordKey: RECORD_KEY_VALIDATION,
    //             eventName: EVENT_NAME_VALIDATION,
    //             count: z.number().optional(),
    //             markers: MARKERS_VALIDATION.optional(),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordKey, eventName, count, markers, instances }
    //         ) => {
    //             const validation = await this._validateHttpSessionKey(request);

    //             if (
    //                 validation.success === false &&
    //                 validation.errorCode !== 'no_session_key'
    //             ) {
    //                 return returnResult(validation);
    //             }

    //             const userId = validation.userId;

    //             const result = await this._events.updateEvent({
    //                 recordKeyOrRecordName: recordKey,
    //                 userId,
    //                 eventName,
    //                 count,
    //                 markers,
    //                 instances,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'DELETE',
    //         path: '/api/v2/records/manual/data',
    //         allowedOrigins: 'api',
    //         schema: ERASE_DATA_SCHEMA,
    //         handler: (request, data) =>
    //             this._baseEraseRecordData(request, this._manualData, data),
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/manual/data',
    //         allowedOrigins: true,
    //         schema: GET_DATA_SCHEMA,
    //         handler: (request, data) =>
    //             this._baseGetRecordData(request, this._manualData, data),
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/manual/data',
    //         allowedOrigins: 'api',
    //         schema: RECORD_DATA_SCHEMA,
    //         handler: (request, data) =>
    //             this._baseRecordData(request, this._manualData, data),
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/file',
    //         allowedOrigins: 'api',
    //         schema: READ_FILE_SCHEMA,
    //         handler: (request, data) => this._readFile(request, data),
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/file/list',
    //         allowedOrigins: 'api',
    //         schema: LIST_FILES_SCHEMA,
    //         handler: (request, data) => this._listFiles(request, data),
    //     });

    //     this.addRoute({
    //         method: 'DELETE',
    //         path: '/api/v2/records/file',
    //         allowedOrigins: 'api',
    //         schema: ERASE_FILE_SCHEMA,
    //         handler: (request, data) => this._eraseFile(request, data),
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/file',
    //         allowedOrigins: 'api',
    //         schema: RECORD_FILE_SCHEMA,
    //         handler: (request, data) => this._recordFile(request, data),
    //     });

    //     this.addRoute({
    //         method: 'PUT',
    //         path: '/api/v2/records/file',
    //         allowedOrigins: 'api',
    //         schema: UPDATE_FILE_SCHEMA,
    //         handler: (request, data) => this._updateFile(request, data),
    //     });

    //     this.addRoute({
    //         method: 'DELETE',
    //         path: '/api/v2/records/data',
    //         allowedOrigins: 'api',
    //         schema: ERASE_DATA_SCHEMA,
    //         handler: (request, data) =>
    //             this._baseEraseRecordData(request, this._data, data),
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/data',
    //         allowedOrigins: true,
    //         schema: GET_DATA_SCHEMA,
    //         handler: (request, data) =>
    //             this._baseGetRecordData(request, this._data, data),
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/data/list',
    //         allowedOrigins: true,
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             address: ADDRESS_VALIDATION.nullable().optional(),
    //             marker: MARKER_VALIDATION.optional(),
    //             sort: z
    //                 .union([z.literal('ascending'), z.literal('descending')])
    //                 .optional(),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordName, address, instances, marker, sort }
    //         ) => {
    //             if (!recordName || typeof recordName !== 'string') {
    //                 return returnResult({
    //                     success: false,
    //                     errorCode: 'unacceptable_request',
    //                     errorMessage:
    //                         'recordName is required and must be a string.',
    //                 });
    //             }
    //             if (
    //                 address !== null &&
    //                 typeof address !== 'undefined' &&
    //                 typeof address !== 'string'
    //             ) {
    //                 return returnResult({
    //                     success: false,
    //                     errorCode: 'unacceptable_request',
    //                     errorMessage: 'address must be null or a string.',
    //                 });
    //             }

    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (
    //                 sessionKeyValidation.success === false &&
    //                 sessionKeyValidation.errorCode !== 'no_session_key'
    //             ) {
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             if (!marker) {
    //                 const result = await this._data.listData(
    //                     recordName,
    //                     address || null,
    //                     sessionKeyValidation.userId,
    //                     instances
    //                 );
    //                 return returnResult(result);
    //             } else {
    //                 const result = await this._data.listDataByMarker({
    //                     recordKeyOrName: recordName,
    //                     marker: marker,
    //                     startingAddress: address,
    //                     sort: sort,
    //                     userId: sessionKeyValidation.userId,
    //                     instances,
    //                 });

    //                 return returnResult(result);
    //             }
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/data',
    //         allowedOrigins: 'api',
    //         schema: RECORD_DATA_SCHEMA,
    //         handler: (request, data) =>
    //             this._baseRecordData(request, this._data, data),
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             studioId: z.string().nonempty().optional(),
    //         }),
    //         handler: async (request, { studioId }) => {
    //             const validation = await this._validateHttpSessionKey(request);
    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             if (studioId) {
    //                 const result = await this._records.listStudioRecords(
    //                     studioId,
    //                     validation.userId
    //                 );
    //                 return returnResult(result);
    //             } else {
    //                 const result = await this._records.listRecords(
    //                     validation.userId
    //                 );
    //                 return returnResult(result);
    //             }
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/key',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             policy: z.string({
    //                 invalid_type_error: 'policy must be a string.',
    //                 required_error: 'policy is required.',
    //             }),
    //         }),
    //         handler: async (request, { recordName, policy }) => {
    //             if (!recordName || typeof recordName !== 'string') {
    //                 return returnResult({
    //                     success: false,
    //                     errorCode: 'unacceptable_request',
    //                     errorMessage:
    //                         'recordName is required and must be a string.',
    //                 });
    //             }

    //             const validation = await this._validateHttpSessionKey(request);
    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(validation);
    //             }

    //             const result = await this._records.createPublicRecordKey(
    //                 recordName,
    //                 policy as PublicRecordKeyPolicy,
    //                 validation.userId
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/permissions',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             permission: AVAILABLE_PERMISSIONS_VALIDATION,
    //             instances: INSTANCES_ARRAY_VALIDATION.nonempty().optional(),
    //         }),
    //         handler: async (request, { recordName, permission, instances }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             if (permission.marker) {
    //                 const result =
    //                     await this._policyController.grantMarkerPermission({
    //                         recordKeyOrRecordName: recordName,
    //                         marker: permission.marker,
    //                         userId: sessionKeyValidation.userId,
    //                         permission: permission as any,
    //                         instances,
    //                     });

    //                 return returnResult(result);
    //             } else if (permission.resourceKind && permission.resourceId) {
    //                 const result =
    //                     await this._policyController.grantResourcePermission({
    //                         recordKeyOrRecordName: recordName,
    //                         permission: permission as any,
    //                         userId: sessionKeyValidation.userId,
    //                         instances,
    //                     });

    //                 return returnResult(result);
    //             }

    //             return returnResult({
    //                 success: false,
    //                 errorCode: 'unacceptable_request',
    //                 errorMessage:
    //                     'The given permission must have either a marker or a resourceId.',
    //             });
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/permissions/revoke',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             permissionId: z
    //                 .string({
    //                     invalid_type_error: 'permissionId must be a string.',
    //                     required_error: 'permissionId is required.',
    //                 })
    //                 .nonempty('permissionId must not be empty'),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { permissionId, instances }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._policyController.revokePermission({
    //                 permissionId,
    //                 userId: sessionKeyValidation.userId,
    //                 instances,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/permissions/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             marker: MARKER_VALIDATION.optional(),
    //             resourceKind: RESOURCE_KIND_VALIDATION.optional(),
    //             resourceId: z
    //                 .string({
    //                     invalid_type_error: 'resourceId must be a string.',
    //                     required_error: 'resourceId is required.',
    //                 })
    //                 .optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordName, marker, resourceKind, resourceId }
    //         ) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             if (resourceKind && resourceId) {
    //                 const result =
    //                     await this._policyController.listPermissionsForResource(
    //                         recordName,
    //                         resourceKind,
    //                         resourceId,
    //                         sessionKeyValidation.userId
    //                     );
    //                 return returnResult(result);
    //             } else if (marker) {
    //                 const result =
    //                     await this._policyController.listPermissionsForMarker(
    //                         recordName,
    //                         marker,
    //                         sessionKeyValidation.userId
    //                     );
    //                 return returnResult(result);
    //             } else {
    //                 const result = await this._policyController.listPermissions(
    //                     recordName,
    //                     sessionKeyValidation.userId
    //                 );
    //                 return returnResult(result);
    //             }
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/role/user/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             userId: z
    //                 .string({
    //                     invalid_type_error: 'userId must be a string.',
    //                     required_error: 'userId is required.',
    //                 })
    //                 .nonempty('userId must not be empty'),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { recordName, userId, instances }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._policyController.listUserRoles(
    //                 recordName,
    //                 sessionKeyValidation.userId,
    //                 userId,
    //                 instances
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/role/inst/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             inst: z
    //                 .string({
    //                     invalid_type_error: 'inst must be a string.',
    //                     required_error: 'inst is required.',
    //                 })
    //                 .nonempty('inst must not be empty'),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { recordName, inst, instances }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._policyController.listInstRoles(
    //                 recordName,
    //                 sessionKeyValidation.userId,
    //                 inst,
    //                 instances
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/role/assignments/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             startingRole: z
    //                 .string({
    //                     invalid_type_error: 'startingRole must be a string.',
    //                     required_error: 'startingRole is required.',
    //                 })
    //                 .nonempty('startingRole must not be empty')
    //                 .optional(),
    //             role: z
    //                 .string({
    //                     invalid_type_error: 'role must be a string.',
    //                     required_error: 'role is required.',
    //                 })
    //                 .nonempty('role must not be empty')
    //                 .optional(),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordName, role, startingRole, instances }
    //         ) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             if (role) {
    //                 const result =
    //                     await this._policyController.listAssignedRoles(
    //                         recordName,
    //                         sessionKeyValidation.userId,
    //                         role,
    //                         instances
    //                     );

    //                 return returnResult(result);
    //             } else {
    //                 const result =
    //                     await this._policyController.listRoleAssignments(
    //                         recordName,
    //                         sessionKeyValidation.userId,
    //                         startingRole,
    //                         instances
    //                     );

    //                 return returnResult(result);
    //             }
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/role/grant',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             userId: z
    //                 .string({
    //                     invalid_type_error: 'userId must be a string.',
    //                     required_error: 'userId is required.',
    //                 })
    //                 .nonempty('userId must not be empty')
    //                 .optional(),
    //             inst: z
    //                 .string({
    //                     invalid_type_error: 'inst must be a string.',
    //                     required_error: 'inst is required.',
    //                 })
    //                 .nonempty('inst must not be empty')
    //                 .optional(),
    //             role: z
    //                 .string({
    //                     invalid_type_error: 'role must be a string.',
    //                     required_error: 'role is required.',
    //                 })
    //                 .nonempty('role must not be empty'),
    //             expireTimeMs: z
    //                 .number({
    //                     invalid_type_error: 'expireTimeMs must be a number.',
    //                     required_error: 'expireTimeMs is required.',
    //                 })
    //                 .positive('expireTimeMs must be positive')
    //                 .optional(),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordName, userId, inst, expireTimeMs, role, instances }
    //         ) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._policyController.grantRole(
    //                 recordName,
    //                 sessionKeyValidation.userId,
    //                 {
    //                     instance: inst,
    //                     userId: userId,
    //                     role,
    //                     expireTimeMs,
    //                 },
    //                 instances
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/role/revoke',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION,
    //             userId: z
    //                 .string({
    //                     invalid_type_error: 'userId must be a string.',
    //                     required_error: 'userId is required.',
    //                 })
    //                 .nonempty('userId must not be empty')
    //                 .optional(),
    //             inst: z
    //                 .string({
    //                     invalid_type_error: 'inst must be a string.',
    //                     required_error: 'inst is required.',
    //                 })
    //                 .nonempty('inst must not be empty')
    //                 .optional(),
    //             role: z
    //                 .string({
    //                     invalid_type_error: 'role must be a string.',
    //                     required_error: 'role is required.',
    //                 })
    //                 .nonempty('role must not be empty'),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { recordName, userId, inst, role, instances }
    //         ) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._policyController.revokeRole(
    //                 recordName,
    //                 sessionKeyValidation.userId,
    //                 {
    //                     instance: inst,
    //                     userId: userId,
    //                     role,
    //                 },
    //                 instances
    //             );

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/ai/chat',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             model: z.string().nonempty().optional(),
    //             messages: z.array(AI_CHAT_MESSAGE_SCHEMA).nonempty(),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //             temperature: z.number().min(0).max(2).optional(),
    //             topP: z.number().optional(),
    //             presencePenalty: z.number().min(-2).max(2).optional(),
    //             frequencyPenalty: z.number().min(-2).max(2).optional(),
    //             stopWords: z.array(z.string()).max(4).optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { model, messages, instances, ...options }
    //         ) => {
    //             if (!this._aiController) {
    //                 return returnResult(AI_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._aiController.chat({
    //                 ...options,
    //                 model,
    //                 messages: messages as AIChatMessage[],
    //                 userId: sessionKeyValidation.userId,
    //                 userSubscriptionTier: sessionKeyValidation.subscriptionTier,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/ai/skybox',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             prompt: z.string().nonempty().max(600),
    //             negativePrompt: z.string().nonempty().max(600).optional(),
    //             blockadeLabs: z
    //                 .object({
    //                     skyboxStyleId: z.number().optional(),
    //                     remixImagineId: z.number().optional(),
    //                     seed: z.number().optional(),
    //                 })
    //                 .optional(),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { prompt, negativePrompt, instances, blockadeLabs }
    //         ) => {
    //             if (!this._aiController) {
    //                 return returnResult(AI_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._aiController.generateSkybox({
    //                 prompt,
    //                 negativePrompt,
    //                 blockadeLabs,
    //                 userId: sessionKeyValidation.userId,
    //                 userSubscriptionTier: sessionKeyValidation.subscriptionTier,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/ai/skybox',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             skyboxId: z
    //                 .string({
    //                     invalid_type_error: 'skyboxId must be a string.',
    //                     required_error: 'skyboxId is required.',
    //                 })
    //                 .nonempty('skyboxId must not be empty'),
    //             instances: INSTANCES_QUERY_VALIDATION.optional(),
    //         }),
    //         handler: async (request, { skyboxId, instances }) => {
    //             if (!this._aiController) {
    //                 return returnResult(AI_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._aiController.getSkybox({
    //                 skyboxId,
    //                 userId: sessionKeyValidation.userId,
    //                 userSubscriptionTier: sessionKeyValidation.subscriptionTier,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/ai/image',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             prompt: z
    //                 .string({
    //                     invalid_type_error: 'prompt must be a string.',
    //                     required_error: 'prompt is required.',
    //                 })
    //                 .nonempty('prompt must not be empty'),
    //             model: z
    //                 .string({
    //                     invalid_type_error: 'model must be a string.',
    //                     required_error: 'model is required.',
    //                 })
    //                 .nonempty('model must not be empty')
    //                 .optional(),
    //             negativePrompt: z.string().nonempty().optional(),
    //             width: z.number().positive().int().optional(),
    //             height: z.number().positive().int().optional(),
    //             seed: z.number().positive().int().optional(),
    //             numberOfImages: z.number().positive().int().optional(),
    //             steps: z.number().positive().int().optional(),
    //             sampler: z.string().nonempty().optional(),
    //             cfgScale: z.number().min(0).int().optional(),
    //             clipGuidancePreset: z.string().nonempty().optional(),
    //             stylePreset: z.string().nonempty().optional(),
    //             instances: INSTANCES_ARRAY_VALIDATION.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             {
    //                 prompt,
    //                 model,
    //                 negativePrompt,
    //                 width,
    //                 height,
    //                 seed,
    //                 numberOfImages,
    //                 steps,
    //                 sampler,
    //                 cfgScale,
    //                 clipGuidancePreset,
    //                 stylePreset,
    //                 instances,
    //             }
    //         ) => {
    //             if (!this._aiController) {
    //                 return returnResult(AI_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._aiController.generateImage({
    //                 model,
    //                 prompt,
    //                 negativePrompt,
    //                 width,
    //                 height,
    //                 seed,
    //                 numberOfImages,
    //                 steps,
    //                 sampler,
    //                 cfgScale,
    //                 clipGuidancePreset,
    //                 stylePreset,
    //                 userId: sessionKeyValidation.userId,
    //                 userSubscriptionTier: sessionKeyValidation.subscriptionTier,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/studios',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             studioId: STUDIO_ID_VALIDATION,
    //         }),
    //         handler: async (request, { studioId }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._records.getStudio(
    //                 studioId,
    //                 sessionKeyValidation.userId
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/studios',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             displayName: STUDIO_DISPLAY_NAME_VALIDATION,
    //             ownerStudioComId: z
    //                 .string({
    //                     invalid_type_error:
    //                         'ownerStudioComId must be a string.',
    //                     required_error: 'ownerStudioComId is required.',
    //                 })
    //                 .nonempty('ownerStudioComId must not be empty')
    //                 .nullable()
    //                 .optional(),
    //         }),
    //         handler: async (request, { displayName, ownerStudioComId }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             if (!ownerStudioComId) {
    //                 const result = await this._records.createStudio(
    //                     displayName,
    //                     sessionKeyValidation.userId
    //                 );
    //                 return returnResult(result);
    //             } else {
    //                 const result = await this._records.createStudioInComId(
    //                     displayName,
    //                     sessionKeyValidation.userId,
    //                     ownerStudioComId
    //                 );
    //                 return returnResult(result);
    //             }
    //         },
    //     });

    //     this.addRoute({
    //         method: 'PUT',
    //         path: '/api/v2/studios',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             id: STUDIO_ID_VALIDATION,
    //             displayName: STUDIO_DISPLAY_NAME_VALIDATION.optional(),
    //             logoUrl: z
    //                 .string({
    //                     invalid_type_error: 'logoUrl must be a string.',
    //                     required_error: 'logoUrl is required.',
    //                 })
    //                 .url()
    //                 .min(1)
    //                 .max(512)
    //                 .nullable()
    //                 .optional(),
    //             comIdConfig: COM_ID_CONFIG_SCHEMA.optional(),
    //             playerConfig: COM_ID_PLAYER_CONFIG.optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { id, displayName, logoUrl, comIdConfig, playerConfig }
    //         ) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._records.updateStudio({
    //                 userId: sessionKeyValidation.userId,
    //                 studio: {
    //                     id,
    //                     displayName,
    //                     logoUrl,
    //                     comIdConfig,
    //                     playerConfig,
    //                 },
    //             });
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/studios/requestComId',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             studioId: STUDIO_ID_VALIDATION,
    //             comId: COM_ID_VALIDATION,
    //         }),
    //         handler: async (request, { studioId, comId }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._records.requestComId({
    //                 studioId,
    //                 userId: sessionKeyValidation.userId,
    //                 requestedComId: comId,
    //                 ipAddress: request.ipAddress,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/studios/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             comId: z.string().nonempty().optional(),
    //         }),
    //         handler: async (request, { comId }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             if (comId) {
    //                 const result = await this._records.listStudiosByComId(
    //                     sessionKeyValidation.userId,
    //                     comId
    //                 );
    //                 return returnResult(result);
    //             } else {
    //                 const result = await this._records.listStudios(
    //                     sessionKeyValidation.userId
    //                 );
    //                 return returnResult(result);
    //             }
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/studios/members/list',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             studioId: STUDIO_ID_VALIDATION,
    //         }),
    //         handler: async (request, { studioId }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._records.listStudioMembers(
    //                 studioId,
    //                 sessionKeyValidation.userId
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/studios/members',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             studioId: STUDIO_ID_VALIDATION,
    //             addedUserId: z
    //                 .string({
    //                     invalid_type_error: 'addedUserId must be a string.',
    //                     required_error: 'addedUserId is required.',
    //                 })
    //                 .nonempty('addedUserId must not be empty')
    //                 .optional(),
    //             addedEmail: z
    //                 .string({
    //                     invalid_type_error: 'addedEmail must be a string.',
    //                     required_error: 'addedEmail is required.',
    //                 })
    //                 .nonempty('addedEmail must not be empty')
    //                 .optional(),
    //             addedPhoneNumber: z
    //                 .string({
    //                     invalid_type_error:
    //                         'addedPhoneNumber must be a string.',
    //                     required_error: 'addedPhoneNumber is required.',
    //                 })
    //                 .nonempty('addedPhoneNumber must not be empty')
    //                 .optional(),
    //             role: z.union([z.literal('admin'), z.literal('member')]),
    //         }),
    //         handler: async (
    //             request,
    //             { studioId, addedUserId, addedEmail, addedPhoneNumber, role }
    //         ) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._records.addStudioMember({
    //                 studioId,
    //                 userId: sessionKeyValidation.userId,
    //                 role,
    //                 addedUserId,
    //                 addedEmail,
    //                 addedPhoneNumber,
    //             });
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'DELETE',
    //         path: '/api/v2/studios/members',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             studioId: STUDIO_ID_VALIDATION,
    //             removedUserId: z
    //                 .string({
    //                     invalid_type_error: 'removedUserId must be a string.',
    //                     required_error: 'removedUserId is required.',
    //                 })
    //                 .nonempty('removedUserId must not be empty')
    //                 .optional(),
    //         }),
    //         handler: async (request, { studioId, removedUserId }) => {
    //             const sessionKeyValidation = await this._validateHttpSessionKey(
    //                 request
    //             );
    //             if (sessionKeyValidation.success === false) {
    //                 if (sessionKeyValidation.errorCode === 'no_session_key') {
    //                     return returnResult(NOT_LOGGED_IN_RESULT);
    //                 }
    //                 return returnResult(sessionKeyValidation);
    //             }

    //             const result = await this._records.removeStudioMember({
    //                 studioId,
    //                 userId: sessionKeyValidation.userId,
    //                 removedUserId,
    //             });
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/player/config',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             comId: z.string().nonempty(),
    //         }),
    //         handler: async (request, { comId }) => {
    //             const result = await this._records.getPlayerConfig(comId);
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/subscriptions',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             studioId: z
    //                 .string({
    //                     invalid_type_error: 'studioId must be a string.',
    //                     required_error: 'studioId is required.',
    //                 })
    //                 .nonempty('studioId must be non-empty.')
    //                 .optional(),
    //             userId: z
    //                 .string({
    //                     invalid_type_error: 'userId must be a string.',
    //                     required_error: 'userId is required.',
    //                 })
    //                 .nonempty('userId must be non-empty.')
    //                 .optional(),
    //         }),
    //         handler: async (request, { studioId, userId }) => {
    //             if (!this._subscriptions) {
    //                 return returnResult(SUBSCRIPTIONS_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKey = getSessionKey(request);

    //             if (!sessionKey) {
    //                 return returnResult(NOT_LOGGED_IN_RESULT);
    //             }

    //             const result = await this._subscriptions.getSubscriptionStatus({
    //                 sessionKey,
    //                 userId,
    //                 studioId,
    //             });

    //             if (!result.success) {
    //                 return returnResult(result);
    //             }

    //             return returnResult({
    //                 success: true,
    //                 publishableKey: result.publishableKey,
    //                 subscriptions: result.subscriptions.map((s) => ({
    //                     active: s.active,
    //                     statusCode: s.statusCode,
    //                     productName: s.productName,
    //                     startDate: s.startDate,
    //                     endedDate: s.endedDate,
    //                     cancelDate: s.cancelDate,
    //                     canceledDate: s.canceledDate,
    //                     currentPeriodStart: s.currentPeriodStart,
    //                     currentPeriodEnd: s.currentPeriodEnd,
    //                     renewalInterval: s.renewalInterval,
    //                     intervalLength: s.intervalLength,
    //                     intervalCost: s.intervalCost,
    //                     currency: s.currency,
    //                     featureList: s.featureList,
    //                 })),
    //                 purchasableSubscriptions:
    //                     result.purchasableSubscriptions.map((s) => ({
    //                         id: s.id,
    //                         name: s.name,
    //                         description: s.description,
    //                         featureList: s.featureList,
    //                         prices: s.prices,
    //                         defaultSubscription: s.defaultSubscription,
    //                     })),
    //             });
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/subscriptions/manage',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             userId: z
    //                 .string({
    //                     invalid_type_error: 'userId must be a string.',
    //                     required_error: 'userId is required.',
    //                 })
    //                 .nonempty('userId must not be empty.')
    //                 .optional(),
    //             studioId: z
    //                 .string({
    //                     invalid_type_error: 'studioId must be a string.',
    //                     required_error: 'studioId is required.',
    //                 })
    //                 .nonempty('studioId must not be empty.')
    //                 .optional(),
    //             subscriptionId: z.string().optional(),
    //             expectedPrice: z
    //                 .object({
    //                     currency: z.string(),
    //                     cost: z.number(),
    //                     interval: z.enum(['month', 'year', 'week', 'day']),
    //                     intervalLength: z.number(),
    //                 })
    //                 .optional(),
    //         }),
    //         handler: async (
    //             request,
    //             { userId, studioId, subscriptionId, expectedPrice }
    //         ) => {
    //             if (!this._subscriptions) {
    //                 return returnResult(SUBSCRIPTIONS_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKey = getSessionKey(request);

    //             if (!sessionKey) {
    //                 return returnResult(NOT_LOGGED_IN_RESULT);
    //             }

    //             const result =
    //                 await this._subscriptions.createManageSubscriptionLink({
    //                     sessionKey,
    //                     userId,
    //                     studioId,
    //                     subscriptionId,
    //                     expectedPrice:
    //                         expectedPrice as CreateManageSubscriptionRequest['expectedPrice'],
    //                 });

    //             if (!result.success) {
    //                 return returnResult(result);
    //             }

    //             return returnResult({
    //                 success: true,
    //                 url: result.url,
    //             });
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/api/v2/records/insts/list',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION.optional(),
    //             inst: z.string().optional(),
    //         }),
    //         handler: async (request, { recordName, inst }) => {
    //             if (!this._websocketController) {
    //                 return returnResult(INSTS_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKey = getSessionKey(request);

    //             if (!sessionKey) {
    //                 return returnResult(NOT_LOGGED_IN_RESULT);
    //             }

    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 return returnResult(validation);
    //             }

    //             const userId = validation.userId;

    //             const result = await this._websocketController.listInsts(
    //                 recordName,
    //                 userId,
    //                 inst
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'DELETE',
    //         path: '/api/v2/records/insts',
    //         allowedOrigins: 'account',
    //         schema: z.object({
    //             recordKey: RECORD_KEY_VALIDATION.optional(),
    //             recordName: RECORD_NAME_VALIDATION.optional(),
    //             inst: z.string().optional(),
    //         }),
    //         handler: async (request, { recordKey, recordName, inst }) => {
    //             if (!this._websocketController) {
    //                 return returnResult(INSTS_NOT_SUPPORTED_RESULT);
    //             }

    //             const sessionKey = getSessionKey(request);

    //             if (!sessionKey) {
    //                 return returnResult(NOT_LOGGED_IN_RESULT);
    //             }

    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 return returnResult(validation);
    //             }

    //             const result = await this._websocketController.eraseInst(
    //                 recordKey ?? recordName,
    //                 inst,
    //                 validation.userId
    //             );
    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'POST',
    //         path: '/api/v2/records/insts/report',
    //         allowedOrigins: 'api',
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION.nullable(),
    //             inst: z.string().nonempty(),
    //             automaticReport: z.boolean(),
    //             reportReason: z.union([
    //                 z.literal('poor-performance'),
    //                 z.literal('spam'),
    //                 z.literal('harassment'),
    //                 z.literal('copyright-infringement'),
    //                 z.literal('obscene'),
    //                 z.literal('illegal'),
    //                 z.literal('other'),
    //             ]),
    //             reportReasonText: z.string().nonempty().trim(),
    //             reportedUrl: z.string().url(),
    //             reportedPermalink: z.string().url(),
    //         }),
    //         handler: async (
    //             request,
    //             {
    //                 recordName,
    //                 inst,
    //                 automaticReport,
    //                 reportReason,
    //                 reportReasonText,
    //                 reportedUrl,
    //                 reportedPermalink,
    //             }
    //         ) => {
    //             if (!this._moderationController) {
    //                 return returnResult(MODERATION_NOT_SUPPORTED_RESULT);
    //             }

    //             const validation = await this._validateHttpSessionKey(request);

    //             if (validation.success === false) {
    //                 if (validation.errorCode !== 'no_session_key') {
    //                     return returnResult(validation);
    //                 }
    //             }

    //             const result = await this._moderationController.reportInst({
    //                 recordName,
    //                 inst,
    //                 automaticReport,
    //                 reportReason,
    //                 reportReasonText,
    //                 reportedUrl,
    //                 reportedPermalink,
    //                 reportingIpAddress: request.ipAddress,
    //                 reportingUserId: validation.userId,
    //             });

    //             return returnResult(result);
    //         },
    //     });

    //     this.addRoute({
    //         method: 'GET',
    //         path: '/instData',
    //         allowedOrigins: true,
    //         schema: z.object({
    //             recordName: RECORD_NAME_VALIDATION.nullable().optional(),
    //             inst: z.string().nonempty(),
    //             branch: z.string().nonempty().default(DEFAULT_BRANCH_NAME),
    //         }),
    //         handler: async (request, { recordName, inst, branch }) => {
    //             let userId: string = null;
    //             const validation = await this._validateHttpSessionKey(request);
    //             if (validation.success === false) {
    //                 if (validation.errorCode === 'no_session_key') {
    //                     userId = null;
    //                 } else {
    //                     return returnResult(validation);
    //                 }
    //             } else {
    //                 userId = validation.userId;
    //             }

    //             const data = await this._websocketController.getBranchData(
    //                 userId,
    //                 recordName ?? null,
    //                 inst,
    //                 branch
    //             );

    //             return returnResult({
    //                 success: true,
    //                 ...data,
    //             });
    //         },
    //     });
    // }

    private async _stripeWebhook(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!this._subscriptions) {
            return returnResult(SUBSCRIPTIONS_NOT_SUPPORTED_RESULT);
        }

        let body: string = null;
        if (typeof request.body === 'string') {
            body = request.body;
        } else if (ArrayBuffer.isView(request.body)) {
            try {
                const decoder = new TextDecoder();
                body = decoder.decode(request.body);
            } catch (err) {
                console.log(
                    '[RecordsServer] Unable to decode request body!',
                    err
                );
                return returnResult({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                });
            }
        }

        const signature = request.headers['stripe-signature'];

        const result = await this._subscriptions.handleStripeWebhook({
            requestBody: body,
            signature,
        });

        return returnResult(result);
    }

    private async _handleOptions(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        };
    }

    private async _handleRecordFileOptions(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const headers = this._files.getAllowedUploadHeaders();

        const allAllowedHeaders = new Set([
            ...headers.map((h) => h.toLocaleLowerCase()),
            'content-type',
            'authorization',
        ]);

        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Headers': [...allAllowedHeaders].join(
                    ', '
                ),
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Max-Age': '14400',
            },
        };
    }

    private async _recordFile(
        {
            recordKey,
            fileSha256Hex,
            fileByteLength,
            fileMimeType,
            fileDescription,
            markers,
            instances,
        }: z.infer<typeof RECORD_FILE_SCHEMA>,
        context: RPCContext
    ) {
        if (!recordKey || typeof recordKey !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            } as const;
        }
        if (!fileSha256Hex || typeof fileSha256Hex !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileSha256Hex is required and must be a string.',
            } as const;
        }
        if (!fileByteLength || typeof fileByteLength !== 'number') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'fileByteLength is required and must be a number.',
            } as const;
        }
        if (!fileMimeType || typeof fileMimeType !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileMimeType is required and must be a string.',
            } as const;
        }
        if (!!fileDescription && typeof fileDescription !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileDescription must be a string.',
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }
        const userId = validation.userId;

        const result = await this._files.recordFile(recordKey, userId, {
            fileSha256Hex,
            fileByteLength,
            fileMimeType,
            fileDescription,
            headers: {},
            markers,
            instances,
        });

        return result;
    }

    private async _updateFile(
        data: z.infer<typeof UPDATE_FILE_SCHEMA>,
        context: RPCContext
    ) {
        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }
        const userId = validation.userId;

        const fileNameResult = await this._files.getFileNameFromUrl(
            data.fileUrl
        );

        if (!fileNameResult.success) {
            return fileNameResult;
        }

        const result = await this._files.updateFile(
            data.recordKey,
            fileNameResult.fileName,
            userId,
            data.markers,
            data.instances
        );
        return result;
    }

    private async _readFile(
        {
            fileUrl,
            recordName,
            fileName,
            instances,
        }: z.infer<typeof READ_FILE_SCHEMA>,
        context: RPCContext
    ) {
        if (!!fileUrl && typeof fileUrl !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileUrl must be a string.',
            } as const;
        }
        if (!!recordName && typeof recordName !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName must be a string.',
            } as const;
        }
        if (!!fileName && typeof fileName !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileName must be a string.',
            } as const;
        }

        if (!fileUrl && (!recordName || !fileName)) {
            let message: string;
            if (!!fileName) {
                message = 'recordName is required when fileName is provided.';
            } else if (!!recordName) {
                message = 'fileName is required when recordName is provided.';
            } else {
                message =
                    'fileUrl or both recordName and fileName are required.';
            }
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: message,
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }
        const userId = validation.userId;

        if (!!fileUrl) {
            const fileNameResult = await this._files.getFileNameFromUrl(
                fileUrl
            );

            if (fileNameResult.success === false) {
                return fileNameResult;
            }

            recordName = fileNameResult.recordName;
            fileName = fileNameResult.fileName;
        }

        const result = await this._files.readFile(
            recordName,
            fileName,
            userId,
            instances
        );
        return result;
    }

    private async _listFiles(
        { recordName, fileName, instances }: z.infer<typeof LIST_FILES_SCHEMA>,
        context: RPCContext
    ) {
        if (!!recordName && typeof recordName !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName must be a string.',
            } as const;
        }
        if (!!fileName && typeof fileName !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileName must be a string.',
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }
        const userId = validation.userId;

        const result = await this._files.listFiles(
            recordName,
            fileName,
            userId,
            instances
        );
        return result;
    }

    private async _eraseFile(
        { recordKey, fileUrl, instances }: z.infer<typeof ERASE_FILE_SCHEMA>,
        context: RPCContext
    ) {
        if (!recordKey || typeof recordKey !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            } as const;
        }

        if (!fileUrl || typeof fileUrl !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileUrl is required and must be a string.',
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }
        const userId = validation.userId;

        const fileNameResult = await this._files.getFileNameFromUrl(fileUrl);

        if (!fileNameResult.success) {
            return fileNameResult;
        }

        const result = await this._files.eraseFile(
            recordKey,
            fileNameResult.fileName,
            userId,
            instances
        );
        return result;
    }

    private async _baseRecordData(
        controller: DataRecordsController,
        {
            recordKey,
            address,
            data,
            updatePolicy,
            deletePolicy,
            markers,
            instances,
        }: z.infer<typeof RECORD_DATA_SCHEMA>,
        context: RPCContext
    ) {
        if (!recordKey || typeof recordKey !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            } as const;
        }
        if (!address || typeof address !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address is required and must be a string.',
            } as const;
        }
        if (typeof data === 'undefined') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'data is required.',
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }

        const userId = validation.userId;
        const result = await controller.recordData(
            recordKey,
            address,
            data,
            userId,
            updatePolicy,
            deletePolicy,
            markers,
            instances
        );
        return result;
    }

    private async _baseGetRecordData(
        controller: DataRecordsController,
        { recordName, address, instances }: z.infer<typeof GET_DATA_SCHEMA>,
        context: RPCContext
    ) {
        if (!recordName || typeof recordName !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName is required and must be a string.',
            } as const;
        }
        if (!address || typeof address !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address is required and must be a string.',
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }

        const result = await controller.getData(
            recordName,
            address,
            validation.userId,
            instances
        );
        return result;
    }

    private async _baseEraseRecordData(
        controller: DataRecordsController,
        { recordKey, address, instances }: z.infer<typeof ERASE_DATA_SCHEMA>,
        context: RPCContext
    ) {
        if (!recordKey || typeof recordKey !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            } as const;
        }
        if (!address || typeof address !== 'string') {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address is required and must be a string.',
            } as const;
        }

        const validation = await this._validateSessionKey(context.sessionKey);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return validation;
        }

        const userId = validation.userId;
        const result = await controller.eraseData(
            recordKey,
            address,
            userId,
            instances
        );
        return result;
    }

    private async _postReplaceSession(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const sessionKey = getSessionKey(request);
        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const result = await this._auth.replaceSession({
            sessionKey: sessionKey,
            ipAddress: request.ipAddress,
        });

        return returnResult(result);
    }

    private async _getSubscriptionInfo(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!this._subscriptions) {
            return returnResult(SUBSCRIPTIONS_NOT_SUPPORTED_RESULT);
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const userId = tryDecodeUriComponent(request.pathParams.userId);

        if (!userId) {
            return returnResult(UNACCEPTABLE_USER_ID);
        }

        const result = await this._subscriptions.getSubscriptionStatus({
            sessionKey,
            userId,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            publishableKey: result.publishableKey,
            subscriptions: result.subscriptions.map((s) => ({
                active: s.active,
                statusCode: s.statusCode,
                productName: s.productName,
                startDate: s.startDate,
                endedDate: s.endedDate,
                cancelDate: s.cancelDate,
                canceledDate: s.canceledDate,
                currentPeriodStart: s.currentPeriodStart,
                currentPeriodEnd: s.currentPeriodEnd,
                renewalInterval: s.renewalInterval,
                intervalLength: s.intervalLength,
                intervalCost: s.intervalCost,
                currency: s.currency,
                featureList: s.featureList,
            })),
            purchasableSubscriptions: result.purchasableSubscriptions.map(
                (s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    featureList: s.featureList,
                    prices: s.prices,
                    defaultSubscription: s.defaultSubscription,
                })
            ),
        });
    }

    private async _manageSubscription(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!this._subscriptions) {
            return returnResult(SUBSCRIPTIONS_NOT_SUPPORTED_RESULT);
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const userId = tryDecodeUriComponent(request.pathParams.userId);

        if (!userId) {
            return returnResult(UNACCEPTABLE_USER_ID);
        }

        let subscriptionId: CreateManageSubscriptionRequest['subscriptionId'];
        let expectedPrice: CreateManageSubscriptionRequest['expectedPrice'];

        if (typeof request.body === 'string' && request.body) {
            let body = tryParseJson(request.body);
            if (body.success) {
                const schema = z.object({
                    subscriptionId: z.string().optional(),
                    expectedPrice: z
                        .object({
                            currency: z.string(),
                            cost: z.number(),
                            interval: z.enum(['month', 'year', 'week', 'day']),
                            intervalLength: z.number(),
                        })
                        .optional(),
                });

                const parseResult = schema.safeParse(body.value);

                if (parseResult.success === false) {
                    return returnZodError(parseResult.error);
                }

                if (typeof parseResult.data.subscriptionId === 'string') {
                    subscriptionId = parseResult.data.subscriptionId;
                }
                if (typeof parseResult.data.expectedPrice === 'object') {
                    expectedPrice = parseResult.data
                        .expectedPrice as CreateManageSubscriptionRequest['expectedPrice'];
                }
            }
        }

        const result = await this._subscriptions.createManageSubscriptionLink({
            sessionKey,
            userId,
            subscriptionId,
            expectedPrice,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            url: result.url,
        });
    }

    /**
     * Endpoint to retrieve info about a user.
     * @param request The request.
     */
    private async _getUserInfo(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (request.method !== 'GET') {
            throw new Error(
                `getUserInfo only accept GET method, you tried: ${request.method}`
            );
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const userId = tryDecodeUriComponent(request.pathParams.userId);

        if (!userId) {
            return returnResult(UNACCEPTABLE_USER_ID);
        }

        const result = await this._auth.getUserInfo({
            sessionKey,
            userId,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            name: result.name,
            avatarUrl: result.avatarUrl,
            avatarPortraitUrl: result.avatarPortraitUrl,
            email: result.email,
            phoneNumber: result.phoneNumber,
            hasActiveSubscription: result.hasActiveSubscription,
            subscriptionTier: result.subscriptionTier,
            privacyFeatures: result.privacyFeatures,
            displayName: result.displayName,
            role: result.role,
        });
    }

    private async _putUserInfo(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (request.method !== 'PUT') {
            throw new Error(
                `putUserInfo only accept PUT method, you tried: ${request.method}`
            );
        }

        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const userId = tryDecodeUriComponent(request.pathParams.userId);

        if (!userId) {
            return returnResult(UNACCEPTABLE_USER_ID);
        }

        const schema = z.object({
            name: z.string().min(1).optional().nullable(),
            email: z
                .string()
                .email()
                .max(MAX_EMAIL_ADDRESS_LENGTH)
                .optional()
                .nullable(),
            phoneNumber: z
                .string()
                .max(MAX_SMS_ADDRESS_LENGTH)
                .optional()
                .nullable(),
            avatarUrl: z.string().url().optional().nullable(),
            avatarPortraitUrl: z.string().url().optional().nullable(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const update = parseResult.data;
        const result = await this._auth.updateUserInfo({
            sessionKey: sessionKey,
            userId: userId,
            update,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            userId: result.userId,
        });
    }

    private async _validateSessionKey(
        sessionKey: string | null
    ): Promise<ValidateSessionKeyResult | NoSessionKeyResult> {
        return validateSessionKey(this._auth, sessionKey);
    }
}

export function returnResult<
    T extends
        | {
              success: false;
              errorCode: KnownErrorCodes;
              errorMessage: string;
              reason?: DenialReason;
          }
        | { success: true }
>(result: T): GenericHttpResponse {
    const span = trace.getActiveSpan();
    if (span) {
        if (result.success === false) {
            span.setAttributes({
                ['result.errorCode']: result.errorCode,
                ['result.errorMessage']: result.errorMessage,
            });

            if (result.reason) {
                for (let prop in result.reason) {
                    span.setAttribute(
                        `result.reason.${prop}`,
                        (result.reason as any)[prop] as string
                    );
                }
            }
        }
    }

    return {
        statusCode: getStatusCode(result),
        body: JSON.stringify(result),
    };
}

export function returnProcedureOutputStream(
    result: ProcedureOutputStream
): GenericHttpResponse {
    const span = trace.getActiveSpan();
    if (span) {
        span.setAttributes({
            ['result.stream']: true,
        });
    }

    async function* generateBody(): AsyncGenerator<string, string> {
        while (true) {
            const { done, value } = await result.next();
            if (done) {
                return JSON.stringify(value);
            }
            yield JSON.stringify(value) + '\n';
        }
    }

    return {
        statusCode: 200,
        body: generateBody(),
        headers: {
            'content-type': 'application/x-ndjson',
        },
    };
}

export function returnProcedureOutput(
    result: ProcedureOutput
): GenericHttpResponse {
    if (Symbol.asyncIterator in result) {
        return returnProcedureOutputStream(result);
    } else {
        return returnResult(result);
    }
}

/**
 * Validates that the given request comes from one of the specified allowed origins.
 * Returns true if the request has an "origin" header set to one of the allowed origins. Returns false otherwise.
 * @param request The request.
 * @param origins The allowed origins.
 */
export function validateOrigin(
    request: GenericHttpRequest,
    origins: Set<string>
): boolean {
    const origin = request.headers.origin;
    return (
        origins.has(origin) ||
        // If the origin is not included, then the request is a same-origin request
        // if the method is either GET or HEAD.
        (!origin && (request.method === 'GET' || request.method === 'HEAD'))
    );
}

/**
 * Gets the session key from the given HTTP Request. Returns null if no session key was included.
 * @param event The event.
 */
export function getSessionKey(event: GenericHttpRequest): string {
    const authorization = event.headers.authorization;
    return parseAuthorization(authorization);
}

/**
 * Parses the given authorization header and returns the bearer value.
 * Returns null if the authorization header is invalid.
 * @param authorization The authorization header value.
 */
export function parseAuthorization(
    authorization: string | null | undefined
): string {
    if (
        typeof authorization === 'string' &&
        authorization.startsWith('Bearer ')
    ) {
        const authToken = authorization.substring('Bearer '.length);
        return authToken;
    }
    return null;
}

export function formatResponse(
    request: GenericHttpRequest,
    response: GenericHttpResponse,
    origins: Set<string> | boolean
) {
    const origin = request.headers['origin'];
    let headers = {
        ...(response.headers || {}),
    } as any;
    if (
        !!origin &&
        (origins === true ||
            (typeof origins === 'object' && validateOrigin(request, origins)))
    ) {
        if (!headers['Access-Control-Allow-Origin']) {
            headers['Access-Control-Allow-Origin'] = origin;
        }
        if (!headers['Access-Control-Allow-Headers']) {
            headers['Access-Control-Allow-Headers'] =
                'Content-Type, Authorization';
        }
    }

    return {
        ...response,
        headers,
    };
}

export function wrapHandler(
    func: (request: GenericHttpRequest) => Promise<GenericHttpResponse>,
    allowedOrigins: boolean | Set<string>
): (request: GenericHttpRequest) => Promise<GenericHttpResponse> {
    return async (request) => {
        const response = await func(request);
        return formatResponse(request, response, allowedOrigins);
    };
}

/**
 * Returns the given ZodError as a GenericHttpResponse.
 * @param error The error.
 */
export function returnZodError(error: z.ZodError<any>): GenericHttpResponse {
    return returnResult({
        success: false,
        errorCode: 'unacceptable_request',
        errorMessage:
            'The request was invalid. One or more fields were invalid.',
        issues: error.issues,
    });
}
