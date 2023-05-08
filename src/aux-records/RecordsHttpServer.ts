import { getStatusCode, tryDecodeUriComponent, tryParseJson } from './Utils';
import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    INVALID_REQUEST_ERROR_MESSAGE,
    MAX_EMAIL_ADDRESS_LENGTH,
    MAX_OPEN_AI_API_KEY_LENGTH,
    MAX_SMS_ADDRESS_LENGTH,
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
import { z } from 'zod';
import { PublicRecordKeyPolicy } from './RecordsStore';
import { RateLimitController } from './RateLimitController';
import { AVAILABLE_PERMISSIONS_VALIDATION } from './PolicyPermissions';
import { PolicyController } from './PolicyController';

/**
 * Defines an interface for a generic HTTP request.
 */
export interface GenericHttpRequest {
    /**
     * The path that the HTTP request is for.
     * Does not include the query string parameters.
     */
    path: string;

    /**
     * The query string parameters.
     */
    query: GenericQueryStringParameters;

    /**
     * The path parameters.
     * i.e. These are parameters that are calculated from the path of the
     */
    pathParams: GenericPathParameters;

    /**
     * The method that the HTTP request uses.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
     */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';

    /**
     * The headers for the request.
     */
    headers: GenericHttpHeaders;

    /**
     * The body of the HTTP request.
     */
    body: string | Uint8Array | null;

    /**
     * The IP address that the request is from.
     */
    ipAddress: string;
}

/**
 * Defines an interface for a generic HTTP response.
 */
export interface GenericHttpResponse {
    /**
     * The status code for the response.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
     *
     */
    statusCode: number;

    /**
     * The list of headers to include in the response.
     */
    headers?: GenericHttpHeaders;

    /**
     * The body of the response.
     */
    body?: string | null;
}

export interface GenericHttpHeaders {
    [key: string]: string;
}

export interface GenericQueryStringParameters {
    [key: string]: string;
}

export interface GenericPathParameters {
    [key: string]: string;
}

const NOT_LOGGED_IN_RESULT = {
    success: false as const,
    errorCode: 'not_logged_in' as const,
    errorMessage:
        'The user is not logged in. A session key must be provided for this operation.' as const,
};

const UNACCEPTABLE_SESSION_KEY = {
    success: false,
    errorCode: 'unacceptable_session_key',
    errorMessage:
        'The given session key is invalid. It must be a correctly formatted string.',
};

const UNACCEPTABLE_USER_ID = {
    success: false,
    errorCode: 'unacceptable_user_id',
    errorMessage:
        'The given user ID is invalid. It must be a correctly formatted string.',
};

const INVALID_ORIGIN_RESULT = {
    success: false,
    errorCode: 'invalid_origin',
    errorMessage: 'The request must be made from an authorized origin.',
};

const OPERATION_NOT_FOUND_RESULT = {
    success: false,
    errorCode: 'operation_not_found',
    errorMessage: 'An operation could not be found for the given request.',
};

const UNACCEPTABLE_REQUEST_RESULT_MUST_BE_JSON = {
    success: false,
    errorCode: 'unacceptable_request',
    errorMessage:
        'The request body was not properly formatted. It should be valid JSON.',
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

/**
 * Defines a class that represents a generic HTTP server suitable for Records HTTP Requests.
 */
export class RecordsHttpServer {
    private _auth: AuthController;
    private _livekit: LivekitController;
    private _records: RecordsController;
    private _events: EventRecordsController;
    private _data: DataRecordsController;
    private _manualData: DataRecordsController;
    private _files: FileRecordsController;
    private _subscriptions: SubscriptionController;

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
        subscriptionController: SubscriptionController,
        rateLimitController: RateLimitController,
        policyController: PolicyController
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
    }

    /**
     * Handles the given request and returns the specified response.
     * @param request The request that should be handled.
     */
    async handleRequest(
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
                        '[RecordsHttpServer] Rate limit check failed. Allowing request to continue.'
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
            request.path === '/api/v2/meet/token'
        ) {
            return formatResponse(
                request,
                await this._postMeetToken(request),
                this._allowedApiOrigins
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

    private async _stripeWebhook(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        let body: string = null;
        if (typeof request.body === 'string') {
            body = request.body;
        } else if (ArrayBuffer.isView(request.body)) {
            try {
                const decoder = new TextDecoder();
                body = decoder.decode(request.body);
            } catch (err) {
                console.log(
                    '[RecordsHttpServer] Unable to decode request body!',
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
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, marker, permission } = parseResult.data;

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
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, marker, permission } = parseResult.data;

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
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, userId } = parseResult.data;

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
            userId
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
        });

        const parseResult = schema.safeParse(request.query);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordName, inst } = parseResult.data;

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
            inst
        );

        return returnResult(result);
    }

    private async _listData(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        const { recordName, address } = request.query || {};

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

        const result = await this._data.listData(recordName, address || null);
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
            parseResult.data.markers
        );
        return returnResult(result);
    }

    private async _readFile(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
        let { fileUrl, recordName, fileName } = request.query || {};

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

        const result = await this._files.readFile(recordName, fileName, userId);
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
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, fileUrl } = parseResult.data;

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
            userId
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
            markers
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
        const { recordName, address } = request.query || {};

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

        const result = await controller.getData(recordName, address);
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
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, address } = parseResult.data;

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
        const result = await controller.eraseData(recordKey, address, userId);
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

        const { recordName, eventName } = request.query || {};

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
            userId
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
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, eventName, count } = parseResult.data;

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
            userId
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
        });

        const parseResult = schema.safeParse(jsonResult.value);

        if (parseResult.success === false) {
            return returnZodError(parseResult.error);
        }

        const { recordKey, eventName, count, markers } = parseResult.data;

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
            })),
            purchasableSubscriptions: result.purchasableSubscriptions.map(
                (s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    featureList: s.featureList,
                    prices: s.prices,
                })
            ),
        });
    }

    private async _manageSubscription(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
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
                    subscriptionId: z.string(),
                    expectedPrice: z
                        .object({
                            currency: z.string(),
                            cost: z.number(),
                            interval: z.enum(['month', 'year', 'week', 'day']),
                            intervalLength: z.number(),
                        })
                        .required(),
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
            openAiKey: result.openAiKey,
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
            name: z.string().min(1).optional(),
            email: z.string().email().max(MAX_EMAIL_ADDRESS_LENGTH).optional(),
            phoneNumber: z.string().max(MAX_SMS_ADDRESS_LENGTH).optional(),
            avatarUrl: z.string().url().optional(),
            avatarPortraitUrl: z.string().url().optional(),
            openAiKey: z.string().max(MAX_OPEN_AI_API_KEY_LENGTH).optional(),
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
    T extends { success: false; errorCode: string } | { success: true }
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
export function parseAuthorization(authorization: string): string {
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
