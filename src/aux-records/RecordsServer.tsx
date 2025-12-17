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
    genericResult,
    isSuccess,
    isSuperUserRole,
    mapResult,
    parseSessionKey,
    success,
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
    SimpleError,
    GenericQueryStringParameters,
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
import { merge, omit } from 'es-toolkit/compat';
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
import type { SearchQuery, SearchRecordsController } from './search';
import { SEARCH_COLLECTION_SCHEMA, SEARCH_DOCUMENT_SCHEMA } from './search';
import type { DatabaseRecordsController, DatabaseStatement } from './database';
import type { PurchasableItemRecordsController } from './purchasable-items/PurchasableItemRecordsController';
import type { PurchasableItem } from './purchasable-items/PurchasableItemRecordsStore';
import type { ContractRecordsController } from './contracts/ContractRecordsController';
import type { ViewParams, ViewTemplateRenderer } from './ViewTemplateRenderer';
import type { JSX } from 'preact';
import { omitBy } from 'es-toolkit';
import { WEB_MANIFEST_SCHEMA } from '@casual-simulation/aux-common/common/WebManifest';
import {
    CONFIGURATION_KEYS,
    CONFIGURATION_SCHEMAS,
} from './ConfigurationStore';

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

export const STORE_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'Store features are not supported by this server.',
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

export const XP_API_NOT_SUPPORTED_RESULT = {
    success: false as const,
    errorCode: 'not_supported' as const,
    errorMessage: 'xpAPI features are not supported by this server.',
};

/**
 * Defines a basic interface for an HTTP route.
 */
export interface Route<
    TSchema extends z.ZodType | void,
    TQuery extends z.ZodType | void = void
> {
    /**
     * The path that the route must match.
     *
     * If true, then the route will match all paths as a default route.
     */
    path: string | true;

    /**
     * The schema that should be used for the route.
     * If the method can contain a request body, then the schema applies to the body.
     * Otherwise, it will apply to the query parameters.
     */
    schema?: TSchema;

    /**
     * The schema that should be used for the query parameters.
     * If omitted, then the query parameters will not be validated using this schema.
     *
     * Additionally, this only works if a schema is provided.
     */
    querySchema?: TQuery;

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
     * The scope for the route.
     * Used to filter requests based on their context.
     */
    scope?: 'player' | 'auth';

    /**
     * The handler that should be called when the route is matched.
     * @param request The request.
     * @param data The data that was parsed from the request.
     * @param query The query parameters that were parsed from the request.
     */
    handler: (
        request: GenericHttpRequest,
        data?: z.output<TSchema>,
        query?: z.output<TQuery>
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

    /**
     * The controller that should be used for handling search records.
     * If null, then search records are not supported.
     */
    searchRecordsController?: SearchRecordsController | null;

    /**
     * The controller that should be used for handling database records.
     * If null, then database records are not supported.
     */
    databaseRecordsController?: DatabaseRecordsController | null;

    /**
     * The controller that should be used for handling contracts..
     * If null, then contracts are not supported.
     */
    contractRecordsController?: ContractRecordsController | null;

    /**
     * The controller that should be used for handling purchasable items.
     * If null, then purchasable items are not supported.
     */
    purchasableItemsController?: PurchasableItemRecordsController | null;

    /**
     * The interface that should be used for rendering view templates.
     */
    viewTemplateRenderer?: ViewTemplateRenderer | null;
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
    private _searchRecordsController: SearchRecordsController | null;
    private _databaseRecordsController: DatabaseRecordsController | null;
    private _contractRecordsController: ContractRecordsController | null;
    private _viewTemplateRenderer: ViewTemplateRenderer | null;

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
    private _purchasableItems: PurchasableItemRecordsController;

    /**
     * The map of paths to routes that they match.
     */
    private _routes: Map<string, Route<any, any>> = new Map();

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
        searchRecordsController,
        databaseRecordsController,
        contractRecordsController,
        purchasableItemsController,
        viewTemplateRenderer,
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
        this._searchRecordsController = searchRecordsController;
        this._databaseRecordsController = databaseRecordsController;
        this._contractRecordsController = contractRecordsController;
        this._viewTemplateRenderer = viewTemplateRenderer;
        this._tracer = trace.getTracer(
            'RecordsServer',
            typeof GIT_TAG === 'undefined' ? undefined : GIT_TAG
        );
        this._purchasableItems = purchasableItemsController;
        this._procedures = this._createProcedures();
        this._setupRoutes();
    }

    private _createProcedures() {
        return {
            playerIndex: procedure()
                .origins(true)
                .view('player', true)
                .handler(async (_, context) => {
                    const config = await this._records.getWebConfig(
                        context.url.hostname
                    );

                    const postApp: JSX.Element[] = [];
                    const icons: JSX.Element[] = [];

                    if (isSuccess(config) && config.value) {
                        postApp.push(
                            <script
                                type="application/json"
                                id="casualos-web-config"
                                dangerouslySetInnerHTML={{
                                    __html: JSON.stringify(config.value),
                                }}
                            />
                        );

                        if (
                            config.value.ab1BootstrapURL &&
                            config.value.serverInjectBootstrapper
                        ) {
                            const result = await this._records.getAb1Bootstrap(
                                config.value
                            );
                            if (isSuccess(result)) {
                                postApp.push(
                                    <script
                                        type="text/aux"
                                        id="casualos-ab1-bootstrap"
                                        dangerouslySetInnerHTML={{
                                            __html: result.value,
                                        }}
                                    />
                                );
                            }
                        }

                        if (config.value.icons) {
                            if (config.value.icons.appleTouchIcon) {
                                icons.push(
                                    <link
                                        rel="apple-touch-icon"
                                        href={config.value.icons.appleTouchIcon}
                                    />
                                );
                            }
                            if (config.value.icons.favicon) {
                                if (
                                    config.value.icons.favicon.endsWith('.png')
                                ) {
                                    icons.push(
                                        <link
                                            rel="icon"
                                            href={config.value.icons.favicon}
                                            type="image/png"
                                        />
                                    );
                                } else {
                                    icons.push(
                                        <link
                                            rel="icon"
                                            href={config.value.icons.favicon}
                                        />
                                    );
                                }
                            }
                        }
                    }

                    const result = success<ViewParams>({
                        icons: <>{icons}</>,
                        postApp: <>{postApp}</>,
                    });

                    return genericResult<ViewParams, SimpleError>(result);
                }),

            playerVmIframe: procedure()
                .origins(true)
                .view('player', '/aux-vm-iframe.html')
                .handler(async (_, context) => {
                    const result = success<ViewParams>({
                        postApp: <div>Player VM SSR</div>,
                    });

                    return genericResult<ViewParams, SimpleError>(result);
                }),

            playerVmIframeDom: procedure()
                .origins(true)
                .view('player', '/aux-vm-iframe-dom.html')
                .handler(async (_, context) => {
                    const result = success<ViewParams>({
                        postApp: <div>Player VM SSR</div>,
                    });

                    return genericResult<ViewParams, SimpleError>(result);
                }),

            authIndex: procedure()
                .origins(true)
                .view('auth', true)
                .handler(async (_, context) => {
                    const config = await this._records.getWebConfig(
                        context.url.hostname
                    );
                    const postApp: JSX.Element[] = [];

                    if (isSuccess(config) && config.value) {
                        postApp.push(
                            <script
                                type="application/json"
                                id="casualos-web-config"
                                dangerouslySetInnerHTML={{
                                    __html: JSON.stringify(config.value),
                                }}
                            />
                        );
                    }

                    const result = success<ViewParams>({
                        postApp: <>{postApp}</>,
                    });

                    return genericResult<ViewParams, SimpleError>(result);
                }),

            authIframe: procedure()
                .origins(true)
                .view('auth', '/iframe.html')
                .handler(async (_, context) => {
                    const config = await this._records.getWebConfig(
                        context.url.hostname
                    );
                    const postApp: JSX.Element[] = [];

                    if (isSuccess(config) && config.value) {
                        postApp.push(
                            <script
                                type="application/json"
                                id="casualos-web-config"
                                dangerouslySetInnerHTML={{
                                    __html: JSON.stringify(config.value),
                                }}
                            />
                        );
                    }

                    const result = success<ViewParams>({
                        postApp: <>{postApp}</>,
                    });

                    return genericResult<ViewParams, SimpleError>(result);
                }),

            getUserInfo: procedure()
                .origins('account')
                .inputs(
                    z.object({
                        userId: z.string(),
                    })
                )
                .handler(async ({ userId }, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._auth.getUserInfo({
                        userId: validation.userId,
                        userRole: validation.role,
                        requestedUserId: userId,
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
                        contractFeatures: result.contractFeatures,
                        stripeAccountId: result.stripeAccountId,
                        stripeAccountStatus: result.stripeAccountStatus,
                        stripeAccountRequirementsStatus:
                            result.stripeAccountRequirementsStatus,
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
                        .prefault({})
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
                        loginStudioId: z.string().nullable().optional(),
                        comId: z.string().nullable().optional(),
                        customDomain: z.string().nullable().optional(),
                    })
                )
                .handler(
                    async (
                        {
                            address,
                            addressType,
                            loginStudioId,
                            comId,
                            customDomain,
                        },
                        context
                    ) => {
                        const result = await this._auth.requestLogin({
                            address,
                            addressType,
                            ipAddress: context.ipAddress,
                            loginStudioId,
                            comId,
                            customDomain,
                        });

                        return result;
                    }
                ),

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
                        email: z.email().min(1).optional(),
                        parentEmail: z.email().min(1).optional(),
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'ownerId is required.'
                                        : 'ownerId must be a string.',
                            })
                            .nonempty('ownerId must not be empty.')
                            .optional(),
                        studioId: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'studioId is required.'
                                        : 'studioId must be a string.',
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
                            error: (issue) =>
                                issue.input === undefined
                                    ? 'count is required.'
                                    : 'count must be a number.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'eventName is required.'
                                        : 'eventName must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'eventName is required.'
                                        : 'eventName must be a string.',
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
                        markers: MARKERS_VALIDATION.optional().prefault([
                            PRIVATE_MARKER,
                        ]),
                    }),
                    z.object({
                        address: ADDRESS_VALIDATION,
                        targetResourceKind: z.literal('inst'),
                        targetRecordName:
                            RECORD_NAME_VALIDATION.optional().nullable(),
                        targetAddress: ADDRESS_VALIDATION,
                        markers: MARKERS_VALIDATION.optional().prefault([
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
                        .catchall(z.union([z.string(), z.array(z.string())]))
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
                                    query: omitBy(
                                        rest,
                                        (value) => typeof value !== 'string'
                                    ) as GenericQueryStringParameters,
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
                        requestTimeMs: z.int().optional(),
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
                    markers: MARKERS_VALIDATION.optional().prefault([
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
                                major: z.int(),
                                minor: z.int(),
                                patch: z.int(),
                                tag: z
                                    .string()
                                    .max(16)
                                    .nullable()
                                    .optional()
                                    .prefault(''),
                            }),
                            auxFileRequest: z.object({
                                fileSha256Hex: z.string().min(1).max(123),
                                fileByteLength: z.int().positive(),
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
                            major: z.int(),
                            minor: z.int(),
                            patch: z.int(),
                            tag: z.string().max(16).prefault(''),
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
                                                .int()
                                                .optional()
                                                .nullable(),
                                            minor: z
                                                .int()
                                                .optional()
                                                .nullable(),
                                            patch: z
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

            recordSearchCollection: recordItemProcedure(
                this._auth,
                this._searchRecordsController,
                z.object({
                    address: ADDRESS_VALIDATION,
                    markers: MARKERS_VALIDATION,
                    schema: SEARCH_COLLECTION_SCHEMA,
                }),
                procedure()
                    .origins('api')
                    .http('POST', '/api/v2/records/search/collection')
            ),

            getSearchCollection: getItemProcedure(
                this._auth,
                this._searchRecordsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/search/collection')
            ),

            eraseSearchCollection: eraseItemProcedure(
                this._auth,
                this._searchRecordsController,
                procedure()
                    .origins('api')
                    .http('DELETE', '/api/v2/records/search/collection')
            ),

            listSearchCollections: listItemsProcedure(
                this._auth,
                this._searchRecordsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/search/collection/list')
            ),

            recordSearchDocument: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/search/document')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        document: SEARCH_DOCUMENT_SCHEMA,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, document, instances },
                        context
                    ) => {
                        if (!this._searchRecordsController) {
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
                            await this._searchRecordsController.storeDocument({
                                recordName,
                                address,
                                document,
                                userId: validation.userId,
                                instances,
                            });
                        return genericResult(result);
                    }
                ),

            eraseSearchDocument: procedure()
                .origins('api')
                .http('DELETE', '/api/v2/records/search/document')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        documentId: z.string().min(1).max(256),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, documentId, instances },
                        context
                    ) => {
                        if (!this._searchRecordsController) {
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
                            await this._searchRecordsController.eraseDocument({
                                recordName,
                                address,
                                documentId,
                                userId: validation.userId,
                                instances,
                            });
                        return genericResult(result);
                    }
                ),

            syncSearchRecord: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/search/sync')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        targetRecordName: RECORD_NAME_VALIDATION,
                        targetResourceKind: z.enum(['data']),
                        targetMarker: MARKER_VALIDATION,
                        targetMapping: z
                            .array(
                                z.tuple([
                                    z.string().max(100),
                                    z.string().max(100),
                                ])
                            )
                            .max(100),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            address,
                            targetRecordName,
                            targetResourceKind,
                            targetMarker,
                            targetMapping,
                            instances,
                        },
                        context
                    ) => {
                        if (!this._searchRecordsController) {
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

                        const result = await this._searchRecordsController.sync(
                            {
                                recordName,
                                address,
                                targetRecordName,
                                targetResourceKind,
                                targetMarker,
                                targetMapping: targetMapping as [
                                    string,
                                    string
                                ][],
                                userId: validation.userId,
                                instances: instances ?? [],
                            }
                        );
                        return genericResult(result);
                    }
                ),

            unsyncSearchRecord: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/search/unsync')
                .inputs(
                    z.object({
                        syncId: z.string().min(1),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ syncId, instances }, context) => {
                    if (!this._searchRecordsController) {
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

                    const result = await this._searchRecordsController.unsync({
                        syncId,
                        userId: validation.userId,
                        instances: instances ?? [],
                    });
                    return genericResult(result);
                }),

            search: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/search')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        query: z
                            .object({
                                q: z.string().min(1).max(1024),
                                queryBy: z.string().min(1).max(1024),
                                filterBy: z
                                    .string()
                                    .min(1)
                                    .max(1024)
                                    .optional()
                                    .nullable(),
                            })
                            .catchall(
                                z.union([
                                    z.string().max(1024),
                                    z.boolean(),
                                    z.number(),
                                ])
                            ),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        { recordName, address, query, instances },
                        context
                    ) => {
                        if (!this._searchRecordsController) {
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
                            await this._searchRecordsController.search({
                                recordName,
                                address,
                                query: query as SearchQuery,
                                userId: validation.userId,
                                instances: instances ?? [],
                            });
                        return genericResult(result);
                    }
                ),

            recordDatabase: recordItemProcedure(
                this._auth,
                this._databaseRecordsController,
                z.object({
                    address: ADDRESS_VALIDATION,
                    markers: MARKERS_VALIDATION,
                }),
                procedure()
                    .origins('api')
                    .http('POST', '/api/v2/records/database')
            ),

            getDatabase: getItemProcedure(
                this._auth,
                this._databaseRecordsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/database')
            ),

            eraseDatabase: eraseItemProcedure(
                this._auth,
                this._databaseRecordsController,
                procedure()
                    .origins('api')
                    .http('DELETE', '/api/v2/records/database')
            ),

            listDatabases: listItemsProcedure(
                this._auth,
                this._databaseRecordsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/database/list')
            ),

            queryDatabase: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/database/query')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        statements: z.array(
                            z.object({
                                query: z.string().min(1).max(250_000),
                                params: z
                                    .array(z.any())
                                    .optional()
                                    .prefault([]),
                            })
                        ),
                        readonly: z.boolean().prefault(true),
                        automaticTransaction: z
                            .boolean()
                            .optional()
                            .prefault(true),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            address,
                            statements,
                            readonly,
                            automaticTransaction,
                            instances,
                        },
                        context
                    ) => {
                        if (!this._databaseRecordsController) {
                            return {
                                success: false,
                                errorCode: 'not_supported',
                                errorMessage: 'This feature is not supported.',
                            };
                        }

                        const validation = await validateSessionKey(
                            this._auth,
                            context.sessionKey
                        );
                        if (
                            validation.success === false &&
                            validation.errorCode !== 'no_session_key'
                        ) {
                            return validation;
                        }

                        const result =
                            await this._databaseRecordsController.query({
                                recordName,
                                userId: validation.userId,
                                address,
                                statements: statements as DatabaseStatement[],
                                readonly,
                                automaticTransaction,
                                instances: instances ?? [],
                            });

                        return genericResult(result);
                    }
                ),

            // getXpUserInfo: procedure()
            //     .origins('api')
            //     .http('GET', '/api/v2/xp/user')
            //     .inputs(
            //         z.object({
            //             userId: z.string().min(1).optional().nullable(),
            //         })
            //     )
            //     .handler(async ({ userId }, context) => {
            //         if (!this._xpController) {
            //             return XP_API_NOT_SUPPORTED_RESULT;
            //         }

            //         const authUser = await this._validateSessionKey(
            //             context.sessionKey
            //         );
            //         if (authUser.success === false) {
            //             return authUser;
            //         }

            //         //* An empty string for any of the query types will be treated as the current logged in user
            //         const result = await this._xpController.getXpUser({
            //             userId: authUser.userId,
            //             userRole: authUser.role,
            //             requestedUserId: userId,
            //         });
            //         return genericResult(result);
            //     }),

            // TODO:
            // createXpContract: procedure()
            //     .origins('api')
            //     .http('POST', '/api/v2/xp/contract')
            //     .inputs(
            //         z.object({
            //             contract: z
            //                 .object({
            //                     description: z.string().optional(),
            //                     accountCurrency: z.string().optional(),
            //                     gigRate: z.number().int().positive(),
            //                     gigs: z.number().int().positive(),
            //                     status: z.union([
            //                         z.literal('open'),
            //                         z.literal('draft'),
            //                     ]),
            //                     contractedUserId: z.string().min(1),
            //                 })
            //                 .refine(
            //                     (contract) => {
            //                         if (contract.status === 'open') {
            //                             //* Open contracts must have a contracted user
            //                             return (
            //                                 (contract.contractedUserId ??
            //                                     undefined) !== undefined
            //                             );
            //                         } else if (contract.status === 'draft') {
            //                             /**
            //                              * * Draft contracts from the database's perspective should not be expecting a contracted user yet.
            //                              * * This is because the contracted user is only set when the contract is opened.
            //                              */
            //                             return (
            //                                 (contract.contractedUserId ??
            //                                     undefined) === undefined
            //                             );
            //                         }
            //                     },
            //                     {
            //                         message:
            //                             'Contract must contain contractedUserId (only when status is "open").',
            //                         path: ['contractedUserId'],
            //                     }
            //                 )
            //                 .refine(
            //                     (contract) => {
            //                         if (contract.status === 'open') {
            //                             return !contract.accountCurrency;
            //                         } else if (contract.status === 'draft') {
            //                             return (
            //                                 (contract.accountCurrency ??
            //                                     undefined) === undefined
            //                             );
            //                         }
            //                     },
            //                     {
            //                         message:
            //                             'Contract must contain accountCurrency (only when status is "open").',
            //                         path: ['accountCurrency'],
            //                     }
            //                 ),
            //         })
            //     )
            //     .handler(async ({ contract }, context) => {
            //         const authUser = await this._validateSessionKey(
            //             context.sessionKey
            //         );
            //         if (!authUser.success) {
            //             return authUser;
            //         }
            //         // const result = await this._xpController.createContract({
            //         //     description: contract.description ?? null,
            //         //     accountCurrency: contract.accountCurrency,
            //         //     rate: contract.gigRate,
            //         //     offeredWorth: contract.gigs
            //         //         ? (contract.gigRate ?? 0) * contract.gigs
            //         //         : 0,
            //         //     status: contract.status,
            //         //     issuerUserId: { userId: authUser.userId },
            //         //     holdingUserId: contract.contractedUserId,
            //         //     creationRequestReceivedAt: Date.now(),
            //         // });
            //         // return result;
            //         return {
            //             success: true,
            //             message: 'Not implemented',
            //         };
            //     }),

            // updateXpContract: procedure()
            //     .origins('api')
            //     .http('PUT', '/api/v2/xp/contract')
            //     .inputs(
            //         z.object({
            //             contractId: z.string().min(1),
            //             newStatus: z.union([
            //                 z.literal('open'),
            //                 z.literal('draft'),
            //                 z.literal('closed'),
            //             ]),
            //             //* Note this is the change of the description which can only be done when the contract is in draft status
            //             newDescription: z.string().optional(),
            //             receivingUserId: GetXpUserById,
            //         })
            //     )
            //     .handler(
            //         async (
            //             { contractId, newStatus, newDescription },
            //             context
            //         ) => {
            //             const authUser = await this._validateSessionKey(
            //                 context.sessionKey
            //             );
            //             if (!authUser.success) {
            //                 return authUser;
            //             }
            //             // const result = await this._xpController.updateContract({
            //             //     contractId,
            //             //     newStatus,
            //             //     newDescription,
            //             //     userId: authUser.userId,
            //             // });
            //             // throw new Error('Not implemented');
            //             //return result;
            //             // TODO: Implement.
            //             return {
            //                 success: true,
            //                 message: 'Not implemented',
            //             };
            //         }
            //     ),

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
                            error: (issue) =>
                                issue.input === undefined
                                    ? 'policy is required.'
                                    : 'policy must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'permissionId is required.'
                                        : 'permissionId must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'resourceId is required.'
                                        : 'resourceId must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'userId is required.'
                                        : 'userId must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'inst is required.'
                                        : 'inst must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'startingRole is required.'
                                        : 'startingRole must be a string.',
                            })
                            .nonempty('startingRole must not be empty')
                            .optional(),
                        role: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'role is required.'
                                        : 'role must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'userId is required.'
                                        : 'userId must be a string.',
                            })
                            .nonempty('userId must not be empty')
                            .optional(),
                        inst: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'inst is required.'
                                        : 'inst must be a string.',
                            })
                            .nonempty('inst must not be empty')
                            .optional(),
                        role: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'role is required.'
                                        : 'role must be a string.',
                            })
                            .nonempty('role must not be empty'),
                        expireTimeMs: z
                            .number({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'expireTimeMs is required.'
                                        : 'expireTimeMs must be a number.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'userId is required.'
                                        : 'userId must be a string.',
                            })
                            .nonempty('userId must not be empty')
                            .optional(),
                        inst: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'inst is required.'
                                        : 'inst must be a string.',
                            })
                            .nonempty('inst must not be empty')
                            .optional(),
                        role: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'role is required.'
                                        : 'role must be a string.',
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
                        messages: z.array(AI_CHAT_MESSAGE_SCHEMA).min(1),
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
                        messages: z.array(AI_CHAT_MESSAGE_SCHEMA).min(1),
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

            aiListChatModels: procedure()
                .origins('api')
                .http('GET', '/api/v2/ai/chat/models')
                .inputs(z.object({}))
                .handler(async (_, context) => {
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

                    const result = await this._aiController.listChatModels({
                        userId: sessionKeyValidation.userId,
                        userSubscriptionTier:
                            sessionKeyValidation.subscriptionTier,
                        userRole: sessionKeyValidation.role,
                    });

                    return genericResult(result);
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'skyboxId is required.'
                                        : 'skyboxId must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'prompt is required.'
                                        : 'prompt must be a string.',
                            })
                            .nonempty('prompt must not be empty'),
                        model: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'model is required.'
                                        : 'model must be a string.',
                            })
                            .nonempty('model must not be empty')
                            .optional(),
                        negativePrompt: z.string().nonempty().optional(),
                        width: z.int().positive().optional(),
                        height: z.int().positive().optional(),
                        seed: z.int().positive().optional(),
                        numberOfImages: z.int().positive().optional(),
                        steps: z.int().positive().optional(),
                        sampler: z.string().nonempty().optional(),
                        cfgScale: z.int().min(0).optional(),
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
                            .prefault('model/gltf+json'),
                        prompt: z.string().min(1),
                        levelOfDetail: z.number().min(0.01).max(1).optional(),
                        baseModelId: z.string().optional(),
                        thumbnail: z
                            .object({
                                type: z.literal('image/png'),
                                width: z.int().min(1),
                                height: z.int().min(1),
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
                            maxResponseOutputTokens: z.int().min(1).optional(),
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'ownerStudioComId is required.'
                                        : 'ownerStudioComId must be a string.',
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
                        logoUrl: z.url().min(1).max(512).nullable().optional(),
                        logoBackgroundColor: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'logoBackgroundColor is required.'
                                        : 'logoBackgroundColor must be a string.',
                            })
                            .min(1)
                            .max(32)
                            .nullable()
                            .optional(),
                        comIdConfig: COM_ID_CONFIG_SCHEMA.optional(),
                        playerConfig: COM_ID_PLAYER_CONFIG.optional().describe(
                            'The configuration that the comId provides which overrides the default player configuration.'
                        ),
                        loomConfig: LOOM_CONFIG.optional().describe(
                            'The configuration that can be used by studios to setup loom.'
                        ),
                        humeConfig: HUME_CONFIG.optional(),
                        playerWebManifest:
                            WEB_MANIFEST_SCHEMA.optional().describe(
                                'The PWA web manifest that should be served for custom domains for the studio.'
                            ),
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
                            playerWebManifest,
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
                                playerWebManifest,
                            },
                        });
                        return result;
                    }
                ),

            addCustomDomain: procedure()
                .origins('account')
                .http('POST', '/api/v2/studios/domains')
                .inputs(
                    z.object({
                        studioId: STUDIO_ID_VALIDATION,
                        domain: z.string().min(1).max(255),
                    })
                )
                .handler(async ({ studioId, domain }, context) => {
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

                    const result = await this._records.addCustomDomain({
                        userId: sessionKeyValidation.userId,
                        userRole: sessionKeyValidation.role,
                        studioId,
                        domain,
                    });

                    return genericResult(result);
                }),

            deleteCustomDomain: procedure()
                .origins('account')
                .http('DELETE', '/api/v2/studios/domains')
                .inputs(
                    z.object({
                        customDomainId: z.string().nonempty(),
                    })
                )
                .handler(async ({ customDomainId }, context) => {
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

                    const result = await this._records.deleteCustomDomain({
                        userId: sessionKeyValidation.userId,
                        userRole: sessionKeyValidation.role,
                        customDomainId,
                    });

                    return genericResult(result);
                }),

            listCustomDomains: procedure()
                .origins('account')
                .http('GET', '/api/v2/studios/domains/list')
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

                    const result = await this._records.listCustomDomains({
                        userId: sessionKeyValidation.userId,
                        userRole: sessionKeyValidation.role,
                        studioId,
                    });

                    return genericResult(result);
                }),

            verifyCustomDomain: procedure()
                .origins('account')
                .http('POST', '/api/v2/studios/domains/verify')
                .inputs(
                    z.object({
                        customDomainId: z.string().nonempty(),
                    })
                )
                .handler(async ({ customDomainId }, context) => {
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

                    const result = await this._records.verifyCustomDomain({
                        userId: sessionKeyValidation.userId,
                        userRole: sessionKeyValidation.role,
                        customDomainId,
                    });

                    return genericResult(result);
                }),

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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'addedUserId is required.'
                                        : 'addedUserId must be a string.',
                            })
                            .nonempty('addedUserId must not be empty')
                            .optional(),
                        addedEmail: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'addedEmail is required.'
                                        : 'addedEmail must be a string.',
                            })
                            .nonempty('addedEmail must not be empty')
                            .optional(),
                        addedPhoneNumber: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'addedPhoneNumber is required.'
                                        : 'addedPhoneNumber must be a string.',
                            })
                            .nonempty('addedPhoneNumber must not be empty')
                            .optional(),
                        addedDisplayName: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'addedDisplayName is required.'
                                        : 'addedDisplayName must be a string.',
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
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'removedUserId is required.'
                                        : 'removedUserId must be a string.',
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

            getManageStudioStoreLink: procedure()
                .origins('account')
                .http('POST', '/api/v2/studios/store/manage')
                .inputs(
                    z.object({
                        studioId: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'studioId is required.'
                                        : 'studioId must be a string.',
                            })
                            .min(1),
                    })
                )
                .handler(async ({ studioId }, context) => {
                    if (!this._purchasableItems) {
                        return STORE_NOT_SUPPORTED_RESULT;
                    }
                    if (!this._subscriptions) {
                        return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
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
                        await this._subscriptions.createManageStoreAccountLink({
                            studioId,
                            userId: sessionKeyValidation.userId,
                        });

                    return genericResult(result);
                }),

            getWebConfig: procedure()
                .origins('api')
                .http('GET', '/api/config')
                .inputs(z.object({}))
                .handler(async (inputs, context) => {
                    const result = await this._records.getWebConfig(null);
                    return genericResult(result);
                }),

            getPlayerWebManifest: procedure()
                .origins(true)
                .http('GET', '/api/v2/site.webmanifest', 'player')
                .inputs(z.object({}))
                .handler(
                    async (_, context) => {
                        const result = await this._records.getPlayerWebManifest(
                            context.url.hostname
                        );
                        return genericResult(result);
                    },
                    async (result) => {
                        if (result.success === true) {
                            const { success, ...data } = result;
                            return {
                                body: JSON.stringify(data),
                                headers: {
                                    'content-type': 'application/manifest+json',
                                },
                            };
                        }
                        return {};
                    }
                ),

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

            getBalances: procedure()
                .origins('account')
                .http('GET', '/api/v2/balances')
                .inputs(
                    z.object({
                        studioId: z.string().min(1).max(255).optional(),
                        contractId: z.string().min(1).max(255).optional(),
                        userId: z.string().min(1).max(255).optional(),
                    })
                )
                .handler(async (input, context) => {
                    if (!this._subscriptions) {
                        return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        return validation;
                    }

                    if (
                        (input.userId && input.studioId) ||
                        (input.contractId && input.studioId) ||
                        (input.contractId && input.userId)
                    ) {
                        return {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage:
                                'You must only specify one of userId, studioId, or contractId.',
                        };
                    }

                    if (!input.userId && !input.studioId && !input.contractId) {
                        input = {
                            userId: validation.userId,
                        };
                    }

                    const result = await this._subscriptions.getBalances({
                        userId: validation.userId,
                        userRole: validation.role,
                        filter: input,
                    });

                    return genericResult(
                        mapResult(result, (balance) =>
                            balance
                                ? {
                                      usd: balance.usd?.toJSON(),
                                      credits: balance.credits?.toJSON(),
                                  }
                                : undefined
                        )
                    );
                }),

            getSubscriptions: procedure()
                .origins('account')
                .http('GET', '/api/v2/subscriptions')
                .inputs(
                    z.object({
                        studioId: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'studioId is required.'
                                        : 'studioId must be a string.',
                            })
                            .nonempty('studioId must be non-empty.')
                            .optional(),
                        userId: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'userId is required.'
                                        : 'userId must be a string.',
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
                        accountBalances: result.accountBalances
                            ? {
                                  usd: result.accountBalances?.usd?.toJSON(),
                                  credits:
                                      result.accountBalances?.credits?.toJSON(),
                              }
                            : undefined,
                    } as const;
                }),

            getManageSubscriptionLink: procedure()
                .origins('account')
                .http('POST', '/api/v2/subscriptions/manage')
                .inputs(
                    z.object({
                        userId: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'userId is required.'
                                        : 'userId must be a string.',
                            })
                            .nonempty('userId must not be empty.')
                            .optional(),
                        studioId: z
                            .string({
                                error: (issue) =>
                                    issue.input === undefined
                                        ? 'studioId is required.'
                                        : 'studioId must be a string.',
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
                            .int()
                            .positive()
                            .nullable(),
                        subscriptionPeriodEndMs: z.int().positive().nullable(),
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

            getManageXpAccountLink: procedure()
                .origins('api')
                .http('POST', '/api/v2/xp/account/manage')
                .inputs(z.object({}))
                .handler(async (input, context) => {
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
                        await this._subscriptions.createManageXpAccountLink({
                            userId: validation.userId,
                        });

                    return genericResult(result);
                }),

            getStripeLoginLink: procedure()
                .origins('account')
                .http('POST', '/api/v2/stripe/login')
                .inputs(
                    z.object({
                        studioId: z.string().min(1).optional(),
                    })
                )
                .handler(async ({ studioId }, context) => {
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
                        await this._subscriptions.createStripeLoginLink({
                            userId: validation.userId,
                            studioId: studioId,
                        });

                    return genericResult(result);
                }),

            recordContract: recordItemProcedure(
                this._auth,
                this._contractRecordsController,
                z.object({
                    address: ADDRESS_VALIDATION,
                    holdingUser: z
                        .string({
                            error: (issue) =>
                                issue.input === undefined
                                    ? 'holdingUser is required.'
                                    : 'holdingUser must be a string.',
                        })
                        .min(1, 'holdingUser must not be empty.'),
                    rate: z
                        .int('rate must be an integer.')
                        .positive('rate must be positive.'),
                    initialValue: z
                        .int('initialValue must be an integer.')
                        .nonnegative('initialValue must be non-negative.'),
                    description: z.string().optional().nullable(),
                    markers: MARKERS_VALIDATION.optional().prefault([
                        PRIVATE_MARKER,
                    ]),
                }),
                procedure()
                    .origins('api')
                    .http('POST', '/api/v2/records/contract')
            ),

            getContract: getItemProcedure(
                this._auth,
                this._contractRecordsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/contract')
            ),

            listContracts: listItemsProcedure(
                this._auth,
                this._contractRecordsController,
                procedure()
                    .origins('api')
                    .http('GET', '/api/v2/records/contract/list')
            ),

            eraseContract: eraseItemProcedure(
                this._auth,
                this._contractRecordsController,
                procedure()
                    .origins('api')
                    .http('DELETE', '/api/v2/records/contract')
            ),

            cancelContract: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/contract/cancel')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, address, instances }, context) => {
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

                        const result = await this._subscriptions.cancelContract(
                            {
                                userId: validation.userId,
                                recordName,
                                address,
                                instances,
                            }
                        );

                        return genericResult(result);
                    }
                ),

            listInsts: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/insts/list')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION.optional(),
                        inst: z.string().optional(),
                        marker: z.string().optional(),
                    })
                )
                .handler(async ({ recordName, inst, marker }, context) => {
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
                        inst,
                        marker
                    );
                    return result;
                }),

            invoiceContract: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/contract/invoice')
                .inputs(
                    z.object({
                        contractId: z.string().min(1),
                        amount: z.int().positive(),
                        note: z.string().min(1).optional(),
                        payoutDestination: z.enum(['account', 'stripe']),
                    })
                )
                .handler(
                    async (
                        { contractId, amount, note, payoutDestination },
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
                            await this._subscriptions.invoiceContract({
                                userId: validation.userId,
                                userRole: validation.role,
                                contractId,
                                amount,
                                note,
                                payoutDestination,
                            });

                        return genericResult(result);
                    }
                ),

            payContractInvoice: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/contract/invoice/pay')
                .inputs(
                    z.object({
                        invoiceId: z.string().min(1),
                    })
                )
                .handler(async ({ invoiceId }, context) => {
                    if (!this._subscriptions) {
                        return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                    }

                    if (!context.sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        return validation;
                    }

                    const result = await this._subscriptions.payContractInvoice(
                        {
                            userId: validation.userId,
                            userRole: validation.role,
                            invoiceId,
                        }
                    );

                    return genericResult(result);
                }),

            payoutAccount: procedure()
                .origins('api')
                .http('POST', '/api/v2/financial/payouts')
                .inputs(
                    z.object({
                        userId: z.string().min(1).optional(),
                        studioId: z.string().min(1).optional(),
                        amount: z.int().positive().optional(),
                        destination: z.enum(['stripe', 'cash']),
                    })
                )
                .handler(
                    async (
                        { userId, studioId, amount, destination },
                        context
                    ) => {
                        if (!this._subscriptions) {
                            return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                        }

                        if (userId && studioId) {
                            return {
                                success: false,
                                errorCode: 'unacceptable_request',
                                errorMessage:
                                    'You must only specify one of userId or studioId.',
                            };
                        }

                        if (!context.sessionKey) {
                            return NOT_LOGGED_IN_RESULT;
                        }

                        const validation = await this._validateSessionKey(
                            context.sessionKey
                        );

                        if (validation.success === false) {
                            return validation;
                        }

                        if (!userId && !studioId) {
                            userId = validation.userId;
                        }

                        const result = await this._subscriptions.payoutAccount({
                            userId: validation.userId,
                            userRole: validation.role,
                            payoutUserId: userId,
                            payoutStudioId: studioId,
                            payoutAmount: amount,
                            payoutDestination: destination,
                        });

                        return genericResult(result);
                    }
                ),

            listContractInvoices: procedure()
                .origins('api')
                .http('GET', '/api/v2/records/contract/invoices')
                .inputs(
                    z.object({
                        contractId: z.string().min(1),
                    })
                )
                .handler(async ({ contractId }, context) => {
                    if (!this._subscriptions) {
                        return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                    }

                    if (!context.sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        return validation;
                    }

                    const result =
                        await this._subscriptions.listContractInvoices({
                            userId: validation.userId,
                            userRole: validation.role,
                            contractId,
                        });

                    return genericResult(result);
                }),

            cancelInvoice: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/contract/invoice/cancel')
                .inputs(
                    z.object({
                        invoiceId: z.string().min(1),
                    })
                )
                .handler(async ({ invoiceId }, context) => {
                    if (!this._subscriptions) {
                        return SUBSCRIPTIONS_NOT_SUPPORTED_RESULT;
                    }

                    if (!context.sessionKey) {
                        return NOT_LOGGED_IN_RESULT;
                    }

                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );

                    if (validation.success === false) {
                        return validation;
                    }

                    const result = await this._subscriptions.cancelInvoice({
                        userId: validation.userId,
                        userRole: validation.role,
                        invoiceId,
                    });

                    return genericResult(result);
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
                        reportedUrl: z.url(),
                        reportedPermalink: z.url(),
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
                            .prefault(DEFAULT_BRANCH_NAME),
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

            getPurchasableItem: procedure()
                .origins(true)
                .http('GET', '/api/v2/records/purchasableItems')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, address, instances }, context) => {
                        if (!this._purchasableItems) {
                            return STORE_NOT_SUPPORTED_RESULT;
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

                        const result = await this._purchasableItems.getItem({
                            recordName: recordName,
                            address: address,
                            userId: validation.userId,
                            instances: instances ?? [],
                        });
                        return result;
                    }
                ),

            listPurchasableItems: procedure()
                .origins(true)
                .http('GET', '/api/v2/records/purchasableItems/list')
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
                        if (!this._purchasableItems) {
                            return STORE_NOT_SUPPORTED_RESULT;
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
                            const result =
                                await this._purchasableItems.listItems({
                                    recordName,
                                    startingAddress: address || null,
                                    userId: sessionKeyValidation.userId,
                                    instances,
                                });
                            return result;
                        } else {
                            const result =
                                await this._purchasableItems.listItemsByMarker({
                                    recordName: recordName,
                                    marker: marker,
                                    startingAddress: address || null,
                                    sort: sort,
                                    userId: sessionKeyValidation.userId,
                                    instances,
                                });

                            return result;
                        }
                    }
                ),

            recordPurchasableItem: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/purchasableItems')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        item: z.object({
                            address: ADDRESS_VALIDATION,
                            name: z.string().min(1).max(128),
                            description: z.string().min(1).max(1024),
                            imageUrls: z
                                .array(z.string().min(1).max(512))
                                .max(8),
                            currency: z.string().min(1).max(15).toLowerCase(),
                            cost: z.int().gte(0),
                            taxCode: z
                                .string()
                                .min(1)
                                .max(64)
                                .nullable()
                                .optional(),
                            roleName: z.string().min(1),
                            roleGrantTimeMs: z
                                .int()
                                .positive()
                                .nullable()
                                .optional(),
                            redirectUrl: z.url().nullable().optional(),
                            markers: MARKERS_VALIDATION,
                        }),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(async ({ recordName, item, instances }, context) => {
                    if (!this._purchasableItems) {
                        return STORE_NOT_SUPPORTED_RESULT;
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

                    const result = await this._purchasableItems.recordItem({
                        recordKeyOrRecordName: recordName,
                        item: item as PurchasableItem,
                        userId: sessionKeyValidation.userId,
                        instances: instances,
                    });

                    return result;
                }),

            erasePurchasableItem: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/purchasableItems/erase')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, address, instances }, context) => {
                        if (!this._purchasableItems) {
                            return STORE_NOT_SUPPORTED_RESULT;
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

                        const result = await this._purchasableItems.eraseItem({
                            recordName: recordName,
                            address: address,
                            userId: sessionKeyValidation.userId,
                            instances: instances,
                        });
                        return result;
                    }
                ),

            purchaseItem: procedure()
                .origins('account')
                .http('POST', '/api/v2/records/purchasableItems/purchase')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        item: z.object({
                            address: ADDRESS_VALIDATION,
                            expectedCost: z.int().gte(0),
                            currency: z.string().min(1).max(15).toLowerCase(),
                        }),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        returnUrl: z.url(),
                        successUrl: z.url(),
                    })
                )
                .handler(
                    async (
                        { recordName, item, instances, returnUrl, successUrl },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (
                            sessionKeyValidation.success === false &&
                            sessionKeyValidation.errorCode !== 'no_session_key'
                        ) {
                            return sessionKeyValidation;
                        }

                        const result =
                            await this._subscriptions.createPurchaseItemLink({
                                userId: sessionKeyValidation.userId,
                                item: {
                                    recordName: recordName,
                                    address: item.address,
                                    currency: item.currency,
                                    expectedCost: item.expectedCost,
                                },
                                returnUrl,
                                successUrl,
                                instances,
                            });

                        return result;
                    }
                ),

            purchaseContract: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/contract/purchase')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        contract: z.object({
                            address: ADDRESS_VALIDATION,
                            expectedCost: z.int().gte(0),
                            currency: z
                                .string()
                                .min(1)
                                .max(15)
                                .toLowerCase()
                                .prefault('usd'),
                        }),
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                        returnUrl: z.url(),
                        successUrl: z.url(),
                    })
                )
                .handler(
                    async (
                        {
                            recordName,
                            contract,
                            instances,
                            returnUrl,
                            successUrl,
                        },
                        context
                    ) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (
                            sessionKeyValidation.success === false &&
                            sessionKeyValidation.errorCode !== 'no_session_key'
                        ) {
                            return sessionKeyValidation;
                        }

                        const result =
                            await this._subscriptions.purchaseContract({
                                userId: sessionKeyValidation.userId,

                                contract: {
                                    recordName,
                                    address: contract.address,
                                    currency: contract.currency,
                                    expectedCost: contract.expectedCost,
                                },
                                returnUrl,
                                successUrl,
                                instances,
                            });

                        return genericResult(result);
                    }
                ),

            getContractPricing: procedure()
                .origins('api')
                .http('POST', '/api/v2/records/contract/pricing')
                .inputs(
                    z.object({
                        recordName: RECORD_NAME_VALIDATION,
                        address: ADDRESS_VALIDATION,
                        instances: INSTANCES_ARRAY_VALIDATION.optional(),
                    })
                )
                .handler(
                    async ({ recordName, address, instances }, context) => {
                        const sessionKeyValidation =
                            await this._validateSessionKey(context.sessionKey);
                        if (
                            sessionKeyValidation.success === false &&
                            sessionKeyValidation.errorCode !== 'no_session_key'
                        ) {
                            return sessionKeyValidation;
                        }

                        const result =
                            await this._subscriptions.getContractPricing({
                                userId: sessionKeyValidation.userId,

                                contract: {
                                    recordName,
                                    address,
                                },
                                instances,
                            });

                        return genericResult(result);
                    }
                ),

            fulfillCheckoutSession: procedure()
                .origins('account')
                .http('POST', '/api/v2/records/checkoutSession/fulfill')
                .inputs(
                    z.object({
                        sessionId: z.string().nonempty(),
                        activation: z.enum(['now', 'later']),
                    })
                )
                .handler(async ({ sessionId, activation }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (
                        sessionKeyValidation.success === false &&
                        sessionKeyValidation.errorCode !== 'no_session_key'
                    ) {
                        return sessionKeyValidation;
                    }

                    const result =
                        await this._subscriptions.fulfillCheckoutSession({
                            userId: sessionKeyValidation.userId,
                            sessionId,
                            activation,
                        });

                    return result;
                }),

            claimActivationKey: procedure()
                .origins('account')
                .http('POST', '/api/v2/records/activationKey/claim')
                .inputs(
                    z.object({
                        activationKey: z.string().min(1),
                        target: z.enum(['self', 'guest']),
                    })
                )
                .handler(async ({ activationKey, target }, context) => {
                    const sessionKeyValidation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (
                        sessionKeyValidation.success === false &&
                        sessionKeyValidation.errorCode !== 'no_session_key'
                    ) {
                        return sessionKeyValidation;
                    }

                    const result = await this._subscriptions.claimActivationKey(
                        {
                            userId: sessionKeyValidation.userId,
                            activationKey,
                            target,
                            ipAddress: context.ipAddress,
                        }
                    );

                    return result;
                }),

            getConfigurationValue: procedure()
                .origins('account')
                .http('GET', '/api/v2/configuration')
                .inputs(
                    z.object({
                        key: z.enum(CONFIGURATION_KEYS),
                    })
                )
                .handler(async ({ key }, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._records.getConfigurationValue({
                        userRole: validation.role,
                        key: key,
                    });

                    return genericResult(result);
                }),

            setConfigurationValue: procedure()
                .origins('account')
                .http('POST', '/api/v2/configuration')
                .inputs(
                    z.discriminatedUnion(
                        'key',
                        CONFIGURATION_SCHEMAS.map((s) =>
                            z.object({
                                key: z.literal(s.key),
                                value: s.schema,
                            })
                        ) as unknown as [
                            z.core.$ZodTypeDiscriminable,
                            ...z.core.$ZodTypeDiscriminable[]
                        ]
                    )
                )
                .handler(async ({ key, value }, context) => {
                    const validation = await this._validateSessionKey(
                        context.sessionKey
                    );
                    if (validation.success === false) {
                        if (validation.errorCode === 'no_session_key') {
                            return NOT_LOGGED_IN_RESULT;
                        }
                        return validation;
                    }

                    const result = await this._records.setConfigurationValue({
                        userRole: validation.role,
                        key,
                        value,
                    });

                    return genericResult(result);
                }),
        };
    }

    private _setupRoutes() {
        const procs = this._procedures;
        for (let procedureName of Object.keys(procs)) {
            if (Object.prototype.hasOwnProperty.call(procs, procedureName)) {
                const procedure = (procs as any)[procedureName];
                if (procedure.http) {
                    this._addProcedureApiRoute(procedure, procedureName);
                }
                if (procedure.view) {
                    this._addProcedureViewRoute(procedure, procedureName);
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
                    url: new URL(
                        request.path,
                        `http://${request.headers.host}`
                    ),
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
    addProcedure<
        TInput extends z.ZodType | void,
        TOutput extends ProcedureOutput,
        TQuery extends z.ZodType | void
    >(name: string, procedure: Procedure<TInput, TOutput, TQuery>) {
        if (name in this._procedures) {
            throw new Error(
                `A procedure already exists with the name: ${name}`
            );
        }
        (this._procedures as any)[name] = procedure;
        if (procedure.http) {
            this._addProcedureApiRoute(procedure, name);
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
    private _addProcedureApiRoute<
        TSchema extends z.ZodType | void,
        TQuery extends z.ZodType | void
    >(
        procedure: Procedure<TSchema, ProcedureOutput, TQuery>,
        name: string
    ): void {
        if (!procedure.http) {
            throw new Error('Procedure must have an http route defined.');
        }

        const route = procedure.http;
        const r: Route<TSchema, TQuery> = {
            method: route.method,
            path: route.path,
            schema: procedure.schema,
            querySchema: procedure.querySchema,
            scope: route.scope,
            name: name,
            handler: async (request, data, query) => {
                const context: RPCContext = {
                    ipAddress: request.ipAddress,
                    sessionKey: getSessionKey(request),
                    httpRequest: request,
                    origin: request.headers.origin ?? null,
                    url: new URL(
                        request.path,
                        `http://${request.headers.host}`
                    ),
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
     * Adds the given procedural route to the server.
     * @param route The route that should be added.
     */
    private _addProcedureViewRoute<
        TSchema extends z.ZodType | void,
        TQuery extends z.ZodType | void
    >(
        procedure: Procedure<TSchema, ProcedureOutput, TQuery>,
        name: string
    ): void {
        if (!procedure.view) {
            throw new Error('Procedure must have an view route defined.');
        }
        if (!this._viewTemplateRenderer) {
            console.warn(
                '[RecordsServer] No view template renderer defined. Skipping view route for procedure:',
                name
            );
            return;
        }

        const route = procedure.view;
        const r: Route<TSchema, TQuery> = {
            method: 'GET',
            path: route.path,
            schema: procedure.schema,
            querySchema: procedure.querySchema,
            scope: route.scope,
            name: name,
            handler: async (request, data, query) => {
                const context: RPCContext = {
                    ipAddress: request.ipAddress,
                    sessionKey: getSessionKey(request),
                    httpRequest: request,
                    origin: request.headers.origin ?? null,
                    url: new URL(
                        request.path,
                        `http://${request.headers.host}`
                    ),
                };
                let result: ProcedureOutput;
                try {
                    result = await procedure.handler(data, context, query);
                } catch (err) {
                    console.error(
                        `[RecordsServer] [view: ${name}] Error in view procedure:`,
                        err
                    );
                    result = {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    };
                }

                if (Symbol.asyncIterator in result) {
                    throw new Error('View procedures cannot return streams.');
                } else {
                    let viewParams: ViewParams;
                    if (result.success === false) {
                        console.error(
                            `[RecordsServer] [view: ${name}] View procedure returned unsuccessful result:`,
                            result
                        );
                        viewParams = {};
                        result = {
                            success: true,
                        };
                    } else {
                        const { success, ...rest } = result;
                        viewParams = rest;
                    }
                    const rendered = await this._viewTemplateRenderer.render(
                        name,
                        viewParams
                    );

                    return returnResult(result, rendered, {
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                }
            },
            allowedOrigins: procedure.allowedOrigins,
        };

        this.addRoute(r);
    }

    /**
     * Adds the given route to the server.
     */
    addRoute<TSchema extends z.ZodType | void, TQuery extends z.ZodType | void>(
        route: Route<TSchema, TQuery>
    ) {
        const routeKey = this._getRouteKey(route);
        if (this._routes.has(routeKey)) {
            throw new Error(
                `A route already exists for the given method and path: ${routeKey}`
            );
        }
        this._routes.set(routeKey, route);
    }

    private _getRouteKey(route: Route<any, any>) {
        if (typeof route.path === 'boolean' && route.path === true) {
            return `${route.scope ?? 'auth'}:${route.method}:**default**`;
        } else {
            return `${route.scope ?? 'auth'}:${route.method}:${route.path}`;
        }
    }

    /**
     * Forcefully adds the given route to the server, overwriting any routes that already exist.
     * @param route The route that should be added.
     */
    overrideRoute<
        TSchema extends z.ZodType | void,
        TQuery extends z.ZodType | void
    >(route: Route<TSchema, TQuery>) {
        const routeKey = this._getRouteKey(route);
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

        let route = this._routes.get(
            `${request.scope ?? 'auth'}:${request.method}:${request.path}`
        );

        // Default routes shouldn't work for API routes (for now)
        if (!route && !request.path.startsWith('/api/')) {
            route = this._routes.get(
                `${request.scope ?? 'auth'}:${request.method}:**default**`
            );
        }

        if (route) {
            if (span && route.name) {
                span.updateName(`http:${route.name}`);
            }

            let origins =
                route.allowedOrigins === 'account'
                    ? this._allowedAccountOrigins
                    : route.allowedOrigins === 'api'
                    ? this._allowedApiOrigins
                    : route.allowedOrigins ?? true;

            try {
                if (origins !== true && !validateOrigin(request, origins)) {
                    let allow = false;
                    const host = request.headers.host;
                    if (host && route.allowedOrigins === 'api') {
                        // Fallback to checking custom domains
                        const requestUrl = new URL(
                            request.path,
                            `http://${host}`
                        );
                        const origin = new URL(request.headers.origin);

                        // All custom domain requests must come from the custom domain
                        if (origin.host === requestUrl.host) {
                            // Only allow API routes to use custom domains
                            const customDomain =
                                await this._records.getVerifiedCustomDomainByName(
                                    requestUrl.hostname
                                );

                            if (isSuccess(customDomain) && customDomain.value) {
                                // allow the request
                                allow = true;
                                origins = true;
                            }
                        }
                    }

                    if (!allow) {
                        return formatResponse(
                            request,
                            returnResult(INVALID_ORIGIN_RESULT),
                            origins
                        );
                    }
                }

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
        // TODO: Add error handling

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
            accountBalances: result.accountBalances
                ? {
                      usd: result.accountBalances?.usd?.toJSON(),
                      credits: result.accountBalances?.credits?.toJSON(),
                  }
                : undefined,
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

        const validation = await this._validateSessionKey(sessionKey);

        if (validation.success === false) {
            if (validation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(validation);
        }

        const userId = tryDecodeUriComponent(request.pathParams.userId);

        if (!userId) {
            return returnResult(UNACCEPTABLE_USER_ID);
        }

        const result = await this._auth.getUserInfo({
            userId: validation.userId,
            userRole: validation.role,
            requestedUserId: userId,
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
            contractFeatures: result.contractFeatures,
            stripeAccountId: result.stripeAccountId,
            stripeAccountStatus: result.stripeAccountStatus,
            stripeAccountRequirementsStatus:
                result.stripeAccountRequirementsStatus,
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
                .email()
                .max(MAX_EMAIL_ADDRESS_LENGTH)
                .optional()
                .nullable(),
            phoneNumber: z
                .string()
                .max(MAX_SMS_ADDRESS_LENGTH)
                .optional()
                .nullable(),
            avatarUrl: z.url().optional().nullable(),
            avatarPortraitUrl: z.url().optional().nullable(),
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

/**
 * Returns the given result and body as a GenericHttpResponse.
 * @param result The result.
 * @param body The body. If undefined, the result will be stringified and used as the body.
 * @returns
 */
export function returnResult<
    T extends
        | {
              success: false;
              errorCode: KnownErrorCodes;
              errorMessage: string;
              reason?: DenialReason;
          }
        | { success: true }
>(
    result: T,
    body: string = undefined,
    headers?: GenericHttpHeaders
): GenericHttpResponse {
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
        body: body ?? JSON.stringify(result),
        headers,
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
