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
    ContractRecordsStore,
    ContractRecord,
    ContractSubscriptionMetrics,
} from './ContractRecordsStore';
import type {
    PackageFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getContractFeatures } from '../SubscriptionConfiguration';
import { v7 as uuid } from 'uuid';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface ContractRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<ContractRecord, ContractRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {}

export type ContractRecordInput = Omit<ContractRecord, 'id'>;

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class ContractRecordsController extends CrudRecordsController<
    ContractRecordInput,
    ContractRecordsStore
> {
    constructor(config: ContractRecordsConfiguration) {
        super({
            ...config,
            name: 'ContractRecordsController',
            resourceKind: 'contract',
        });
    }

    // TODO: decide how to prevent users from deleting/updating contracts
    // eraseItem(request: CrudEraseItemRequest): Promise<CrudEraseItemResult> {
    //      return {
    //         success: false,

    //      }
    // }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: ContractRecord
    ): Promise<ContractRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getContractFeatures(
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
                    'Contracts are not allowed for this subscription.',
            };
        }

        if (action === 'create') {
            // if (
            //     typeof features.maxItems === 'number' &&
            //     metrics.totalItems >= features.maxItems
            // ) {
            //     return {
            //         success: false,
            //         errorCode: 'subscription_limit_reached',
            //         errorMessage:
            //             'The maximum number of package items has been reached for your subscription.',
            //     };
            // }

            item!.id = uuid();
            item!.issuedAtMs = Date.now();
            item!.status = 'pending';
        }

        return {
            success: true,
            config,
            metrics,
            features,
        };
    }
}

export type ContractRecordsSubscriptionMetricsResult =
    | ContractRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface ContractRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration | null;
    metrics: ContractSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}
