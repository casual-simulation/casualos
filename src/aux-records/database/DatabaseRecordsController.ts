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
    ActionKinds,
    Result,
    SimpleError,
} from '@casual-simulation/aux-common';
import { failure, isFailure, success } from '@casual-simulation/aux-common';
import type {
    AuthorizationContext,
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
    ResourceInfo,
} from '../PolicyController';
import type {
    CrudRecordsConfiguration,
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
} from '../crud';
import { CrudRecordsController } from '../crud';
import type {
    DatabasesFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getDatabaseFeatures } from '../SubscriptionConfiguration';
import type {
    DatabaseRecord,
    DatabaseRecordsStore,
    DatabaseSubscriptionMetrics,
} from './DatabaseRecordsStore';
import type {
    DatabaseInterface,
    DatabaseStatement,
    QueryResult,
    SQliteDatabase,
    TursoDatabase,
} from './DatabaseInterface';
import { v4 as uuid } from 'uuid';
import { traced } from '../tracing/TracingDecorators';

const TRACE_NAME = 'DatabaseRecordsController';

export type DatabaseType = SQliteDatabase | TursoDatabase;

/**
 * Defines the configuration for a webhook records controller.
 */
export interface DatabaseRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<DatabaseRecord, DatabaseRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    /**
     * The name of the provider that the interface uses.
     */
    databaseInterfaceProviderName: 'sqlite' | 'turso';

    /**
     * The interface to the search engine that should be used.
     */
    databaseInterface: DatabaseInterface<DatabaseType>;
}

/**
 * Defines a controller that can be used to interact with DatabaseRecords.
 */
export class DatabaseRecordsController extends CrudRecordsController<
    DatabaseRecordInput,
    DatabaseRecord,
    DatabaseRecordsStore,
    DatabaseRecordOutput
> {
    private _databaseInterface: DatabaseInterface<DatabaseType>;
    private _providerName: 'sqlite' | 'turso';

    constructor(config: DatabaseRecordsConfiguration) {
        super({
            ...config,
            name: 'DatabaseRecordsController',
            resourceKind: 'database',
        });
        this._providerName = config.databaseInterfaceProviderName;
        this._databaseInterface = config.databaseInterface;
    }

    @traced(TRACE_NAME)
    async query(
        request: DatabaseQuery
    ): Promise<Result<QueryResult[], SimpleError>> {
        const baseRequest = {
            recordKeyOrRecordName: request.recordName,
            userId: request.userId,
            instances: request.instances,
        };

        const context = await this.policies.constructAuthorizationContext(
            baseRequest
        );

        if (context.success === false) {
            return failure(context);
        }

        const item = await this.store.getItemByAddress(
            context.context.recordName,
            request.address
        );

        if (!item) {
            return failure({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The item was not found.',
            });
        }

        const markers = item.markers;

        const resources: ResourceInfo[] = [
            {
                resourceKind: this.resourceKind,
                resourceId: request.address,
                markers: markers,
                action: 'read',
            },
        ];

        if (!request.readonly) {
            resources.push({
                resourceKind: this.resourceKind,
                resourceId: request.address,
                markers: markers,
                action: 'update',
            });
        }

        const authorization =
            await this.policies.authorizeUserAndInstancesForResources(
                context.context,
                {
                    userId: request.userId,
                    instances: request.instances,
                    resources: resources,
                }
            );

        if (authorization.success === false) {
            return failure(authorization);
        }

        const result = await this._databaseInterface.query(
            item.databaseInfo,
            request.statements,
            request.readonly,
            request.automaticTransaction ?? true
        );

        return result;
    }

    protected async _eraseItemCore(
        recordName: string,
        address: string,
        item: DatabaseRecord,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess
    ): Promise<Result<void, SimpleError>> {
        const result = await super._eraseItemCore(
            recordName,
            address,
            item,
            authorization
        );
        if (isFailure(result)) {
            return result;
        }

        await this._databaseInterface.deleteDatabase(item.databaseName);

        return success();
    }

    protected async _convertItemToResult(
        item: DatabaseRecord,
        context: AuthorizationContext,
        action: ActionKinds
    ): Promise<DatabaseRecordOutput> {
        return {
            address: item.address,
            markers: item.markers,
        };
    }

    protected async _convertItemsToResults(
        items: DatabaseRecord[],
        context: AuthorizationContext,
        action: ActionKinds
    ): Promise<DatabaseRecordOutput[]> {
        return items.map((i) => ({
            address: i.address,
            markers: i.markers,
        }));
    }

    protected async _transformInputItem(
        item: DatabaseRecordInput,
        existingItem: DatabaseRecord,
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        metrics: DatabaseRecordsSubscriptionMetricsSuccess
    ): Promise<Result<DatabaseRecord, SimpleError>> {
        if (action !== 'create' && action !== 'update') {
            return failure({
                errorCode: 'action_not_supported',
                errorMessage: `The action '${action}' is not supported for database records.`,
            });
        }

        if (action === 'create') {
            const databaseName = uuid();
            const database = await this._databaseInterface.createDatabase(
                databaseName,
                {
                    maxSizeBytes: metrics.features.maxBytesPerDatabase,
                }
            );

            if (isFailure(database)) {
                return database;
            }

            return success({
                address: item.address,
                markers: item.markers,
                databaseProvider: this._providerName,
                databaseInfo: database.value,
                databaseName: databaseName,
            });
        } else if (action === 'update') {
            // For updates, we need to update the existing collection's schema
            if (!existingItem) {
                return failure({
                    errorCode: 'record_not_found',
                    errorMessage:
                        'Cannot update a database record that does not exist.',
                });
            }

            return success({
                address: item.address,
                markers: item.markers,
                databaseProvider: existingItem.databaseProvider,
                databaseInfo: existingItem.databaseInfo,
                databaseName: existingItem.databaseName,
            });
        }
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: DatabaseRecordInput
    ): Promise<DatabaseRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getDatabaseFeatures(
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
                    'Database records are not allowed for this subscription.',
            };
        }

        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of database record items has been reached for your subscription.',
                };
            }
        }

        return {
            success: true,
            config,
            metrics,
            features,
        };
    }
}

export type DatabaseRecordsSubscriptionMetricsResult =
    | DatabaseRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface DatabaseRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: DatabaseSubscriptionMetrics;
    features: DatabasesFeaturesConfiguration;
}

export interface DatabaseRecordInput
    extends Omit<
        DatabaseRecord,
        'databaseInfo' | 'databaseProvider' | 'databaseName'
    > {}

/**
 * Defines a record that represents a collection of documents that can be searched.
 *
 * @dochash types/records/database
 * @docname DatabaseRecord
 */
export interface DatabaseRecordOutput
    extends Omit<
        DatabaseRecord,
        'databaseInfo' | 'databaseProvider' | 'databaseName'
    > {}

/**
 * Defines a request to query a database.
 *
 * @dochash types/records/database
 * @docname DatabaseQuery
 */

export interface DatabaseQuery {
    /**
     * The name of the record that the search should be performed on.
     */
    recordName: string;

    /**
     * The address of the search record that the search should be performed on.
     */
    address: string;

    /**
     * The SQL statements to execute.
     */
    statements: DatabaseStatement[];

    /**
     * Whether the query should be executed in read-only mode.
     *
     * This is a safety switch that helps prevent accidental modifications to the database.
     */
    readonly: boolean;

    /**
     * Whether to automatically wrap the statements in a transaction if there are multiple statements.
     *
     * Defaults to true.
     */
    automaticTransaction?: boolean;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * The instance(s) that are making the request.
     */
    instances: string[];
}
