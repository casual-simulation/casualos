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
    CrudRecordsConfiguration,
    CrudRecordsController,
} from '../crud/CrudRecordsController';
import {
    WebhookRecord,
    WebhookRecordsStore,
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

    constructor(config: WebhookRecordsConfiguration) {
        super({
            ...config,
            resourceKind: 'webhook',
            name: 'WebhookRecordsController',
        });
        this._environment = config.environment;
        this._data = config.data;
        this._files = config.files;
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

            return await this._environment.handleHttpRequest({
                state: state,
                recordName,
                request: request.request,
            });
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