
import { AuthorizeUserAndInstancesForResourcesSuccess, AuthorizeUserAndInstancesSuccess, PolicyController } from '../PolicyController';
import { PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { ActionKinds } from '@casual-simulation/aux-common';
import { ConfigurationStore } from '../ConfigurationStore';
import { CheckSubscriptionMetricsResult, CrudRecordsController } from '../CrudRecordsController';
import { getPurchasableItemsFeatures, getSubscriptionFeatures } from '../SubscriptionConfiguration';
import { z } from 'zod';

export interface PurchasableItemRecordsConfig {
    store: PurchasableItemRecordsStore;
    policies: PolicyController;
    config: ConfigurationStore;
}

export class PurchasableItemRecordsController extends CrudRecordsController<PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore> {

    constructor(config: PurchasableItemRecordsConfig) {
        super({
            ...config,
            allowRecordKeys: false,
            resourceKind: 'purchasableItem',
            name: 'PurchasableItemRecordsController',
        });
    }

    protected async _checkSubscriptionMetrics(action: ActionKinds, authorization: AuthorizeUserAndInstancesSuccess | AuthorizeUserAndInstancesForResourcesSuccess, item: PurchasableItem): Promise<CheckSubscriptionMetricsResult> {
        const metrics = await this.store.getSubscriptionMetricsByRecordName(authorization.recordName);
        const config = await this.config.getSubscriptionConfiguration();
        const features = getPurchasableItemsFeatures(config, metrics.subscriptionStatus, metrics.subscriptionId);
        
        if (!features.allowed) {
            return {
                success: false,
                errorCode: 'not_authorized',
                    errorMessage:
                        'Purchasable item features are not allowed for this subscription. Make sure you have an active subscription that provides purchasable item features.',
            }
        }

        if (action === 'create') {
            if (typeof features.maxItems === 'number' && metrics.totalPurchasableItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: 'The maximum number of purchasable items has been reached for your subscription.',
                };
            }
        }

        if (item && (action === 'create' || action === 'update')) {
            const currencyLimits = features.currencyLimits;
            const allowedCurrencies = Object.keys(currencyLimits);

            const currenciesSchema = z.object({
                currency: z.enum(allowedCurrencies as any)
            });
            const currencyResult = currenciesSchema.safeParse(item);

            if (currencyResult.success === false) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: 'The currency is not allowed for this subscription. Please choose a different currency.',
                    issues: currencyResult.error.issues,
                };
            }

            if (item.cost > 0) {
                const limit = currencyLimits[item.currency];

                const schema = z.object({
                    cost: z.number()
                        .int()
                        .min(limit.minCost)
                        .max(limit.maxCost)
                });

                const result = schema.safeParse(item);

                if (result.success === false) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage: 'The cost is not allowed for this subscription. Please choose a different cost.',
                        issues: result.error.issues,
                    };
                }
            }
        }

        return {
            success: true
        };
    }

}