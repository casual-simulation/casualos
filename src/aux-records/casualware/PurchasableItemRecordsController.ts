
import { AuthorizeUserAndInstancesForResourcesSuccess, PolicyController } from '../PolicyController';
import { PurchasableItem, PurchasableItemMetrics, PurchasableItemRecordsStore } from './PurchasableItemRecordsStore';
import { ActionKinds } from '@casual-simulation/aux-common';
import { ConfigurationStore } from '../ConfigurationStore';
import { CheckSubscriptionMetricsResult, CrudRecordsController } from '../CrudRecordsController';

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