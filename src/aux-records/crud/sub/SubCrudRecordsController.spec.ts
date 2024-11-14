import { MemoryStore } from '../../MemoryStore';
import {
    AuthorizationContext,
    AuthorizeUserAndInstancesForResourcesSuccess,
    PolicyController,
} from '../../PolicyController';
import { RecordsController } from '../../RecordsController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from '../../TestUtils';
import { MemoryCrudRecordsStore } from './../MemoryCrudRecordsStore';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from './../CrudRecordsStore';
import {
    CheckSubscriptionMetricsResult,
    CheckSubscriptionMetricsSuccess,
    CrudRecordItemSuccess,
    CrudRecordsConfiguration,
    CrudRecordsController,
} from '../CrudRecordsController';
import { MemorySubCrudRecordsStore } from './SubMemoryCrudRecordsStore';
import {
    ActionKinds,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { testCrudRecordsController } from './SubCrudRecordsControllerTests';
import { SubCrudRecord, SubCrudRecordsStore } from './SubCrudRecordsStore';
import {
    SubCrudRecordsConfiguration,
    SubCrudRecordsController,
} from './SubCrudRecordsController';

console.log = jest.fn();

describe('SubCrudRecordsController', () => {
    describe('allows record key access', () => {
        testCrudRecordsController<
            TestSubItemKey,
            TestSubItem,
            SubCrudRecordsStore<TestSubItemKey, TestSubItem>,
            CrudRecordsStore<TestItem>,
            TestController
        >(
            true,
            'data',
            (services) => new MemoryCrudRecordsStore(services.store),
            (services, recordItemStore) =>
                new MemorySubCrudRecordsStore(services.store, recordItemStore),
            (config, services) =>
                new TestController({
                    ...config,
                    resourceKind: 'data',
                    name: 'testItem',
                }),
            (item) => ({
                key1: item,
                key2: `key${item}`,
            }),
            (item) => item,
            (item) => item
        );
    });

    describe('denies record key access', () => {
        testCrudRecordsController<
            TestSubItemKey,
            TestSubItem,
            SubCrudRecordsStore<TestSubItemKey, TestSubItem>,
            CrudRecordsStore<TestItem>,
            TestController
        >(
            false,
            'marker',
            (services) => new MemoryCrudRecordsStore(services.store),
            (services, recordItemStore) =>
                new MemorySubCrudRecordsStore(services.store, recordItemStore),
            (config, services) =>
                new TestController({
                    ...config,
                    resourceKind: 'marker',
                    name: 'testItem',
                }),
            (item) => ({
                key1: item,
                key2: `key${item}`,
            }),
            (item) => item,
            (item) => item
        );
    });
});

export interface TestItem extends CrudRecord {}

export interface TestSubItemKey {
    key1: number;
    key2: string;
}

export interface TestSubItem extends SubCrudRecord<TestSubItemKey> {}

export class TestController extends SubCrudRecordsController<
    TestSubItemKey,
    TestSubItem
> {
    private __checkSubscriptionMetrics: (
        action: ActionKinds,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        item?: TestSubItem
    ) => Promise<CheckSubscriptionMetricsResult>;

    set checkSubscriptionMetrics(
        value: (
            action: ActionKinds,
            authorization: AuthorizeUserAndInstancesForResourcesSuccess,
            item?: TestSubItem
        ) => Promise<CheckSubscriptionMetricsResult>
    ) {
        this.__checkSubscriptionMetrics = value;
    }

    constructor(
        config: SubCrudRecordsConfiguration<TestSubItemKey, TestSubItem>,
        checkSubscriptionMetrics?: (
            action: ActionKinds,
            authorization: AuthorizeUserAndInstancesForResourcesSuccess,
            item?: TestSubItem
        ) => Promise<CheckSubscriptionMetricsResult>
    ) {
        super(config);
        this.__checkSubscriptionMetrics = checkSubscriptionMetrics as any;
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        item?: TestSubItem
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
