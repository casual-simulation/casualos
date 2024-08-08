import {
    ActionKinds,
    GenericHttpRequest,
    GenericHttpResponse,
    ServerError,
} from '@casual-simulation/aux-common';
import {
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
    ConstructAuthorizationContextFailure,
} from '../PolicyController';
import {
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
import { traced } from 'tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { WebhookEnvironmentFactory } from './WebhookEnvironment';

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
     * The factory that should be used to create webhook environments.
     */
    factory: WebhookEnvironmentFactory;
}

/**
 * Defines a controller that is able to handle and execute webhooks.
 */
export class WebhookRecordsController extends CrudRecordsController<
    WebhookRecord,
    WebhookRecordsStore
> {
    private _factory: WebhookEnvironmentFactory;

    constructor(config: WebhookRecordsConfiguration) {
        super({
            ...config,
            resourceKind: 'webhook',
            name: 'WebhookRecordsController',
        });
        this._factory = config.factory;
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
            const context = await this.policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
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
    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: WebhookRecord
    ): Promise<CheckSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetricsByRecordName(
            authorization.recordName
        );

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
}

export type HandleWebhookResult = HandleWebhookSuccess | HandleWebhookFailure;

export interface HandleWebhookSuccess {
    success: true;

    /**
     * The result of the webhook.
     */
    result: GenericHttpResponse;
}

export interface HandleWebhookFailure {
    /**
     * Whether the webhook was successfully handled.
     */
    success: false;

    /**
     * The error code if the webhook was not successfully handled.
     */
    errorCode: ServerError | ConstructAuthorizationContextFailure['errorCode'];

    /**
     * The error message if the webhook was not successfully handled.
     */
    errorMessage: string;
}
