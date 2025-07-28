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
import type { ActionKinds } from '@casual-simulation/aux-common';
import type {
    AuthorizationContext,
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
} from '../PolicyController';
import type {
    CrudRecordsConfiguration,
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
} from '../crud';
import { CrudRecordsController } from '../crud';
import type {
    NotificationFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getNotificationFeatures } from '../SubscriptionConfiguration';
import type {
    SearchRecord,
    SearchRecordsStore,
    SearchSubscriptionMetrics,
} from './SearchRecordsStore';

const TRACE_NAME = 'NotificationRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface SearchRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<SearchRecord, SearchRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    // /**
    //  * The interface that should be used to send push notifications.
    //  */
    // pushInterface: WebPushInterface;
}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class SearchRecordsController extends CrudRecordsController<
    SearchRecord,
    SearchRecordsStore
> {
    constructor(config: SearchRecordsConfiguration) {
        super({
            ...config,
            name: 'SearchRecordsController',
            resourceKind: 'search',
        });
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: SearchRecord
    ): Promise<SearchRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getNotificationFeatures(
            config,
            metrics.subscriptionStatus,
            metrics.subscriptionId,
            metrics.subscriptionType,
            metrics.currentPeriodStartMs,
            metrics.currentPeriodEndMs
        );

        if (!features.allowed) {
            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'Search records are not allowed for this subscription.',
            };
        }

        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of search record items has been reached for your subscription.',
                };
            }
        }

        return {
            success: true,
            config,
            metrics,
            features,
        };
    }
}

export type SearchRecordsSubscriptionMetricsResult =
    | SearchRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface SearchRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: SearchSubscriptionMetrics;
    features: NotificationFeaturesConfiguration;
}
