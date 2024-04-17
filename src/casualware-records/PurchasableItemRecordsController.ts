import { AuthorizeUserAndInstancesForResourcesSuccess, CheckSubscriptionMetricsResult, ConfigurationStore, CrudRecordsController, PolicyController } from '@casual-simulation/aux-records';
import { PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { ActionKinds } from '@casual-simulation/aux-common';

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

    protected async _checkSubscriptionMetrics(metrics: PurchasableItemMetrics, action: ActionKinds, authorization: AuthorizeUserAndInstancesForResourcesSuccess): Promise<CheckSubscriptionMetricsResult> {
        return {
            success: true
        };
    }

}