import {
    KnownErrorCodes,
    getStatusCode,
    parseInstancesList,
    tryDecodeUriComponent,
    tryParseJson,
} from './Utils';
import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    INVALID_REQUEST_ERROR_MESSAGE,
    MAX_EMAIL_ADDRESS_LENGTH,
    MAX_OPEN_AI_API_KEY_LENGTH,
    MAX_SMS_ADDRESS_LENGTH,
    PRIVO_OPEN_ID_PROVIDER,
    ValidateSessionKeyResult,
} from './AuthController';
import { parseSessionKey } from './AuthUtils';
import { LivekitController } from './LivekitController';
import { RecordsController } from './RecordsController';
import { EventRecordsController } from './EventRecordsController';
import { DataRecordsController } from './DataRecordsController';
import { FileRecordsController } from './FileRecordsController';
import {
    CreateManageSubscriptionRequest,
    SubscriptionController,
} from './SubscriptionController';
import { ZodError, z } from 'zod';
import { PublicRecordKeyPolicy } from './RecordsStore';
import { RateLimitController } from './RateLimitController';
import { AVAILABLE_PERMISSIONS_VALIDATION } from '@casual-simulation/aux-common';
import { PolicyController } from './PolicyController';
import { AIController } from './AIController';
import { AIChatMessage, AI_CHAT_MESSAGE_SCHEMA } from './AIChatInterface';
import { WebsocketController } from './websockets/WebsocketController';
import {
    AddUpdatesMessage,
    LoginMessage,
    SendActionMessage,
    TimeSyncRequestMessage,
    UnwatchBranchMessage,
    WatchBranchMessage,
    WebsocketErrorEvent,
    WebsocketEventTypes,
    WebsocketMessage,
    WebsocketRequestMessage,
    websocketEventSchema,
    websocketRequestMessageSchema,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import { DEFAULT_BRANCH_NAME } from '@casual-simulation/aux-common';
import {
    GenericHttpHeaders,
    GenericHttpRequest,
    GenericHttpResponse,
    GenericWebsocketRequest,
} from '@casual-simulation/aux-common';
import { ModerationController } from './ModerationController';
import { COM_ID_CONFIG_SCHEMA, COM_ID_PLAYER_CONFIG } from './ComIdConfig';

const NOT_LOGGED_IN_RESULT = {
    success: false as const,
    errorCode: 'not_logged_in' as const,
    errorMessage:
        'The user is not logged in. A session key must be provided for this operation.' as const,
};

const UNACCEPTABLE_SESSION_KEY = {
    success: false,
    errorCode: 'unacceptable_session_key' as const,
    errorMessage:
        'The given session key is invalid. It must be a correctly formatted string.',
};

const UNACCEPTABLE_USER_ID = {
    success: false,
    errorCode: 'unacceptable_user_id' as const,
    errorMessage:
        'The given user ID is invalid. It must be a correctly formatted string.',
};

const INVALID_ORIGIN_RESULT = {
    success: false,
    errorCode: 'invalid_origin' as const,
    errorMessage: 'The request must be made from an authorized origin.',
};

const OPERATION_NOT_FOUND_RESULT = {
    success: false,
    errorCode: 'operation_not_found' as const,
    errorMessage: 'An operation could not be found for the given request.',
};

const UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON = {
    success: false,
    errorCode: 'unacceptable_request' as const,
    errorMessage:
        'The request body was not properly formatted. It should be valid JSON.',
};

const SUBSCRIPTIONS_NOT_SUPPORTED_RESULT = {
    success: false,
    errorCode: 'not_supported' as const,
    errorMessage: 'Subscriptions are not supported by this server.',
};

const AI_NOT_SUPPORTED_RESULT = {
    success: false,
    errorCode: 'not_supported' as const,
    errorMessage: 'AI features are not supported by this server.',
};

const INSTS_NOT_SUPPORTED_RESULT = {
    success: false,
    errorCode: 'not_supported' as const,
    errorMessage: 'Inst features are not supported by this server.',
};

const MODERATION_NOT_SUPPORTED_RESULT = {
    success: false,
    errorCode: 'not_supported' as const,
    errorMessage: 'Moderation features are not supported by this server.',
};

/**
 * The Zod validation for record keys.
 */
const RECORD_KEY_VALIDATION = z
    .string({
        invalid_type_error: 'recordKey must be a string.',
        required_error: 'recordKey is required.',
    })
    .nonempty('recordKey must not be empty.');

/**
 * The Zod validation for addresses.
 */
const ADDRESS_VALIDATION = z
    .string({
        invalid_type_error: 'address must be a string.',
        required_error: 'address is required.',
    })
    .nonempty('address must not be empty.');

/**
 * The Zod validation for event names.
 */
const EVENT_NAME_VALIDATION = z
    .string({
        invalid_type_error: 'eventName must be a string.',
        required_error: 'eventName is required.',
    })
    .nonempty('eventName must not be empty.');

/**
 * The Zod validation for markers.
 */
const MARKERS_VALIDATION = z
    .array(
        z
            .string({
                invalid_type_error: 'individual markers must be strings.',
                required_error: 'invidiaul markers must not be null or empty.',
            })
            .nonempty('invidiaul markers must not be null or empty.'),
        {
            invalid_type_error: 'markers must be an array of strings.',
            required_error: 'markers is required.',
        }
    )
    .nonempty('markers must not be empty.');

const NO_WHITESPACE_MESSAGE = 'The value cannot not contain spaces.';
const NO_WHITESPACE_REGEX = /^\S*$/g;
const NO_SPECIAL_CHARACTERS_MESSAGE =
    'The value cannot not contain special characters.';
const NO_SPECIAL_CHARACTERS_REGEX =
    /^[^!@#$%\^&*()\[\]{}\-_=+`~,./?;:'"\\<>|]*$/g;

const DISPLAY_NAME_VALIDATION = z
    .string()
    .trim()
    .min(1)
    .regex(NO_WHITESPACE_REGEX, NO_WHITESPACE_MESSAGE)
    .regex(NO_SPECIAL_CHARACTERS_REGEX, NO_SPECIAL_CHARACTERS_MESSAGE);

const NAME_VALIDATION = z
    .string()
    .trim()
    .min(1)
    .regex(NO_WHITESPACE_REGEX, NO_WHITESPACE_MESSAGE)
    .regex(NO_SPECIAL_CHARACTERS_REGEX, NO_SPECIAL_CHARACTERS_MESSAGE);

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

    /**
     * The set of origins that are allowed for API requests.
     */
    private _allowedApiOrigins: Set<string>;

    /**
     * The set of origins that are allowed for account management requests.
     */
    private _allowedAccountOrigins: Set<string>;
    private _rateLimit: RateLimitController;
    private _policyController: PolicyController;

    constructor(
        allowedAccountOrigins: Set<string>,
        allowedApiOrigins: Set<string>,
        authController: AuthController,
        livekitController: LivekitController,
        recordsController: RecordsController,
        eventsController: EventRecordsController,
        dataController: DataRecordsController,
        manualDataController: DataRecordsController,
        filesController: FileRecordsController,
        subscriptionController: SubscriptionController | null,
        rateLimitController: RateLimitController,
        policyController: PolicyController,
        aiController: AIController | null,
        websocketController: WebsocketController | null,
        moderationController: ModerationController | null
    ) {
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
        this._policyController = policyController;
        this._aiController = aiController;
        this._websocketController = websocketController;
        this._moderationController = moderationController;
    }

    /**
     * Handles the given request and returns the specified response.
     * @param request The request that should be handled.
     */
    async handleHttpRequest(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        let skipRateLimitCheck = false;
        if (!this._rateLimit) {
            skipRateLimitCheck = true;
        } else if (
            request.method == 'POST' &&
            request.path === '/api/stripeWebhook'
        ) {
            skipRateLimitCheck = true;
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
            request.method === 'POST' &&
            request.path === '/api/stripeWebhook'
        ) {
            return formatResponse(
                request,
                await this._stripeWebhook(request),
                true
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/email/valid'
        ) {
            return formatResponse(
                request,
                await this._isEmailValid(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/displayName/valid'
        ) {
            return formatResponse(
                request,
                await this._isDisplayNameValid(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/sessions'
        ) {
            return formatResponse(
                request,
                await this._getSessions(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/replaceSession'
        ) {
            return formatResponse(
                request,
                await this._postReplaceSession(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/revokeAllSessions'
        ) {
            return formatResponse(
                request,
                await this._postRevokeAllSessions(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/revokeSession'
        ) {
            return formatResponse(
                request,
                await this._postRevokeSession(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/completeLogin'
        ) {
            return formatResponse(
                request,
                await this._postCompleteLogin(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/login'
        ) {
            return formatResponse(
                request,
                await this._postLogin(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/login/privo'
        ) {
            return formatResponse(
                request,
                await this._privoLogin(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/oauth/code'
        ) {
            return formatResponse(
                request,
                await this._oauthProvideCode(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/oauth/complete'
        ) {
            return formatResponse(
                request,
                await this._oauthCompleteLogin(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/register/privo'
        ) {
            return formatResponse(
                request,
                await this._registerPrivo(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/meet/token'
        ) {
            return formatResponse(
                request,
                await this._postMeetToken(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records'
        ) {
            return formatResponse(
                request,
                await this._createRecord(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/events/count'
        ) {
            return formatResponse(
                request,
                await this._postRecordsEventsCount(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/events/count'
        ) {
            return formatResponse(
                request,
                await this._getRecordsEventsCount(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/events/list'
        ) {
            return formatResponse(
                request,
                await this._listEvents(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/events'
        ) {
            return formatResponse(
                request,
                await this._postRecordsEvents(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'DELETE' &&
            request.path === '/api/v2/records/manual/data'
        ) {
            return formatResponse(
                request,
                await this._eraseManualRecordData(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/manual/data'
        ) {
            return formatResponse(
                request,
                await this._getManualRecordData(request),
                true
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/manual/data'
        ) {
            return formatResponse(
                request,
                await this._manualRecordData(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/file'
        ) {
            return formatResponse(
                request,
                await this._readFile(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/file/list'
        ) {
            return formatResponse(
                request,
                await this._listFiles(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'DELETE' &&
            request.path === '/api/v2/records/file'
        ) {
            return formatResponse(
                request,
                await this._eraseFile(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/file'
        ) {
            return formatResponse(
                request,
                await this._recordFile(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'PUT' &&
            request.path === '/api/v2/records/file'
        ) {
            return formatResponse(
                request,
                await this._updateFile(request),
                this._allowedApiOrigins
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
        } else if (
            request.method === 'DELETE' &&
            request.path === '/api/v2/records/data'
        ) {
            return formatResponse(
                request,
                await this._eraseData(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/data'
        ) {
            return formatResponse(request, await this._getData(request), true);
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/data/list'
        ) {
            return formatResponse(request, await this._listData(request), true);
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/data'
        ) {
            return formatResponse(
                request,
                await this._recordData(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/list'
        ) {
            return formatResponse(
                request,
                await this._listRecords(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/key'
        ) {
            return formatResponse(
                request,
                await this._createRecordKey(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/policy/grantPermission'
        ) {
            return formatResponse(
                request,
                await this._policyGrantPermission(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/policy/revokePermission'
        ) {
            return formatResponse(
                request,
                await this._policyRevokePermission(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/policy'
        ) {
            return formatResponse(
                request,
                await this._policyRead(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/policy/list'
        ) {
            return formatResponse(
                request,
                await this._policyList(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/role/user/list'
        ) {
            return formatResponse(
                request,
                await this._roleUserList(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/role/inst/list'
        ) {
            return formatResponse(
                request,
                await this._roleInstList(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/role/assignments/list'
        ) {
            return formatResponse(
                request,
                await this._roleAssignmentsList(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/role/grant'
        ) {
            return formatResponse(
                request,
                await this._roleGrant(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/role/revoke'
        ) {
            return formatResponse(
                request,
                await this._roleRevoke(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/ai/chat'
        ) {
            return formatResponse(
                request,
                await this._aiChat(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/ai/skybox'
        ) {
            return formatResponse(
                request,
                await this._aiSkybox(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/ai/skybox'
        ) {
            return formatResponse(
                request,
                await this._aiGetSkybox(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/ai/image'
        ) {
            return formatResponse(
                request,
                await this._aiGenerateImage(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/studios'
        ) {
            return formatResponse(
                request,
                await this._getStudio(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/studios'
        ) {
            return formatResponse(
                request,
                await this._postStudio(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'PUT' &&
            request.path === '/api/v2/studios'
        ) {
            return formatResponse(
                request,
                await this._updateStudio(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/studios/list'
        ) {
            return formatResponse(
                request,
                await this._listStudios(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/studios/members/list'
        ) {
            return formatResponse(
                request,
                await this._listStudioMembers(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/studios/members'
        ) {
            return formatResponse(
                request,
                await this._addStudioMember(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'DELETE' &&
            request.path === '/api/v2/studios/members'
        ) {
            return formatResponse(
                request,
                await this._removeStudioMember(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/subscriptions'
        ) {
            return formatResponse(
                request,
                await this._getSubscriptionInfoV2(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/subscriptions/manage'
        ) {
            return formatResponse(
                request,
                await this._manageSubscriptionV2(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/v2/records/insts/list'
        ) {
            return formatResponse(
                request,
                await this._listInsts(request),
                this._allowedApiOrigins
            );
        } else if (
            request.method === 'DELETE' &&
            request.path === '/api/v2/records/insts'
        ) {
            return formatResponse(
                request,
                await this._deleteInst(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'POST' &&
            request.path === '/api/v2/records/insts/report'
        ) {
            return formatResponse(
                request,
                await this._reportInst(request),
                this._allowedApiOrigins
            );
        } else if (request.method === 'GET' && request.path === '/instData') {
            return formatResponse(
                request,
                await this._getInstData(request),
                true
            );
        } else if (request.method === 'OPTIONS') {
            return formatResponse(
                request,
                await this._handleOptions(request),
                true
            );
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
    async handleWebsocketRequest(request: GenericWebsocketRequest) {
        if (!this._websocketController) {
            return;
        }

        let skipRateLimitCheck = false;
        if (!this._rateLimit) {
            skipRateLimitCheck = true;
        } else if (request.type !== 'message') {
            skipRateLimitCheck = true;
        }

        if (!skipRateLimitCheck) {
            const response = await this._rateLimit.checkRateLimit({
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
                        '[RecordsServer] Rate limit check failed. Allowing request to continue.'
                    );
                }
            }
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

    private async _processWebsocketMessage(
        request: GenericWebsocketRequest,
        requestId: number,
        message: WebsocketRequestMessage
    ) {
        const messageResult = websocketRequestMessageSchema.safeParse(message);

        if (messageResult.success === false) {
            await this._sendWebsocketZodError(
                request.connectionId,
                requestId,
                messageResult.error
            );
            return;
        }
        const data = messageResult.data;

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

    private async _isEmailValid(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            email: z.string(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { email } = parseResult.data;
        const result = await this._auth.isValidEmailAddress(email);
        return returnResult(result);
    }

    private async _isDisplayNameValid(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            displayName: DISPLAY_NAME_VALIDATION,
            name: NAME_VALIDATION.optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { displayName, name } = parseResult.data;
        const result = await this._auth.isValidDisplayName(displayName, name);
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

    private async _listRecords(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const validation = await this._validateSessionKey(request);
        if (validation.success === false) {
            if (validation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(validation);
        }

        const schema = z.object({
            studioId: z.string().nonempty().optional(),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { studioId } = parseResult.data;

        if (studioId) {
            const result = await this._records.listStudioRecords(
                studioId,
                validation.userId
            );
            return returnResult(result);
        } else {
            const result = await this._records.listRecords(validation.userId);
            return returnResult(result);
        }
    }

    private async _createRecord(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty.'),
            ownerId: z
                .string({
                    invalid_type_error: 'ownerId must be a string.',
                    required_error: 'ownerId is required.',
                })
                .nonempty('ownerId must not be empty.')
                .optional(),
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
                    required_error: 'studioId is required.',
                })
                .nonempty('studioId must not be empty.')
                .optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, ownerId, studioId } = parseResult.data;

        if (!recordName || typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName is required and must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (validation.success === false) {
            if (validation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(validation);
        }

        const result = await this._records.createRecord({
            recordName,
            ownerId,
            studioId,
            userId: validation.userId,
        });

        return returnResult(result);
    }

    private async _createRecordKey(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordName: z.string({
                invalid_type_error: 'recordName must be a string.',
                required_error: 'recordName is required.',
            }),
            policy: z.string({
                invalid_type_error: 'policy must be a string.',
                required_error: 'policy is required.',
            }),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, policy } = parseResult.data;

        if (!recordName || typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName is required and must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (validation.success === false) {
            if (validation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(validation);
        }

        const result = await this._records.createPublicRecordKey(
            recordName,
            policy as PublicRecordKeyPolicy,
            validation.userId
        );

        return returnResult(result);
    }

    private async _policyGrantPermission(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            marker: z
                .string({
                    invalid_type_error: 'marker must be a string.',
                    required_error: 'marker is required.',
                })
                .nonempty('marker must not be empty'),
            permission: AVAILABLE_PERMISSIONS_VALIDATION,
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, marker, permission, instances } = parseResult.data;

        // const validation = ZOD_PERMISSION_MAP[permission.type as (keyof typeof ZOD_PERMISSION_MAP)];

        // if (!validation) {
        //     const validPermissionTypes = Object.keys(ZOD_PERMISSION_MAP).sort();
        //     return returnResult({
        //         success: false,
        //         errorCode: 'unacceptable_request',
        //         errorMessage: `Permission type not found. type must be one of: ${validPermissionTypes.join(', ')}`,
        //     });
        // }

        // const validationParseResult = validation.safeParse(permission);
        // if (validationParseResult.success === false) {
        //     return returnZodError(validationParseResult.error);
        // }

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._policyController.grantMarkerPermission({
            recordKeyOrRecordName: recordName,
            marker: marker,
            userId: sessionKeyValidation.userId,
            permission: permission as any,
            instances,
        });

        return returnResult(result);
    }

    private async _policyRevokePermission(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            marker: z
                .string({
                    invalid_type_error: 'marker must be a string.',
                    required_error: 'marker is required.',
                })
                .nonempty('marker must not be empty'),
            permission: AVAILABLE_PERMISSIONS_VALIDATION,
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, marker, permission, instances } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._policyController.revokeMarkerPermission({
            recordKeyOrRecordName: recordName,
            marker: marker,
            userId: sessionKeyValidation.userId,
            permission: permission as any,
            instances,
        });

        return returnResult(result);
    }

    private async _policyRead(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            marker: z
                .string({
                    invalid_type_error: 'marker must be a string.',
                    required_error: 'marker is required.',
                })
                .nonempty('marker must not be empty'),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, marker } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._policyController.readUserPolicy(
            recordName,
            sessionKeyValidation.userId,
            marker
        );

        return returnResult(result);
    }

    private async _policyList(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            startingMarker: z
                .string({
                    invalid_type_error: 'startingMarker must be a string.',
                    required_error: 'startingMarker is required.',
                })
                .nonempty('startingMarker must not be empty')
                .optional(),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, startingMarker } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._policyController.listUserPolicies(
            recordName,
            sessionKeyValidation.userId,
            startingMarker
        );

        return returnResult(result);
    }

    private async _roleUserList(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            userId: z
                .string({
                    invalid_type_error: 'userId must be a string.',
                    required_error: 'userId is required.',
                })
                .nonempty('userId must not be empty'),
            instances: z
                .string({
                    invalid_type_error: 'instances must be a string.',
                    required_error: 'instances is required.',
                })
                .nonempty('instances must not be empty')
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, userId, instances } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._policyController.listUserRoles(
            recordName,
            sessionKeyValidation.userId,
            userId,
            instances
        );

        return returnResult(result);
    }

    private async _roleInstList(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            inst: z
                .string({
                    invalid_type_error: 'inst must be a string.',
                    required_error: 'inst is required.',
                })
                .nonempty('inst must not be empty'),
            instances: z
                .string({
                    invalid_type_error: 'instances must be a string.',
                    required_error: 'instances is required.',
                })
                .nonempty('instances must not be empty')
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, inst, instances } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._policyController.listInstRoles(
            recordName,
            sessionKeyValidation.userId,
            inst,
            instances
        );

        return returnResult(result);
    }

    private async _roleAssignmentsList(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
            startingRole: z
                .string({
                    invalid_type_error: 'startingRole must be a string.',
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
            instances: z
                .string({
                    invalid_type_error: 'instances must be a string.',
                    required_error: 'instances is required.',
                })
                .nonempty('instances must not be empty')
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, role, startingRole, instances } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        if (role) {
            const result = await this._policyController.listAssignedRoles(
                recordName,
                sessionKeyValidation.userId,
                role,
                instances
            );

            return returnResult(result);
        } else {
            const result = await this._policyController.listRoleAssignments(
                recordName,
                sessionKeyValidation.userId,
                startingRole,
                instances
            );

            return returnResult(result);
        }
    }

    private async _roleGrant(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
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
                    invalid_type_error: 'expireTimeMs must be a number.',
                    required_error: 'expireTimeMs is required.',
                })
                .positive('expireTimeMs must be positive')
                .optional(),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, userId, inst, expireTimeMs, role, instances } =
            parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
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

        return returnResult(result);
    }

    private async _roleRevoke(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must not be empty'),
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
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, userId, inst, role, instances } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
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

        return returnResult(result);
    }

    private async _aiChat(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._aiController) {
            return returnResult(AI_NOT_SUPPORTED_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            model: z.string().nonempty().optional(),
            messages: z.array(AI_CHAT_MESSAGE_SCHEMA).nonempty(),
            instances: z.array(z.string()).nonempty().optional(),
            temperature: z.number().min(0).max(2).optional(),
            topP: z.number().optional(),
            presencePenalty: z.number().min(-2).max(2).optional(),
            frequencyPenalty: z.number().min(-2).max(2).optional(),
            stopWords: z.array(z.string()).max(4).optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { model, messages, instances, ...options } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._aiController.chat({
            ...options,
            model,
            messages: messages as AIChatMessage[],
            userId: sessionKeyValidation.userId,
            userSubscriptionTier: sessionKeyValidation.subscriptionTier,
        });

        return returnResult(result);
    }

    private async _aiSkybox(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._aiController) {
            return returnResult(AI_NOT_SUPPORTED_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            prompt: z.string().nonempty(),
            negativePrompt: z.string().nonempty().optional(),
            blockadeLabs: z
                .object({
                    skyboxStyleId: z.number().optional(),
                    remixImagineId: z.number().optional(),
                    seed: z.number().optional(),
                })
                .optional(),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { prompt, negativePrompt, instances, blockadeLabs } =
            parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._aiController.generateSkybox({
            prompt,
            negativePrompt,
            blockadeLabs,
            userId: sessionKeyValidation.userId,
            userSubscriptionTier: sessionKeyValidation.subscriptionTier,
        });

        return returnResult(result);
    }

    private async _aiGetSkybox(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._aiController) {
            return returnResult(AI_NOT_SUPPORTED_RESULT);
        }

        const schema = z.object({
            skyboxId: z
                .string({
                    invalid_type_error: 'skyboxId must be a string.',
                    required_error: 'skyboxId is required.',
                })
                .nonempty('skyboxId must not be empty'),
            instances: z
                .string({
                    invalid_type_error: 'instances must be a string.',
                    required_error: 'instances is required.',
                })
                .nonempty('instances must not be empty')
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { skyboxId, instances } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._aiController.getSkybox({
            skyboxId,
            userId: sessionKeyValidation.userId,
            userSubscriptionTier: sessionKeyValidation.subscriptionTier,
        });

        return returnResult(result);
    }

    private async _aiGenerateImage(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._aiController) {
            return returnResult(AI_NOT_SUPPORTED_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
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
            instances: z.array(z.string().nonempty()).optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const {
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
        } = parseResult.data;

        console.log('got request', request);
        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
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
            userSubscriptionTier: sessionKeyValidation.subscriptionTier,
        });

        return returnResult(result);
    }

    private async _getStudio(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
                    required_error: 'studioId is required.',
                })
                .min(1)
                .max(128),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { studioId } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._records.getStudio(
            studioId,
            sessionKeyValidation.userId
        );
        return returnResult(result);
    }

    private async _postStudio(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            displayName: z
                .string({
                    invalid_type_error: 'displayName must be a string.',
                    required_error: 'displayName is required.',
                })
                .nonempty('displayName must not be empty'),
            ownerStudioComId: z
                .string({
                    invalid_type_error: 'ownerStudioComId must be a string.',
                    required_error: 'ownerStudioComId is required.',
                })
                .nonempty('ownerStudioComId must not be empty')
                .optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { displayName, ownerStudioComId } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        if (!ownerStudioComId) {
            const result = await this._records.createStudio(
                displayName,
                sessionKeyValidation.userId
            );
            return returnResult(result);
        } else {
            const result = await this._records.createStudioInComId(
                displayName,
                sessionKeyValidation.userId,
                ownerStudioComId
            );
            return returnResult(result);
        }
    }

    private async _updateStudio(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            id: z
                .string({
                    invalid_type_error: 'id must be a string.',
                    required_error: 'id is required.',
                })
                .min(1)
                .max(128),
            displayName: z
                .string({
                    invalid_type_error: 'displayName must be a string.',
                    required_error: 'displayName is required.',
                })
                .nonempty('displayName must not be empty'),
            logoUrl: z
                .string({
                    invalid_type_error: 'logoUrl must be a string.',
                    required_error: 'logoUrl is required.',
                })
                .url()
                .optional(),
            comIdConfig: COM_ID_CONFIG_SCHEMA.optional(),
            playerConfig: COM_ID_PLAYER_CONFIG.optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { id, displayName, logoUrl, comIdConfig, playerConfig } =
            parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._records.updateStudio({
            userId: sessionKeyValidation.userId,
            studio: {
                id,
                displayName,
                logoUrl,
                comIdConfig,
                playerConfig,
            },
        });
        return returnResult(result);
    }

    private async _listStudios(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            comId: z.string().nonempty().optional(),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { comId } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        if (comId) {
            const result = await this._records.listStudiosByComId(
                sessionKeyValidation.userId,
                comId
            );
            return returnResult(result);
        } else {
            const result = await this._records.listStudios(
                sessionKeyValidation.userId
            );
            return returnResult(result);
        }
    }

    private async _listStudioMembers(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
                    required_error: 'studioId is required.',
                })
                .nonempty('studioId must not be empty'),
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { studioId } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._records.listStudioMembers(
            studioId,
            sessionKeyValidation.userId
        );
        return returnResult(result);
    }

    private async _addStudioMember(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
                    required_error: 'studioId is required.',
                })
                .nonempty('studioId must not be empty'),
            addedUserId: z
                .string({
                    invalid_type_error: 'addedUserId must be a string.',
                    required_error: 'addedUserId is required.',
                })
                .nonempty('addedUserId must not be empty')
                .optional(),
            addedEmail: z
                .string({
                    invalid_type_error: 'addedEmail must be a string.',
                    required_error: 'addedEmail is required.',
                })
                .nonempty('addedEmail must not be empty')
                .optional(),
            addedPhoneNumber: z
                .string({
                    invalid_type_error: 'addedPhoneNumber must be a string.',
                    required_error: 'addedPhoneNumber is required.',
                })
                .nonempty('addedPhoneNumber must not be empty')
                .optional(),
            role: z.union([z.literal('admin'), z.literal('member')]),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { studioId, addedUserId, addedEmail, addedPhoneNumber, role } =
            parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._records.addStudioMember({
            studioId,
            userId: sessionKeyValidation.userId,
            role,
            addedUserId,
            addedEmail,
            addedPhoneNumber,
        });
        return returnResult(result);
    }

    private async _removeStudioMember(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
                    required_error: 'studioId is required.',
                })
                .nonempty('studioId must not be empty'),
            removedUserId: z
                .string({
                    invalid_type_error: 'removedUserId must be a string.',
                    required_error: 'removedUserId is required.',
                })
                .nonempty('removedUserId must not be empty')
                .optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { studioId, removedUserId } = parseResult.data;

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (sessionKeyValidation.success === false) {
            if (sessionKeyValidation.errorCode === 'no_session_key') {
                return returnResult(NOT_LOGGED_IN_RESULT);
            }
            return returnResult(sessionKeyValidation);
        }

        const result = await this._records.removeStudioMember({
            studioId,
            userId: sessionKeyValidation.userId,
            removedUserId,
        });
        return returnResult(result);
    }

    private async _listData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const schema = z.object({
            recordName: z
                .string({
                    required_error: 'recordName is required.',
                    invalid_type_error: 'recordName must be a string.',
                })
                .nonempty('recordName must not be empty'),
            address: z.union([z.string(), z.null()]).optional(),
            instances: z
                .string({
                    invalid_type_error: 'instances must be a string.',
                    required_error: 'instances is required.',
                })
                .nonempty('instances must not be empty')
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, address, instances } = parseResult.data;

        if (!recordName || typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName is required and must be a string.',
            });
        }
        if (
            address !== null &&
            typeof address !== 'undefined' &&
            typeof address !== 'string'
        ) {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address must be null or a string.',
            });
        }

        const sessionKeyValidation = await this._validateSessionKey(request);
        if (
            sessionKeyValidation.success === false &&
            sessionKeyValidation.errorCode !== 'no_session_key'
        ) {
            return returnResult(sessionKeyValidation);
        }

        const result = await this._data.listData(
            recordName,
            address || null,
            sessionKeyValidation.userId,
            instances
        );
        return returnResult(result);
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
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            fileSha256Hex: z
                .string({
                    invalid_type_error: 'fileSha256Hex must be a string.',
                    required_error: 'fileSha256Hex is required.',
                })
                .nonempty('fileSha256Hex must be non-empty.'),
            fileByteLength: z
                .number({
                    invalid_type_error:
                        'fileByteLength must be a positive integer number.',
                    required_error: 'fileByteLength is required.',
                })
                .positive('fileByteLength must be a positive integer number.')
                .int('fileByteLength must be a positive integer number.'),
            fileMimeType: z.string({
                invalid_type_error: 'fileMimeType must be a string.',
                required_error: 'fileMimeType is required.',
            }),
            fileDescription: z
                .string({
                    invalid_type_error: 'fileDescription must be a string.',
                    required_error: 'fileDescription is required.',
                })
                .optional(),
            markers: z
                .array(z.string(), {
                    invalid_type_error: 'markers must be an array of strings.',
                    required_error: 'markers is required.',
                })
                .nonempty('markers must be non-empty.')
                .optional(),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const {
            recordKey,
            fileSha256Hex,
            fileByteLength,
            fileMimeType,
            fileDescription,
            markers,
            instances,
        } = parseResult.data;

        if (!recordKey || typeof recordKey !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            });
        }
        if (!fileSha256Hex || typeof fileSha256Hex !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileSha256Hex is required and must be a string.',
            });
        }
        if (!fileByteLength || typeof fileByteLength !== 'number') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'fileByteLength is required and must be a number.',
            });
        }
        if (!fileMimeType || typeof fileMimeType !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileMimeType is required and must be a string.',
            });
        }
        if (!!fileDescription && typeof fileDescription !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileDescription must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
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

        return returnResult(result);
    }

    private async _updateFile(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            fileUrl: z
                .string({
                    invalid_type_error: 'fileUrl must be a string.',
                    required_error: 'fileUrl is required.',
                })
                .nonempty('fileUrl must be non-empty.'),
            markers: z
                .array(z.string(), {
                    invalid_type_error: 'markers must be an array of strings.',
                    required_error: 'markers is required.',
                })
                .nonempty('markers must be non-empty.'),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }
        const userId = validation.userId;

        const fileNameResult = await this._files.getFileNameFromUrl(
            parseResult.data.fileUrl
        );

        if (!fileNameResult.success) {
            return returnResult(fileNameResult);
        }

        const result = await this._files.updateFile(
            parseResult.data.recordKey,
            fileNameResult.fileName,
            userId,
            parseResult.data.markers,
            parseResult.data.instances
        );
        return returnResult(result);
    }

    private async _readFile(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must be non-empty.')
                .optional(),
            fileName: z
                .string({
                    invalid_type_error: 'fileName must be a string.',
                    required_error: 'fileName is required.',
                })
                .nonempty('fileName must be non-empty.')
                .optional(),
            fileUrl: z
                .string({
                    invalid_type_error: 'fileUrl must be a string.',
                    required_error: 'fileUrl is required.',
                })
                .nonempty('fileUrl must be non-empty.')
                .optional(),
            instances: z
                .string()
                .nonempty()
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        let { fileUrl, recordName, fileName, instances } = parseResult.data;

        if (!!fileUrl && typeof fileUrl !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileUrl must be a string.',
            });
        }
        if (!!recordName && typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName must be a string.',
            });
        }
        if (!!fileName && typeof fileName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileName must be a string.',
            });
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
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: message,
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }
        const userId = validation.userId;

        if (!!fileUrl) {
            const fileNameResult = await this._files.getFileNameFromUrl(
                fileUrl
            );

            if (!fileNameResult.success) {
                return returnResult(fileNameResult);
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
        return returnResult(result);
    }

    private async _listFiles(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must be non-empty.'),
            fileName: z
                .string({
                    invalid_type_error: 'fileName must be a string.',
                    required_error: 'fileName is required.',
                })
                .nonempty('fileName must be non-empty.')
                .optional(),
            instances: z
                .string()
                .nonempty()
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        let { recordName, fileName, instances } = parseResult.data;

        if (!!recordName && typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName must be a string.',
            });
        }
        if (!!fileName && typeof fileName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileName must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }
        const userId = validation.userId;

        const result = await this._files.listFiles(
            recordName,
            fileName,
            userId,
            instances
        );
        return returnResult(result);
    }

    private async _eraseFile(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            fileUrl: z.string({
                invalid_type_error: 'fileUrl must be a string.',
                required_error: 'fileUrl is required.',
            }),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, fileUrl, instances } = parseResult.data;

        if (!recordKey || typeof recordKey !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            });
        }

        if (!fileUrl || typeof fileUrl !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileUrl is required and must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }
        const userId = validation.userId;

        const fileNameResult = await this._files.getFileNameFromUrl(fileUrl);

        if (!fileNameResult.success) {
            return returnResult(fileNameResult);
        }

        const result = await this._files.eraseFile(
            recordKey,
            fileNameResult.fileName,
            userId,
            instances
        );
        return returnResult(result);
    }

    private async _baseRecordData(
        request: GenericHttpRequest,
        controller: DataRecordsController
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            address: ADDRESS_VALIDATION,
            data: z.any(),
            updatePolicy: z
                .union([z.literal(true), z.array(z.string())], {
                    invalid_type_error:
                        'updatePolicy must be a boolean or an array of strings.',
                })
                .optional(),
            deletePolicy: z
                .union([z.literal(true), z.array(z.string())], {
                    invalid_type_error:
                        'deletePolicy must be a boolean or an array of strings.',
                })
                .optional(),
            markers: MARKERS_VALIDATION.optional(),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const {
            recordKey,
            address,
            data,
            updatePolicy,
            deletePolicy,
            markers,
            instances,
        } = parseResult.data;

        if (!recordKey || typeof recordKey !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            });
        }
        if (!address || typeof address !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address is required and must be a string.',
            });
        }
        if (typeof data === 'undefined') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'data is required.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
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
        return returnResult(result);
    }

    private async _recordData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        return this._baseRecordData(request, this._data);
    }

    private _manualRecordData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        return this._baseRecordData(request, this._manualData);
    }

    private async _baseGetRecordData(
        request: GenericHttpRequest,
        controller: DataRecordsController
    ): Promise<GenericHttpResponse> {
        const schema = z.object({
            recordName: z
                .string({
                    required_error: 'recordName is required.',
                    invalid_type_error: 'recordName must be a string.',
                })
                .nonempty('recordName must not be empty'),
            address: z
                .string({
                    required_error: 'address is required.',
                    invalid_type_error: 'address must be a string.',
                })
                .nonempty('address must not be empty'),
            instances: z
                .string({
                    invalid_type_error: 'instances must be a string.',
                    required_error: 'instances is required.',
                })
                .nonempty('instances must not be empty')
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, address, instances } = parseResult.data;

        if (!recordName || typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName is required and must be a string.',
            });
        }
        if (!address || typeof address !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address is required and must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }

        const result = await controller.getData(
            recordName,
            address,
            validation.userId,
            instances
        );
        return returnResult(result);
    }

    private _getData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        return this._baseGetRecordData(request, this._data);
    }

    private _getManualRecordData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        return this._baseGetRecordData(request, this._manualData);
    }

    private async _baseEraseRecordData(
        request: GenericHttpRequest,
        controller: DataRecordsController
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            address: ADDRESS_VALIDATION,
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, address, instances } = parseResult.data;

        if (!recordKey || typeof recordKey !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            });
        }
        if (!address || typeof address !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'address is required and must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }

        const userId = validation.userId;
        const result = await controller.eraseData(
            recordKey,
            address,
            userId,
            instances
        );
        return returnResult(result);
    }

    private _eraseData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        return this._baseEraseRecordData(request, this._data);
    }

    private _eraseManualRecordData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        return this._baseEraseRecordData(request, this._manualData);
    }

    private async _getRecordsEventsCount(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const schema = z.object({
            recordName: z
                .string({
                    required_error: 'recordName is required.',
                    invalid_type_error: 'recordName must be a string.',
                })
                .nonempty('recordName must not be empty'),
            eventName: z
                .string({
                    required_error: 'eventName is required.',
                    invalid_type_error: 'eventName must be a string.',
                })
                .nonempty('eventName must not be empty'),
            instances: z
                .string()
                .nonempty()
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, eventName, instances } = parseResult.data;

        if (!recordName || typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName is required and must be a string.',
            });
        }
        if (!eventName || typeof eventName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'eventName is required and must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);

        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }

        const userId = validation.userId;
        const result = await this._events.getCount(
            recordName,
            eventName,
            userId,
            instances
        );
        return returnResult(result);
    }

    private async _postRecordsEventsCount(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            eventName: EVENT_NAME_VALIDATION,
            count: z.number({
                invalid_type_error: 'count must be a number.',
                required_error: 'count is required.',
            }),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, eventName, count, instances } = parseResult.data;

        if (!recordKey || typeof recordKey !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            });
        }
        if (!eventName || typeof eventName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'eventName is required and must be a string.',
            });
        }
        if (typeof count !== 'number') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'count is required and must be a number.',
            });
        }

        const validation = await this._validateSessionKey(request);

        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }

        const userId = validation.userId;

        const result = await this._events.addCount(
            recordKey,
            eventName,
            count,
            userId,
            instances
        );

        return returnResult(result);
    }

    private async _listEvents(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const schema = z.object({
            recordName: z
                .string({
                    invalid_type_error: 'recordName must be a string.',
                    required_error: 'recordName is required.',
                })
                .nonempty('recordName must be non-empty.'),
            eventName: z
                .string({
                    invalid_type_error: 'eventName must be a string.',
                    required_error: 'eventName is required.',
                })
                .nonempty('eventName must be non-empty.')
                .optional(),
            instances: z
                .string()
                .nonempty()
                .optional()
                .transform((value) => parseInstancesList(value)),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        let { recordName, eventName, instances } = parseResult.data;

        if (!!recordName && typeof recordName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordName must be a string.',
            });
        }
        if (!!eventName && typeof eventName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'fileName must be a string.',
            });
        }

        const validation = await this._validateSessionKey(request);
        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
        }
        const userId = validation.userId;

        const result = await this._events.listEvents(
            recordName,
            eventName,
            userId,
            instances
        );
        return returnResult(result);
    }

    private async _postRecordsEvents(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            recordKey: RECORD_KEY_VALIDATION,
            eventName: EVENT_NAME_VALIDATION,
            count: z.number().optional(),
            markers: MARKERS_VALIDATION.optional(),
            instances: z.array(z.string()).nonempty().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, eventName, count, markers, instances } =
            parseResult.data;

        if (!recordKey || typeof recordKey !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'recordKey is required and must be a string.',
            });
        }
        if (!eventName || typeof eventName !== 'string') {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'eventName is required and must be a string.',
            });
        }
        if (
            count !== null &&
            typeof count !== 'undefined' &&
            typeof count !== 'number'
        ) {
            return returnResult({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'count must be a number.',
            });
        }

        const validation = await this._validateSessionKey(request);

        if (
            validation.success === false &&
            validation.errorCode !== 'no_session_key'
        ) {
            return returnResult(validation);
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

        return returnResult(result);
    }

    private async _postMeetToken(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            roomName: z.string(),
            userName: z.string(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { roomName, userName } = parseResult.data;
        const result = await this._livekit.issueToken(roomName, userName);

        return returnResult(result);
    }

    private async _postLogin(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const { address, addressType } = jsonResult.value;

        const result = await this._auth.requestLogin({
            address,
            addressType,
            ipAddress: request.ipAddress,
        });

        return returnResult(result);
    }

    private async _privoLogin(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const result = await this._auth.requestOpenIDLogin({
            provider: PRIVO_OPEN_ID_PROVIDER,
            ipAddress: request.ipAddress,
        });

        return returnResult(result);
    }

    private async _oauthProvideCode(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            code: z.string().nonempty(),
            state: z.string().nonempty(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { code, state } = parseResult.data;

        const result = await this._auth.processOpenIDAuthorizationCode({
            ipAddress: request.ipAddress,
            authorizationCode: code,
            state,
        });

        return returnResult(result);
    }

    private async _oauthCompleteLogin(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            requestId: z.string().nonempty(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { requestId } = parseResult.data;

        const result = await this._auth.completeOpenIDLogin({
            ipAddress: request.ipAddress,
            requestId,
        });

        return returnResult(result);
    }

    private async _registerPrivo(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            email: z.string().min(1).email().optional(),
            parentEmail: z.string().min(1).email().optional(),
            name: NAME_VALIDATION,
            dateOfBirth: z.coerce.date(),
            displayName: DISPLAY_NAME_VALIDATION,
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { email, parentEmail, name, dateOfBirth, displayName } =
            parseResult.data;

        const result = await this._auth.requestPrivoSignUp({
            email,
            parentEmail,
            name,
            dateOfBirth,
            displayName,
            ipAddress: request.ipAddress,
        });

        return returnResult(result);
    }

    private async _postCompleteLogin(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            userId: z.string(),
            requestId: z.string(),
            code: z.string(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { userId, requestId, code } = parseResult.data;

        const result = await this._auth.completeLogin({
            userId,
            requestId,
            code,
            ipAddress: request.ipAddress,
        });

        return returnResult(result);
    }

    private async _postRevokeSession(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            userId: z.string().optional(),
            sessionId: z.string().optional(),
            sessionKey: z.string().optional(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        let {
            userId,
            sessionId,
            sessionKey: sessionKeyToRevoke,
        } = parseResult.data;

        // Parse the User ID and Session ID from the sessionKey that is provided in
        // session key that should be revoked
        if (!!sessionKeyToRevoke) {
            const parsed = parseSessionKey(sessionKeyToRevoke);
            if (parsed) {
                userId = parsed[0];
                sessionId = parsed[1];
            }
        }

        const authorization = getSessionKey(request);

        if (!authorization) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const result = await this._auth.revokeSession({
            userId,
            sessionId,
            sessionKey: authorization,
        });

        return returnResult(result);
    }

    private async _postRevokeAllSessions(request: GenericHttpRequest) {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            userId: z.string(),
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { userId } = parseResult.data;

        const authorization = getSessionKey(request);

        if (!authorization) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const result = await this._auth.revokeAllSessions({
            userId: userId,
            sessionKey: authorization,
        });

        return returnResult(result);
    }

    private async _postReplaceSession(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

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

    private async _getSessions(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        const expireTime = request.query.expireTimeMs;
        const expireTimeMs = !!expireTime ? parseInt(expireTime) : null;
        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const parsed = parseSessionKey(sessionKey);

        if (!parsed) {
            return returnResult(UNACCEPTABLE_SESSION_KEY);
        }

        const [userId] = parsed;

        const result = await this._auth.listSessions({
            userId,
            sessionKey,
            expireTimeMs,
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

    private async _getSubscriptionInfoV2(
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

        const schema = z.object({
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
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
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { studioId, userId } = parseResult.data;

        const result = await this._subscriptions.getSubscriptionStatus({
            sessionKey,
            userId,
            studioId,
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

    private async _manageSubscriptionV2(
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

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const schema = z.object({
            userId: z
                .string({
                    invalid_type_error: 'userId must be a string.',
                    required_error: 'userId is required.',
                })
                .nonempty('userId must not be empty.')
                .optional(),
            studioId: z
                .string({
                    invalid_type_error: 'studioId must be a string.',
                    required_error: 'studioId is required.',
                })
                .nonempty('studioId must not be empty.')
                .optional(),
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

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { userId, studioId, subscriptionId, expectedPrice } =
            parseResult.data;

        const result = await this._subscriptions.createManageSubscriptionLink({
            sessionKey,
            userId,
            studioId,
            subscriptionId,
            expectedPrice:
                expectedPrice as CreateManageSubscriptionRequest['expectedPrice'],
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            url: result.url,
        });
    }

    private async _listInsts(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._websocketController) {
            return returnResult(INSTS_NOT_SUPPORTED_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const schema = z.object({
            recordName: z.string().nonempty().optional(),
            inst: z.string().optional(),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, inst } = parseResult.data;

        const validation = await this._validateSessionKey(request);

        if (validation.success === false) {
            return returnResult(validation);
        }

        const userId = validation.userId;

        const result = await this._websocketController.listInsts(
            recordName,
            userId,
            inst
        );
        return returnResult(result);
    }

    private async _deleteInst(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedAccountOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._websocketController) {
            return returnResult(INSTS_NOT_SUPPORTED_RESULT);
        }

        const sessionKey = getSessionKey(request);

        if (!sessionKey) {
            return returnResult(NOT_LOGGED_IN_RESULT);
        }

        const schema = z.object({
            recordKey: z.string().nonempty().optional(),
            recordName: z.string().nonempty().optional(),
            inst: z.string().optional(),
        });

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, recordName, inst } = parseResult.data;

        const validation = await this._validateSessionKey(request);

        if (validation.success === false) {
            return returnResult(validation);
        }

        const result = await this._websocketController.eraseInst(
            recordKey ?? recordName,
            inst,
            validation.userId
        );
        return returnResult(result);
    }

    private async _reportInst(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        if (!validateOrigin(request, this._allowedApiOrigins)) {
            return returnResult(INVALID_ORIGIN_RESULT);
        }

        if (!this._moderationController) {
            return returnResult(MODERATION_NOT_SUPPORTED_RESULT);
        }

        const schema = z.object({
            recordName: z.string().nonempty().nullable(),
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
        });

        if (typeof request.body !== 'string') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const jsonResult = tryParseJson(request.body);

        if (!jsonResult.success || typeof jsonResult.value !== 'object') {
            return returnResult(UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON);
        }

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const validation = await this._validateSessionKey(request);

        if (validation.success === false) {
            if (validation.errorCode !== 'no_session_key') {
                return returnResult(validation);
            }
        }

        const {
            recordName,
            inst,
            automaticReport,
            reportReason,
            reportReasonText,
            reportedUrl,
            reportedPermalink,
        } = parseResult.data;

        const result = await this._moderationController.reportInst({
            recordName,
            inst,
            automaticReport,
            reportReason,
            reportReasonText,
            reportedUrl,
            reportedPermalink,
            reportingIpAddress: request.ipAddress,
            reportingUserId: validation.userId,
        });

        return returnResult(result);
    }

    private async _getInstData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        let userId: string = null;
        const validation = await this._validateSessionKey(request);
        if (validation.success === false) {
            if (validation.errorCode === 'no_session_key') {
                userId = null;
            } else {
                return returnResult(validation);
            }
        } else {
            userId = validation.userId;
        }

        const schema = z.object({
            recordName: z.string().nonempty().nullable().optional(),
            inst: z.string().nonempty(),
            branch: z.string().nonempty().default(DEFAULT_BRANCH_NAME),
        });

        const parseResult = schema.safeParse(request.query || {});

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, inst, branch } = parseResult.data;

        const data = await this._websocketController.getBranchData(
            userId,
            recordName ?? null,
            inst,
            branch
        );

        return returnResult({
            success: true,
            ...data,
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
        event: GenericHttpRequest
    ): Promise<ValidateSessionKeyResult | NoSessionKeyResult> {
        const sessionKey = getSessionKey(event);
        if (!sessionKey) {
            return {
                success: false,
                userId: null,
                errorCode: 'no_session_key',
                errorMessage:
                    'A session key was not provided, but it is required for this operation.',
            };
        }
        return await this._auth.validateSessionKey(sessionKey);
    }
}

export function returnResult<
    T extends { success: false; errorCode: KnownErrorCodes } | { success: true }
>(result: T): GenericHttpResponse {
    return {
        statusCode: getStatusCode(result),
        body: JSON.stringify(result),
    };
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

export interface NoSessionKeyResult {
    success: false;
    userId: null;
    errorCode: 'no_session_key';
    errorMessage: string;
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
