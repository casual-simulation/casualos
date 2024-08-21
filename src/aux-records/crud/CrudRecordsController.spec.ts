import { MemoryStore } from '../MemoryStore';
import {
    AuthorizationContext,
    AuthorizeUserAndInstancesForResourcesSuccess,
    PolicyController,
} from '../PolicyController';
import { RecordsController } from '../RecordsController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from '../TestUtils';
import { MemoryCrudRecordsStore } from './MemoryCrudRecordsStore';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from './CrudRecordsStore';
import {
    CheckSubscriptionMetricsResult,
    CheckSubscriptionMetricsSuccess,
    CrudRecordItemSuccess,
    CrudRecordsConfiguration,
    CrudRecordsController,
} from './CrudRecordsController';
import {
    ActionKinds,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { testCrudRecordsController } from './CrudRecordsControllerTests';

console.log = jest.fn();

describe('CrudRecordsController', () => {
    describe('allows record key access', () => {
        testCrudRecordsController<
            TestItem,
            CrudRecordsStore<TestItem>,
            TestController
        >(
            true,
            'data',
            (services) => new MemoryCrudRecordsStore(services.store),
            (config, services) =>
                new TestController({
                    ...config,
                    resourceKind: 'data',
                    name: 'testItem',
                }),
            (item) => item
        );
    });

    describe('denies record key access', () => {
        testCrudRecordsController<
            TestItem,
            CrudRecordsStore<TestItem>,
            TestController
        >(
            false,
            'marker',
            (services) => new MemoryCrudRecordsStore(services.store),
            (config, services) =>
                new TestController({
                    ...config,
                    resourceKind: 'marker',
                    name: 'testItem',
                }),
            (item) => item
        );
    });
});

export interface TestItem extends CrudRecord {}

export class TestController extends CrudRecordsController<TestItem> {
    private __checkSubscriptionMetrics: (
        action: ActionKinds,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        item?: TestItem
    ) => Promise<CheckSubscriptionMetricsResult>;

    set checkSubscriptionMetrics(
        value: (
            action: ActionKinds,
            authorization: AuthorizeUserAndInstancesForResourcesSuccess,
            item?: TestItem
        ) => Promise<CheckSubscriptionMetricsResult>
    ) {
        this.__checkSubscriptionMetrics = value;
    }

    constructor(
        config: CrudRecordsConfiguration<TestItem>,
        checkSubscriptionMetrics?: (
            action: ActionKinds,
            authorization: AuthorizeUserAndInstancesForResourcesSuccess,
            item?: TestItem
        ) => Promise<CheckSubscriptionMetricsResult>
    ) {
        super(config);
        this.__checkSubscriptionMetrics = checkSubscriptionMetrics as any;
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        item?: TestItem
    ): Promise<CheckSubscriptionMetricsResult> {
        if (this.__checkSubscriptionMetrics) {
            return await this.__checkSubscriptionMetrics(
                action,
                authorization,
                item
            );
        }
        return {
            success: true,
        };
    }
}
