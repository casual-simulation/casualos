import {
    ActionKinds,
    BotsState,
    DenialReason,
    GenericHttpRequest,
    GenericHttpResponse,
    getBotsStateFromStoredAux,
    ServerError,
    StoredAux,
} from '@casual-simulation/aux-common';
import {
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
    ConstructAuthorizationContextFailure,
    AuthorizeSubjectFailure,
    AuthorizeSubject,
    AuthorizationContext,
} from '../PolicyController';
import {
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsResult,
    CrudListItemsResult,
    CrudRecordsConfiguration,
    CrudRecordsController,
} from '../crud/CrudRecordsController';
import {
    WebhookInfoFile,
    WebhookRecord,
    WebhookRecordsStore,
    WebhookRunInfo,
    WebhookSubscriptionMetrics,
} from './WebhookRecordsStore';
import { getWebhookFeatures } from '../SubscriptionConfiguration';
import { traced } from '../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
    HandleHttpRequestFailure,
    HandleHttpRequestResult,
    STORED_AUX_SCHEMA,
    WebhookEnvironment,
    WebhookState,
} from './WebhookEnvironment';
import {
    DataRecordsConfiguration,
    DataRecordsController,
    GetDataFailure,
    GetDataResult,
} from '../DataRecordsController';
import {
    FileRecordsController,
    ReadFileFailure,
    ReadFileResult,
} from '../FileRecordsController';
import { tryParseJson } from '../Utils';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import { sha256 } from 'hash.js';
import axios from 'axios';
import { AuthController } from '../AuthController';
import { getHash } from '@casual-simulation/crypto';

const TRACE_NAME = 'WebhookRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface WebhookRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<WebhookRecord, WebhookRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    /**
     * The environment that should be used to handle webhooks.
     */
    environment: WebhookEnvironment;

    /**
     * The controller that should be used to get data records.
     */
    data: DataRecordsController;

    /**
     * The controller that should be used to get file records.
     */
    files: FileRecordsController;

    /**
     * The controller that should be used to for auth-related operations.
     */
    auth: AuthController;
}

/**
 * Defines a controller that is able to handle and execute webhooks.
 */
export class WebhookRecordsController extends CrudRecordsController<
    WebhookRecord,
    WebhookRecordsStore
> {
    private _environment: WebhookEnvironment;
    private _data: DataRecordsController;
    private _files: FileRecordsController;
    private _auth: AuthController;

    constructor(config: WebhookRecordsConfiguration) {
        super({
            ...config,
            resourceKind: 'webhook',
            name: 'WebhookRecordsController',
        });
        this._environment = config.environment;
        this._data = config.data;
        this._files = config.files;
        this._auth = config.auth;
    }

    /**
     * Handles a webhook request.
     * @param request The request to handle.
     */
    @traced(TRACE_NAME)
    async handleWebhook(
        request: HandleWebhookRequest
    ): Promise<HandleWebhookResult> {
        try {
            const requestTimeMs = Date.now();
            const webhookContext =
                await this.policies.constructAuthorizationContext({
                    recordKeyOrRecordName: request.recordName,
                    userId: request.userId,
                });

            if (webhookContext.success === false) {
                return webhookContext;
            }

            const recordName = webhookContext.context.recordName;
            const webhook = await this.store.getItemByAddress(
                recordName,
                request.address
            );

            if (!webhook) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'Webhook not found.',
                };
            }

            const webhookAuthorization =
                await this.policies.authorizeUserAndInstancesForResources(
                    webhookContext.context,
                    {
                        instances: request.instances,
                        userId: request.userId,
                        resources: [
                            {
                                resourceKind: 'webhook',
                                resourceId: webhook.address,
                                action: 'run',
                                markers: webhook.markers,
                            },
                        ],
                    }
                );

            if (webhookAuthorization.success === false) {
                return webhookAuthorization;
            }

            const checkMetrics = await this._checkSubscriptionMetrics(
                'run',
                webhookContext.context,
                webhookAuthorization,
                webhook
            );

            if (checkMetrics.success === false) {
                return checkMetrics;
            }

            let state: WebhookState = null;
            if (webhook.targetResourceKind === 'data') {
                const data = await this._data.getData(
                    webhook.targetRecordName,
                    webhook.targetAddress,
                    webhook.userId,
                    request.instances
                );

                if (data.success === false) {
                    return {
                        success: false,
                        errorCode: 'invalid_webhook_target',
                        errorMessage:
                            'Invalid webhook target. The targeted record was not able to be retrieved.',
                        internalError: data,
                    };
                }

                let auxData: any;
                if (typeof data.data === 'string') {
                    const stored = tryParseJson(data.data);
                    if (stored.success === true) {
                        auxData = stored.value;
                    }
                } else if (typeof data.data === 'object') {
                    auxData = data.data;
                }

                const parseResult = STORED_AUX_SCHEMA.safeParse(auxData);
                if (parseResult.success === false) {
                    return {
                        success: false,
                        errorCode: 'invalid_webhook_target',
                        errorMessage:
                            'Invalid webhook target. The targeted record does not contain valid data.',
                        internalError: {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage:
                                'The data record does not contain valid AUX data.',
                            issues: parseResult.error.issues,
                        },
                    };
                }

                state = {
                    type: 'aux',
                    state: parseResult.data as StoredAux,
                };
            } else if (webhook.targetResourceKind === 'file') {
                const file = await this._files.readFile(
                    webhook.targetRecordName,
                    webhook.targetAddress,
                    webhook.userId,
                    request.instances
                );
                if (file.success === false) {
                    return {
                        success: false,
                        errorCode: 'invalid_webhook_target',
                        errorMessage:
                            'Invalid webhook target. The targeted record does not contain valid data.',
                        internalError: file,
                    };
                }

                state = {
                    type: 'url',
                    requestUrl: file.requestUrl,
                    requestMethod: file.requestMethod,
                    requestHeaders: file.requestHeaders,
                };
            }

            if (!state) {
                return {
                    success: false,
                    errorCode: 'invalid_webhook_target',
                    errorMessage:
                        'Invalid webhook target. The targeted record does not contain a valid AUX.',
                };
            }

            const result = await this._environment.handleHttpRequest({
                state: state,
                recordName,
                request: request.request,
            });

            const responseTimeMs = Date.now();
            const stateHash = getHash(state);
            const runId = uuidv7();

            let infoFileName: string = null;
            let infoRecordName: string = null;
            if (webhook.userId) {
                const recordName = webhook.userId;
                const dataFile: WebhookInfoFile = {
                    runId,
                    version: 1,
                    request: request.request,
                    response: result.success === true ? result.response : null,
                    logs: result.success === true ? result.logs : [],
                    state,
                    stateSha256: stateHash,
                    authorization: webhookAuthorization,
                };
                const json = stringify(dataFile);
                const data = new TextEncoder().encode(json);
                const recordResult = await this._files.recordFile(
                    recordName,
                    recordName,
                    {
                        fileSha256Hex: sha256().update(data).digest('hex'),
                        fileByteLength: data.byteLength,
                        fileDescription: `Webhook data for run ${runId}`,
                        fileMimeType: 'application/json',
                        headers: {},
                        markers: [`private:logs`],
                    }
                );

                if (recordResult.success === false) {
                    console.error(
                        '[WebhookRecordsController] Error recording webhook info file:',
                        recordResult
                    );
                } else {
                    infoRecordName = recordName;
                    infoFileName = recordResult.fileName;
                    const requestResult = await axios.request({
                        method: recordResult.uploadMethod,
                        headers: recordResult.uploadHeaders,
                        url: recordResult.uploadUrl,
                        data: data,
                        validateStatus: () => true,
                    });

                    if (
                        requestResult.status <= 199 ||
                        requestResult.status >= 300
                    ) {
                        console.error(
                            '[WebhookRecordsController] Error uploading webhook info file:',
                            requestResult
                        );
                    }
                }
            }

            const run: WebhookRunInfo = {
                runId: uuidv7(),
                recordName: recordName,
                webhookAddress: request.address,
                errorResult: result.success === false ? result : null,
                requestTimeMs,
                responseTimeMs,
                statusCode:
                    result.success === true ? result.response.statusCode : null,
                stateSha256: stateHash,
                infoRecordName,
                infoFileName,
            };

            await this.store.recordWebhookRun(run);

            if (result.success === true) {
                return {
                    success: true,
                    response: result.response,
                };
            } else {
                return result;
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error handling webhook:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async listWebhookRuns(
        request: ListWebhookRunsRequest
    ): Promise<CrudListItemsResult<WebhookRunInfo>> {
        try {
            const context = await this.policies.constructAuthorizationContext({
                userId: request.userId,
                recordKeyOrRecordName: request.recordName,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const webhook = await this.store.getItemByAddress(
                recordName,
                request.address
            );

            if (!webhook) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The webhook was not found.',
                };
            }

            const authorization =
                await this.policies.authorizeUserAndInstancesForResources(
                    context.context,
                    {
                        instances: request.instances,
                        userId: context.context.userId,
                        resources: [
                            {
                                resourceKind: 'webhook',
                                resourceId: webhook.address,
                                action: 'read',
                                markers: webhook.markers,
                            },
                        ],
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const runs = await this.store.listWebhookRunsForWebhook(
                recordName,
                request.address,
                request.requestTimeMs
            );

            return {
                success: true,
                recordName: recordName,
                items: runs.items,
                totalCount: runs.totalCount,
                marker: runs.marker,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error listing webhook runs:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async getWebhookRun(
        request: GetWebhookRunRequest
    ): Promise<GetWebhookRunResult> {
        try {
            const run = await this.store.getWebhookRunInfo(request.runId);
            if (!run) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The webhook run was not found.',
                };
            }

            const context = await this.policies.constructAuthorizationContext({
                userId: request.userId,
                recordKeyOrRecordName: run.run.recordName,
            });

            if (context.success === false) {
                return context;
            }

            const authorization = await this.policies.authorizeUserAndInstances(
                context.context,
                {
                    action: 'read',
                    resourceKind: 'webhook',
                    resourceId: run.webhook.address,
                    markers: run.webhook.markers,
                    instances: request.instances,
                    userId: context.context.userId,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            let infoFileResult: ReadFileResult = null;
            if (run.run.infoRecordName && run.run.infoFileName) {
                infoFileResult = await this._files.readFile(
                    run.run.infoRecordName,
                    run.run.infoFileName,
                    run.webhook.userId,
                    request.instances
                );
            }

            return {
                success: true,
                run: run.run,
                infoFileResult,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error getting webhook run:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: WebhookRecord
    ): Promise<CheckSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getWebhookFeatures(
            config,
            metrics.subscriptionStatus,
            metrics.subscriptionId,
            metrics.subscriptionType
        );

        if (!features.allowed) {
            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Webhooks are not allowed for this subscription.',
            };
        }
        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of webhook items has been reached for your subscription.',
                };
            }
        }

        if (action === 'create') {
            // create a user for the webhook
            if (!item.userId) {
                const result = await this._auth.createAccount({
                    userRole: 'superUser', // The system gets superUser permissions when performing administrative tasks
                    ipAddress: null,
                    createSession: false,
                });

                if (result.success === false) {
                    return result;
                } else {
                    item.userId = result.userId;
                }
            }
        }

        return {
            success: true,
        };
    }

    protected _transformInputItem(item: WebhookRecord): WebhookRecord {
        delete item.userId;
        return item;
    }
}

export interface HandleWebhookRequest {
    /**
     * The name of the record that the webhook is for.
     */
    recordName: string;

    /**
     * The address of the webhook.
     */
    address: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The request that should be made to the webhook.
     */
    request: GenericHttpRequest;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];
}

export type HandleWebhookResult = HandleWebhookSuccess | HandleWebhookFailure;

export interface HandleWebhookSuccess {
    success: true;

    /**
     * The result of the webhook.
     */
    response: GenericHttpResponse;
}

export interface HandleWebhookFailure {
    /**
     * Whether the webhook was successfully handled.
     */
    success: false;

    /**
     * The error code if the webhook was not successfully handled.
     */
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | 'not_found'
        | AuthorizeSubjectFailure['errorCode']
        | CheckSubscriptionMetricsFailure['errorCode']
        | 'invalid_webhook_target'
        | HandleHttpRequestFailure['errorCode'];

    /**
     * The error message if the webhook was not successfully handled.
     */
    errorMessage: string;

    /**
     * The denial reason.
     */
    reason?: DenialReason;

    /**
     * The internal reason why this error was produced.
     */
    internalError?:
        | AuthorizeSubjectFailure
        | GetDataFailure
        | ReadFileFailure
        | {
              success: false;
              errorCode: 'unacceptable_request';
              errorMessage: string;
              issues: z.ZodIssue[];
          };
}

export interface ListWebhookRunsRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The name of the record that the webhook is stored in.
     */
    recordName: string;

    /**
     * The address of the webhook.
     */
    address: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];

    /**
     * The time that listed requests should appear before.
     * If null, then the most recent runs will be returned.
     *
     * Formatted as the unix time in milliseconds.
     */
    requestTimeMs?: number;
}

export interface GetWebhookRunRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The ID of the webhook run that is being requested.
     */
    runId: string;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];
}

export type GetWebhookRunResult = GetWebhookRunSuccess | GetWebhookRunFailure;

export interface GetWebhookRunSuccess {
    success: true;

    /**
     * The run that was requested.
     */
    run: WebhookRunInfo;

    /**
     * The result of the read file operation for the info file for the run.
     * If the run doesn't have an info file, then this will be null.
     * If the run has an info file but it could not be read, then this will be a ReadFileFailure.
     */
    infoFileResult: ReadFileResult | null;
}

export interface GetWebhookRunFailure {
    success: false;

    /**
     * The error code if the webhook run was not successfully retrieved.
     */
    errorCode:
        | ServerError
        | 'data_not_found'
        | AuthorizeSubjectFailure['errorCode']
        | ConstructAuthorizationContextFailure['errorCode'];

    /**
     * The error message if the webhook run was not successfully retrieved.
     */
    errorMessage: string;
}
