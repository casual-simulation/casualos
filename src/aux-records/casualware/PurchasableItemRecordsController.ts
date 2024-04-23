
import { AuthorizeUserAndInstancesForResourcesSuccess, AuthorizeUserAndInstancesSuccess, PolicyController } from '../PolicyController';
import { PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { ActionKinds } from '@casual-simulation/aux-common';
import { ConfigurationStore } from '../ConfigurationStore';
import { CheckSubscriptionMetricsResult, CrudRecordsController } from '../CrudRecordsController';
import { getPurchasableItemsFeatures, getSubscriptionFeatures } from '../SubscriptionConfiguration';

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

    protected async _checkSubscriptionMetrics(metrics: PurchasableItemMetrics, action: ActionKinds, authorization: AuthorizeUserAndInstancesSuccess | AuthorizeUserAndInstancesForResourcesSuccess): Promise<CheckSubscriptionMetricsResult> {
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
            if (typeof features.maxPurchasableItems === 'number' && metrics.totalPurchasableItems >= features.maxPurchasableItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: 'The maximum number of purchasable items has been reached for your subscription.',
                };
            }
        }

        return {
            success: true
        };
    }

}