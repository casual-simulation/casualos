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
    PackageRecordsStore,
    PackageRecord,
    PackageSubscriptionMetrics,
} from './PackageRecordsStore';
import type {
    PackageFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getPackageFeatures } from '../SubscriptionConfiguration';
import { v7 as uuid } from 'uuid';

const TRACE_NAME = 'PackageRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface PackageRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<PackageRecord, PackageRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {}

export type PackageRecordInput = Omit<PackageRecord, 'id'>;

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageRecordsController extends CrudRecordsController<
    PackageRecordInput,
    PackageRecord,
    PackageRecordsStore
> {
    constructor(config: PackageRecordsConfiguration) {
        super({
            ...config,
            name: 'PackageRecordsController',
            resourceKind: 'package',
        });
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: PackageRecord
    ): Promise<PackageRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getPackageFeatures(
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
                errorMessage: 'Packages are not allowed for this subscription.',
            };
        }

        if (action === 'create') {
            if (
                typeof features.maxItems === 'number' &&
                metrics.totalItems >= features.maxItems
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of package items has been reached for your subscription.',
                };
            }

            item!.id = uuid();
        }

        return {
            success: true,
            config,
            metrics,
            features,
        };
    }
}

export type PackageRecordsSubscriptionMetricsResult =
    | PackageRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface PackageRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration | null;
    metrics: PackageSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}
