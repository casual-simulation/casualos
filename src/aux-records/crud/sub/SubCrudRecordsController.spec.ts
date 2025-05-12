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
} from '../../PolicyController';

import { MemoryCrudRecordsStore } from './../MemoryCrudRecordsStore';
import type { CrudRecord, CrudRecordsStore } from './../CrudRecordsStore';
import type { CheckSubscriptionMetricsResult } from '../CrudRecordsController';

import { MemorySubCrudRecordsStore } from './MemorySubCrudRecordsStore';
import type { ActionKinds } from '@casual-simulation/aux-common';

import { testCrudRecordsController } from './SubCrudRecordsControllerTests';
import type { SubCrudRecord, SubCrudRecordsStore } from './SubCrudRecordsStore';
import type { SubCrudRecordsConfiguration } from './SubCrudRecordsController';
import { SubCrudRecordsController } from './SubCrudRecordsController';

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
            (item) => item,
            undefined,
            ['create', 'read', 'update', 'delete']
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
