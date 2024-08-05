import { ActionKinds } from '@casual-simulation/aux-common';
import {
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
} from 'PolicyController';
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

/**
 * Defines the configuration for a webhook records controller.
 */
export interface WebhookRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<WebhookRecord, WebhookRecordsStore>,
        'resourceKind' | 'allowRecordKeys'
    > {}

/**
 * Defines a controller that is able to handle and execute webhooks.
 */
export class WebhookRecordsController extends CrudRecordsController<
    WebhookRecord,
    WebhookRecordsStore
> {
    constructor(config: WebhookRecordsConfiguration) {
        super({
            ...config,
            resourceKind: 'webhook',
            allowRecordKeys: true,
        });
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: WebhookRecord
    ): Promise<CheckSubscriptionMetricsResult> {
        return {
            success: true,
        };
    }
}
