import { getStatusCode, tryDecodeUriComponent, tryParseJson } from './Utils';
import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    INVALID_REQUEST_ERROR_MESSAGE,
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
        subscriptionController: SubscriptionController
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
    }

    /**
     * Handles the given request and returns the specified response.
     * @param request The request that should be handled.
     */
    async handleRequest(
        request: GenericHttpRequest
    ): Promise<GenericHttpResponse> {
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
            request.path === '/api/emailRules'
        ) {
            return formatResponse(
                request,
                await this._getEmailRules(request),
                this._allowedAccountOrigins
            );
        } else if (
            request.method === 'GET' &&
            request.path === '/api/smsRules'
        ) {
            return formatResponse(
                request,
                await this._getSmsRules(request),
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

        const { recordName, policy } = jsonResult.value;

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
            policy,
            validation.userId
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

        const {
            recordKey,
            fileSha256Hex,
            fileByteLength,
            fileMimeType,
            fileDescription,
        } = jsonResult.value;

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

        const { recordKey, fileUrl } = jsonResult.value;

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

        const { recordKey, address, data, updatePolicy, deletePolicy } =
            jsonResult.value;

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
            deletePolicy
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

        const { recordKey, address } = jsonResult.value;

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

        const result = await this._events.getCount(recordName, eventName);
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

        const { recordKey, eventName, count } = jsonResult.value;

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

        const { roomName, userName } = jsonResult.value;
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

        const { userId, requestId, code } = jsonResult.value;

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

        let {
            userId,
            sessionId,
            sessionKey: sessionKeyToRevoke,
        } = jsonResult.value;

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

        const { userId } = jsonResult.value;

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
                if (typeof body.value.subscriptionId === 'string') {
                    subscriptionId = body.value.subscriptionId;
                }
                if (typeof body.value.expectedPrice === 'object') {
                    expectedPrice = body.value.expectedPrice;
                }
            }
        }

        console.log('sub id', subscriptionId);
        console.log('expected price', expectedPrice);

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

        const result = await this._auth.updateUserInfo({
            sessionKey: sessionKey,
            userId: userId,
            update: jsonResult.value,
        });

        if (!result.success) {
            return returnResult(result);
        }

        return returnResult({
            success: true,
            userId: result.userId,
        });
    }

    private async _getEmailRules(request: GenericHttpRequest) {
        const result = await this._auth.listEmailRules();

        if (!result.success) {
            return returnResult(result);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(
                result.rules.map((rule) => ({
                    type: rule.type,
                    pattern: rule.pattern,
                }))
            ),
        };
    }

    private async _getSmsRules(request: GenericHttpRequest) {
        const result = await this._auth.listSmsRules();

        if (!result.success) {
            return returnResult(result);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(
                result.rules.map((rule) => ({
                    type: rule.type,
                    pattern: rule.pattern,
                }))
            ),
        };
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
