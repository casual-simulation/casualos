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
import {
    failure,
    success,
    type ActionKinds,
    type Result,
    type SimpleError,
} from '@casual-simulation/aux-common';

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
import type { AuthStore } from '../AuthStore';
import type { PrivoClientInterface } from '../PrivoClient';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface ContractRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<ContractRecord, ContractRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    authStore: AuthStore;

    privo: PrivoClientInterface | null;
}

export interface ContractRecordInput {
    /**
     * The ID, email, phone number, or display name of the user that should hold the contract.
     */
    holdingUser: string;

    /**
     * The address that the contract should be sent to.
     */
    address: string;

    /**
     * The rate of the contract.
     */
    rate: number;

    /**
     * The initial value of the contract.
     */
    initialValue: number;

    /**
     * The description of the contract.
     */
    description?: string | null;

    /**
     * The markers for the contract.
     */
    markers: string[];
}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class ContractRecordsController extends CrudRecordsController<
    ContractRecordInput,
    ContractRecord,
    ContractRecordsStore
> {
    private _authStore: AuthStore;
    private _privo: PrivoClientInterface | null;

    constructor(config: ContractRecordsConfiguration) {
        super({
            ...config,
            name: 'ContractRecordsController',
            resourceKind: 'contract',
        });

        this._authStore = config.authStore;
        this._privo = config.privo;
    }

    // TODO: decide how to prevent users from deleting/updating contracts
    // eraseItem(request: CrudEraseItemRequest): Promise<CrudEraseItemResult> {
    //      return {
    //         success: false,

    //      }
    // }

    protected async _transformInputItem(
        item: ContractRecordInput,
        existingItem: ContractRecord,
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess
    ): Promise<Result<ContractRecord, SimpleError>> {
        if (action === 'create') {
            let user =
                (await this._authStore.findUser(item.holdingUser)) ??
                (await this._authStore.findUserByAddress(
                    item.holdingUser,
                    'email'
                )) ??
                (await this._authStore.findUserByAddress(
                    item.holdingUser,
                    'phone'
                ));

            if (!user && this._privo) {
                const serviceId =
                    (await this._privo.lookupServiceId({
                        email: item.holdingUser,
                    })) ??
                    (await this._privo.lookupServiceId({
                        displayName: item.holdingUser,
                    })) ??
                    (await this._privo.lookupServiceId({
                        phoneNumber: item.holdingUser,
                    }));

                if (serviceId) {
                    user = await this._authStore.findUserByPrivoServiceId(
                        serviceId
                    );
                }
            }

            if (!user) {
                return failure({
                    success: false,
                    errorCode: 'user_not_found',
                    errorMessage: `The holding user (${item.holdingUser}) was not found.`,
                });
            }

            return success({
                ...item,
                id: uuid(),
                issuedAtMs: Date.now(),
                status: 'pending',
                issuingUserId: context.userId,
                holdingUserId: user.id,
            });
        }
        return failure({
            errorCode: 'not_supported',
            errorMessage: 'Updating contracts is not supported.',
        });
    }

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

        // if (action === 'create') {
        //     // if (
        //     //     typeof features.maxItems === 'number' &&
        //     //     metrics.totalItems >= features.maxItems
        //     // ) {
        //     //     return {
        //     //         success: false,
        //     //         errorCode: 'subscription_limit_reached',
        //     //         errorMessage:
        //     //             'The maximum number of package items has been reached for your subscription.',
        //     //     };
        //     // }

        //     item!.id = uuid();
        //     item!.issuedAtMs = Date.now();
        //     item!.status = 'pending';
        // }

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
