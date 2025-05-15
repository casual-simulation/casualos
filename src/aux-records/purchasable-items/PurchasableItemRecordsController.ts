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
import type {
    AuthorizationContext,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeUserAndInstancesSuccess,
    PolicyController,
} from '../PolicyController';
import type {
    PurchasableItem,
    PurchasableItemRecordsStore,
} from './PurchasableItemRecordsStore';
import type { ActionKinds } from '@casual-simulation/aux-common';
import type { ConfigurationStore } from '../ConfigurationStore';
import type { CheckSubscriptionMetricsResult } from '../crud/CrudRecordsController';
import { CrudRecordsController } from '../crud/CrudRecordsController';
import { getPurchasableItemsFeatures } from '../SubscriptionConfiguration';
import { z } from 'zod';

export interface PurchasableItemRecordsConfig {
    store: PurchasableItemRecordsStore;
    policies: PolicyController;
    config: ConfigurationStore;
}

export class PurchasableItemRecordsController extends CrudRecordsController<
    PurchasableItem,
    PurchasableItemRecordsStore
> {
    constructor(config: PurchasableItemRecordsConfig) {
        super({
            ...config,
            resourceKind: 'purchasableItem',
            name: 'PurchasableItemRecordsController',
        });
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item: PurchasableItem
    ): Promise<CheckSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });
        const features = getPurchasableItemsFeatures(
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
                    'Purchasable item features are not allowed for this subscription. Make sure you have an active subscription that provides purchasable item features.',
            };
        }

        if (action === 'create') {
            if (
                typeof features.maxItems === 'number' &&
                metrics.totalPurchasableItems >= features.maxItems
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of purchasable items has been reached for your subscription.',
                };
            }
        }

        if (item && (action === 'create' || action === 'update')) {
            const currencyLimits = features.currencyLimits;
            const allowedCurrencies = Object.keys(currencyLimits);

            const currenciesSchema = z.object({
                currency: z.enum(allowedCurrencies as any),
            });
            const currencyResult = currenciesSchema.safeParse(item);

            if (currencyResult.success === false) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The currency is not allowed for this subscription. Please choose a different currency.',
                    issues: currencyResult.error.issues,
                };
            }

            if (item.cost > 0) {
                const limit = currencyLimits[item.currency];

                const schema = z.object({
                    cost: z
                        .number()
                        .int()
                        .min(limit.minCost)
                        .max(limit.maxCost),
                });

                const result = schema.safeParse(item);

                if (result.success === false) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'The cost is not allowed for this subscription. Please choose a different cost.',
                        issues: result.error.issues,
                    };
                }
            }
        }

        return {
            success: true,
        };
    }
}
