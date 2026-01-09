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
    ResourceKinds,
    ActionKinds,
    Result,
    SimpleError,
} from '@casual-simulation/aux-common';
import {
    failure,
    isFailure,
    PUBLIC_READ_MARKER,
    RESOURCE_KIND_VALIDATION,
    success,
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
    NotificationFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getSearchFeatures } from '../SubscriptionConfiguration';
import type {
    SearchRecord,
    SearchRecordsStore,
    SearchRecordSync,
    SearchSubscriptionMetrics,
} from './SearchRecordsStore';
import { z } from 'zod';
import type {
    SearchCollectionField,
    SearchDocument,
    SearchDocumentInfo,
    SearchInterface,
    SearchNode,
    SearchQuery,
    SearchResult,
    UpdatedSearchCollectionField,
} from './SearchInterface';
import { v4 as uuid } from 'uuid';
import { traced } from '../tracing/TracingDecorators';
import { ADDRESS_VALIDATION, RECORD_NAME_VALIDATION } from '../Validations';
import type { IQueue } from '../queue';
import type { SearchSyncQueueEvent } from './SearchSyncProcessor';

const TRACE_NAME = 'SearchRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface SearchRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<SearchRecord, SearchRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    /**
     * The interface to the search engine that should be used.
     */
    searchInterface: SearchInterface;

    /**
     * The queue that should be used to schedule search sync events.
     *
     * If null, then the controller will not be able to schedule search sync events.
     */
    queue: IQueue<SearchSyncQueueEvent> | null;
}

/**
 * Defines a controller that can be used to interact with SearchRecords.
 */
export class SearchRecordsController extends CrudRecordsController<
    SearchRecordInput,
    SearchRecord,
    SearchRecordsStore,
    SearchRecordOutput
> {
    private _searchInterface: SearchInterface;
    private _queue: IQueue<SearchSyncQueueEvent>;

    constructor(config: SearchRecordsConfiguration) {
        super({
            ...config,
            name: 'SearchRecordsController',
            resourceKind: 'search',
        });
        this._searchInterface = config.searchInterface;
        this._queue = config.queue;
    }

    protected async _eraseItemCore(
        recordName: string,
        address: string,
        item: SearchRecord,
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

        await this._searchInterface.dropCollection(item.collectionName);

        return success();
    }

    @traced(TRACE_NAME)
    async storeDocument(
        request: StoreDocumentRequest
    ): Promise<StoreDocumentResult> {
        const contextResult = await this.policies.constructAuthorizationContext(
            {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            }
        );

        if (contextResult.success === false) {
            return failure(contextResult);
        }

        const recordName = contextResult.context.recordName;
        const record = await this.store.getItemByAddress(
            recordName,
            request.address
        );

        if (!record) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The Search record was not found.`,
            });
        }

        const authorizationResult =
            await this.policies.authorizeUserAndInstances(
                contextResult.context,
                {
                    resourceKind: 'search',
                    resourceId: record.address,
                    action: 'update',
                    instances: request.instances,
                    userId: request.userId,
                    markers: record.markers,
                }
            );

        if (authorizationResult.success === false) {
            return failure(authorizationResult);
        }

        const result = await this._searchInterface.createDocument(
            record.collectionName,
            request.document,
            'upsert'
        );

        return success(result);
    }

    @traced(TRACE_NAME)
    async eraseDocument(
        request: EraseDocumentRequest
    ): Promise<EraseDocumentResult> {
        const contextResult = await this.policies.constructAuthorizationContext(
            {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            }
        );

        if (contextResult.success === false) {
            return failure(contextResult);
        }

        const recordName = contextResult.context.recordName;
        const record = await this.store.getItemByAddress(
            recordName,
            request.address
        );

        if (!record) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The Search record was not found.`,
            });
        }

        const authorizationResult =
            await this.policies.authorizeUserAndInstances(
                contextResult.context,
                {
                    resourceKind: 'search',
                    resourceId: record.address,
                    action: 'update',
                    instances: request.instances,
                    userId: request.userId,
                    markers: record.markers,
                }
            );

        if (authorizationResult.success === false) {
            return failure(authorizationResult);
        }

        const result = await this._searchInterface.deleteDocument(
            record.collectionName,
            request.documentId
        );

        return result;
    }

    @traced(TRACE_NAME)
    async sync(
        request: SyncSearchRecordRequest
    ): Promise<SyncSearchRecordResult> {
        if (!this._queue) {
            return failure({
                errorCode: 'not_supported',
                errorMessage:
                    'Syncing data to a search record is not supported.',
            });
        }

        const searchContext = await this.policies.constructAuthorizationContext(
            {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            }
        );

        if (searchContext.success === false) {
            return failure(searchContext);
        }

        const searchRecordName = searchContext.context.recordName;
        const searchRecordAddress = request.address;

        const searchRecord = await this.store.getItemByAddress(
            searchRecordName,
            searchRecordAddress
        );

        if (!searchRecord) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The Search record was not found.`,
            });
        }

        const searchAuthorization =
            await this.policies.authorizeUserAndInstances(
                searchContext.context,
                {
                    resourceKind: 'search',
                    resourceId: request.address,
                    action: 'update',
                    markers: searchRecord.markers,
                    instances: request.instances,
                    userId: request.userId,
                }
            );

        if (searchAuthorization.success === false) {
            return failure(searchAuthorization);
        }

        const dataContext = await this.policies.constructAuthorizationContext({
            recordKeyOrRecordName: request.targetRecordName,
            userId: request.userId,
        });

        if (dataContext.success === false) {
            return failure(dataContext);
        }

        const targetRecordName = dataContext.context.recordName;

        const dataAuthorization = await this.policies.authorizeUserAndInstances(
            dataContext.context,
            {
                resourceKind: request.targetResourceKind,
                action: 'read',
                markers: [request.targetMarker],
                instances: request.instances,
                userId: request.userId,
            }
        );

        if (dataAuthorization.success === false) {
            return failure(dataAuthorization);
        }

        const id = uuid();
        const sync: SearchRecordSync = {
            id,
            searchRecordName,
            searchRecordAddress,
            targetRecordName,
            targetResourceKind: request.targetResourceKind,
            targetMarker: request.targetMarker,
            targetMapping: request.targetMapping,
        };
        await this.store.saveSync(sync);

        await this._queue.add('syncSearchRecord', {
            type: 'sync_search_record',
            sync,
        });

        return success({
            syncId: id,
        });
    }

    @traced(TRACE_NAME)
    async unsync(
        request: UnsyncSearchRecordRequest
    ): Promise<UnsyncSearchRecordResult> {
        // First, retrieve the sync from the store
        const sync = await this.store.getSync(request.syncId);

        if (!sync) {
            return failure({
                errorCode: 'not_found',
                errorMessage: 'The search record sync was not found.',
            });
        }

        // Check permissions for the search record
        const searchContext = await this.policies.constructAuthorizationContext(
            {
                recordKeyOrRecordName: sync.searchRecordName,
                userId: request.userId,
            }
        );

        if (searchContext.success === false) {
            return failure(searchContext);
        }

        const searchRecord = await this.store.getItemByAddress(
            sync.searchRecordName,
            sync.searchRecordAddress
        );

        if (!searchRecord) {
            return failure({
                errorCode: 'not_found',
                errorMessage: 'The search record was not found.',
            });
        }

        const searchAuthorization =
            await this.policies.authorizeUserAndInstances(
                searchContext.context,
                {
                    resourceKind: 'search',
                    resourceId: sync.searchRecordAddress,
                    action: 'update',
                    markers: searchRecord.markers,
                    instances: request.instances,
                    userId: request.userId,
                }
            );

        if (searchAuthorization.success === false) {
            return failure(searchAuthorization);
        }

        // Delete the sync if permissions are valid
        await this.store.deleteSync(request.syncId);

        return success();
    }

    @traced(TRACE_NAME)
    async search(request: SearchRequest): Promise<SearchResult> {
        const contextResult = await this.policies.constructAuthorizationContext(
            {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            }
        );

        if (contextResult.success === false) {
            return failure(contextResult);
        }

        const recordName = contextResult.context.recordName;
        const record = await this.store.getItemByAddress(
            recordName,
            request.address
        );

        if (!record) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `The Search record was not found.`,
            });
        }

        const authorizationResult =
            await this.policies.authorizeUserAndInstances(
                contextResult.context,
                {
                    resourceKind: 'search',
                    resourceId: record.address,
                    action: 'read',
                    instances: request.instances,
                    userId: request.userId,
                    markers: record.markers,
                }
            );

        if (authorizationResult.success === false) {
            return failure(authorizationResult);
        }

        const result = await this._searchInterface.searchCollection(
            record.collectionName,
            request.query
        );

        return result;
    }

    protected async _convertItemToResult(
        item: SearchRecord,
        context: AuthorizationContext,
        action: ActionKinds
    ): Promise<SearchRecordOutput> {
        if (action === 'read') {
            const schema: SearchCollectionSchema = {};
            if (item.collectionName) {
                const collection = await this._searchInterface.getCollection(
                    item.collectionName
                );
                if (collection) {
                    for (let field of collection.fields) {
                        schema[field.name] = {
                            type: field.type,
                            optional: field.optional,
                            index: field.index,
                            store: field.store,
                            sort: field.sort,
                            infix: field.infix,
                            locale: field.locale,
                            stem: field.stem,
                            facet: field.facet,
                        };
                    }
                }
            }

            return {
                ...item,
                schema,
                nodes: this._searchInterface.nodes,
            };
        }
        return item;
    }

    protected async _transformInputItem(
        item: SearchRecordInput,
        existingItem: SearchRecord,
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess
    ): Promise<Result<SearchRecord, SimpleError>> {
        if (action !== 'create' && action !== 'update') {
            return failure({
                errorCode: 'action_not_supported',
                errorMessage: `The action '${action}' is not supported for search records.`,
            });
        }

        if (action === 'create') {
            const isPublic = item.markers.includes(PUBLIC_READ_MARKER);

            // Generate a unique collection name
            // This is to ensure that users cannot choose their own collection names
            // and potentially create insecurities in how collections are handled.
            // e.g. a collection name with a "*" in it could potentially match all collections.
            const collectionName = isPublic
                ? `pub_.${uuid()}`
                : `prv_.${uuid()}`;

            const fields: SearchCollectionField[] = [];

            for (let key in item.schema) {
                if (
                    key === 'recordName' ||
                    key === 'address' ||
                    key === 'resourceKind'
                ) {
                    continue;
                }
                const field = item.schema[key];
                if (field.drop) {
                    continue;
                }
                fields.push({
                    name: key,
                    type: field.type,
                    optional: field.optional ?? undefined,
                    index: field.index ?? undefined,
                    store: field.store ?? undefined,
                    sort: field.sort ?? undefined,
                    infix: field.infix ?? undefined,
                    locale: field.locale ?? undefined,
                    stem: field.stem ?? undefined,
                });
            }

            const collection = await this._searchInterface.createCollection({
                name: collectionName,
                fields,
            });

            const apiKey = await this._searchInterface.createApiKey({
                description: `API Key for \`${collectionName}\``,
                actions: ['documents:search'],
                collections: [collectionName],
            });

            return success({
                address: item.address,
                markers: item.markers,
                collectionName: collection.name,
                searchApiKey: apiKey.value,
            });
        } else if (action === 'update') {
            // For updates, we need to update the existing collection's schema
            if (!existingItem) {
                return failure({
                    errorCode: 'record_not_found',
                    errorMessage:
                        'Cannot update a search record that does not exist.',
                });
            }

            // Build the updated fields array
            const fields: UpdatedSearchCollectionField[] = [];

            for (let key in item.schema) {
                const field = item.schema[key];
                fields.push({
                    name: key,
                    type: field.type,
                    optional: field.optional ?? undefined,
                    index: field.index ?? undefined,
                    store: field.store ?? undefined,
                    sort: field.sort ?? undefined,
                    infix: field.infix ?? undefined,
                    locale: field.locale ?? undefined,
                    stem: field.stem ?? undefined,
                    drop: field.drop ?? undefined,
                });
            }

            // Update the collection schema
            const updateResult = await this._searchInterface.updateCollection({
                name: existingItem.collectionName,
                fields,
                defaultSortingField: 'address',
            });

            if (!updateResult) {
                return failure({
                    errorCode: 'server_error',
                    errorMessage:
                        'Failed to update the search collection schema.',
                });
            }

            return success({
                address: item.address,
                markers: item.markers,
                collectionName: existingItem.collectionName,
                searchApiKey: existingItem.searchApiKey,
            });
        }
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: SearchRecordInput
    ): Promise<SearchRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getSearchFeatures(
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
                    'Search records are not allowed for this subscription.',
            };
        }

        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of search record items has been reached for your subscription.',
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

export type SearchRecordsSubscriptionMetricsResult =
    | SearchRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface SearchRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: SearchSubscriptionMetrics;
    features: NotificationFeaturesConfiguration;
}

export const SEARCH_COLLECTION_FIELD = z.object({
    type: z.enum([
        'string',
        'string[]',
        'int32',
        'int32[]',
        'int64',
        'int64[]',
        'float',
        'float[]',
        'bool',
        'bool[]',
        'geopoint',
        'geopoint[]',
        'geopolygon',
        'object',
        'object[]',
        'string*',
        'image',
        'auto',
    ]),
    // facet: z.boolean()
    //     .describe('Enables faceting on the field. Defaults to `false`.')
    //     .optional()
    //     .nullable(),
    optional: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to `true`, the field can have empty, null or missing values. Default: `false`.'
        ),
    index: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to `false`, the field will not be indexed in any in-memory index (e.g. search/sort/filter/facet). Default: `true`.'
        ),
    store: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to `false`, the field value will not be stored on disk. Default: `true`.'
        ),
    sort: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to true, the field will be sortable. Default: `true` for numbers, `false` otherwise.'
        ),
    infix: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to `true`, the field value can be infix-searched. Incurs significant memory overhead. Default: `false`.'
        ),
    locale: z
        .string()
        .max(10)
        .optional()
        .nullable()
        .describe(
            'For configuring language specific tokenization, e.g. `jp` for Japanese. Default: `en` which also broadly supports most European languages.'
        ),
    stem: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to `true`, the field value will be stemmed. Default: `false`.'
        ),
    drop: z
        .boolean()
        .optional()
        .nullable()
        .describe(
            'When set to `true`, the field will be dropped from the collection if it is not present in the input. Default: `false`.'
        ),
});

export const SEARCH_COLLECTION_SCHEMA = z
    .object({})
    .catchall(SEARCH_COLLECTION_FIELD)
    .refine((val) => Object.keys(val).length < 100, {
        error: 'Search collections cannot have more than 100 fields.',
    })
    .refine((val) => Object.keys(val).length >= 1, {
        error: 'Search collections must have at least 1 field.',
    });

/**
 * Defines the schema for a search collection.
 *
 * @doctitle Search Types
 * @docsidebar Search
 * @docdescription Search types define the structure of data that can be stored in search collections.
 * @dochash types/records/search
 * @docName SearchCollectionSchema
 */
export interface SearchCollectionSchema {
    /**
     * The schema that defines the fields in the search collection.
     */
    [key: string]: SearchCollectionSchemaField;
}

/**
 * Defines a field for a search collection schema.
 *
 * @dochash types/records/search
 * @docname SearchCollectionField
 */
export interface SearchCollectionSchemaField
    extends Omit<SearchCollectionField, 'name'> {}

export const SEARCH_DOCUMENT_SCHEMA = z
    .object({
        recordName: RECORD_NAME_VALIDATION.optional().nullable(),
        address: ADDRESS_VALIDATION.optional().nullable(),
        resourceKind: RESOURCE_KIND_VALIDATION().optional().nullable(),
    })
    .catchall(
        z.union([
            // Limit top level strings to 10 * 1024 characters (10KB)
            z.string().max(10 * 1024),
            z.number(),
            z.boolean(),

            // Limit arrays to 100 items, with each item being a string of max 1024 characters (1KB)
            z
                .array(
                    z.string().max(1024) // (1KB)
                )
                .max(100),
            z.array(z.number()),
            z.array(z.boolean()),
            z
                .object({})
                .catchall(
                    z.union([
                        // Limit strings in nested objects to 1024 characters (1KB)
                        z.string().max(1024),
                        z.number(),
                        z.boolean(),
                    ])
                )
                .refine((val) => Object.keys(val).length < 15, {
                    error: 'Nested objects cannot have more than 15 keys.',
                }),
        ])
    )
    .refine((val) => Object.keys(val).length < 100, {
        error: 'Search documents cannot have more than 100 keys.',
    });

export interface SearchRecordInput
    extends Omit<SearchRecord, 'collectionName' | 'searchApiKey'> {
    /**
     * The schema that should be used for the documents into the search record collection.
     *
     * This is also used to validate the documents that are added to the collection.
     */
    schema: z.infer<typeof SEARCH_COLLECTION_SCHEMA>;
}

/**
 * Defines a record that represents a collection of documents that can be searched.
 *
 * @dochash types/records/search
 * @docName SearchRecord
 */
export interface SearchRecordOutput extends SearchRecord {
    /**
     * The search nodes that should be used by clients to connect to the search engine.
     */
    nodes?: SearchNode[];

    /**
     * The schema that is defined in the schema.
     */
    schema?: SearchCollectionSchema;
}

export interface StoreDocumentRequest {
    /**
     * The name of the record that the document should be stored in.
     */
    recordName: string;

    /**
     * The address of the search record that the document should be stored in.
     */
    address: string;

    /**
     * The document to store in the search record.
     */
    document: SearchDocument;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The instance(s) that are making the request.
     */
    instances: string[];
}

/**
 * Defines the result of an store document operation.
 *
 * @dochash types/records/search
 * @docname StoreDocumentResult
 */
export type StoreDocumentResult = Result<SearchDocumentInfo, SimpleError>;

export interface EraseDocumentRequest {
    /**
     * The name of the record that the document should be erased from.
     */
    recordName: string;

    /**
     * The address of the search record that the document should be erased from.
     */
    address: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The ID of the document to erase.
     */
    documentId: string;

    /**
     * The instance(s) that are making the request.
     */
    instances: string[];
}

/**
 * Defines the result of an erase document operation.
 *
 * @dochash types/records/search
 * @docname EraseDocumentResult
 */
export type EraseDocumentResult = Result<SearchDocumentInfo, SimpleError>;

export interface SyncSearchRecordRequest {
    /**
     * The name of the record that should be synced.
     */
    recordName: string;

    /**
     * The address of the search record that should be synced.
     */
    address: string;

    /**
     * The name of the record that the data should be synced from.
     */
    targetRecordName: string;

    /**
     * The kind of resources that should be synced.
     */
    targetResourceKind: ResourceKinds;

    /**
     * The marker of the resources that should be synced.
     */
    targetMarker: string;

    /**
     * The mapping of the target properties to the search document properties.
     */
    targetMapping: [string, string][];

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * The instance(s) that are making the request.
     */
    instances: string[];
}

export type SyncSearchRecordResult = Result<{ syncId: string }, SimpleError>;

export interface UnsyncSearchRecordRequest {
    /**
     * The ID of the sync that should be deleted.
     */
    syncId: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * The instance(s) that are making the request.
     */
    instances: string[];
}

export type UnsyncSearchRecordResult = Result<void, SimpleError>;

export interface SearchRequest {
    /**
     * The name of the record that the search should be performed on.
     */
    recordName: string;

    /**
     * The address of the search record that the search should be performed on.
     */
    address: string;

    /**
     * The search query.
     */
    query: SearchQuery;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * The instance(s) that are making the request.
     */
    instances: string[];
}
