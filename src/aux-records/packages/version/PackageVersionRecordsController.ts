import {
    ACCOUNT_MARKER,
    ActionKinds,
    Entitlement,
    KnownErrorCodes,
    PRIVATE_MARKER,
    ResourceKinds,
    ServerError,
} from '@casual-simulation/aux-common';
import {
    AuthorizationContext,
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeSubjectFailure,
    PolicyController,
    AuthorizeUserAndInstancesForResourcesResult,
} from '../../PolicyController';
import {
    CheckSubscriptionMetricsResult,
    CrudRecordsConfiguration,
    CrudRecordsController,
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
    CrudGetItemResult,
    CrudRecordItemRequest,
    CrudRecordItemResult,
    CrudRecordItemSuccess,
    CrudRecordItemFailure,
    CrudEraseItemResult,
    CrudListItemsResult,
} from '../../crud';
import {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionWithMetadata,
    PackageVersionRecordsStore,
    PackageVersionSubscriptionMetrics,
} from './PackageVersionRecordsStore';
import {
    getNotificationFeatures,
    getPackageFeatures,
    NotificationFeaturesConfiguration,
    PackageFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../../SubscriptionConfiguration';
import {
    SubCrudEraseItemRequest,
    SubCrudGetItemRequest,
    SubCrudListItemsRequest,
    SubCrudRecordsConfiguration,
    SubCrudRecordsController,
} from '../../crud/sub/SubCrudRecordsController';
import { PackageRecordsStore } from '../PackageRecordsStore';
import { getHash } from '@casual-simulation/crypto';
import {
    FileRecordsController,
    RecordFileRequest,
    RecordFileResult,
    RecordFileSuccess,
} from '../../FileRecordsController';
import { ConfigurationStore } from '../../ConfigurationStore';
import { traced } from '../../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';

const TRACE_NAME = 'PackageVersionRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface PackageVersionRecordsConfiguration
    extends Omit<
        SubCrudRecordsConfiguration<
            PackageRecordVersionKey,
            PackageRecordVersion,
            PackageVersionRecordsStore,
            PackageRecordsStore
        >,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    files: FileRecordsController;
}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageVersionRecordsController {
    private _store: PackageVersionRecordsStore;
    private _recordStore: PackageRecordsStore;
    private _policies: PolicyController;
    private _config: ConfigurationStore;
    private _resourceKind: ResourceKinds;
    private _files: FileRecordsController;
    private _name: string = 'PackageVersionRecordsController';

    get store() {
        return this._store;
    }

    get config() {
        return this._config;
    }

    get policies() {
        return this._policies;
    }

    get files() {
        return this._files;
    }

    constructor(config: PackageVersionRecordsConfiguration) {
        this._store = config.store;
        this._recordStore = config.recordItemStore;
        this._policies = config.policies;
        this._config = config.config;
        this._files = config.files;
        this._resourceKind = 'package.version';
    }

    /**
     * Creates or updates an item in the given record.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async recordItem(
        request: CrudRecordItemRequest<PackageRecordVersionInput>
    ): Promise<RecordPackageVersionResult> {
        try {
            const contextResult =
                await this._policies.constructAuthorizationContext({
                    recordKeyOrRecordName: request.recordKeyOrRecordName,
                    userId: request.userId,
                });

            if (contextResult.success === false) {
                return contextResult;
            }

            const recordName = contextResult.context.recordName;
            const existingItem = await this._store.getItemByKey(
                recordName,
                request.item.address,
                request.item.key
            );

            if (!existingItem.markers) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The parent item was not found.',
                };
            }

            const resourceMarkers = existingItem.markers;

            let action = existingItem.item
                ? ('update' as const)
                : ('create' as const);
            let authorization: AuthorizeUserAndInstancesForResourcesResult;
            if (action === 'update') {
                action = 'update';
                authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: request.userId,
                            instances: request.instances,
                            resources: [
                                {
                                    resourceKind: this._resourceKind,
                                    resourceId: existingItem.item.address,
                                    action: action,
                                    markers: resourceMarkers,
                                },
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            } else {
                authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: request.userId,
                            instances: request.instances,
                            resources: [
                                {
                                    resourceKind: this._resourceKind,
                                    resourceId: request.item.address,
                                    action: action,
                                    markers: resourceMarkers,
                                },
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            }

            if (!resourceMarkers) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The item must have markers.',
                };
            }

            const subscriptionResult = await this._checkSubscriptionMetrics(
                action,
                contextResult.context,
                authorization,
                request.item
            );

            if (subscriptionResult.success === false) {
                return subscriptionResult;
            }

            //record file
            const recordFileResult = await this.files.recordFile(
                recordName,
                contextResult.context.userId,
                {
                    ...request.item.auxFileRequest,
                    markers: resourceMarkers,
                    instances: request.instances,
                }
            );

            if (
                recordFileResult.success === false &&
                recordFileResult.errorCode !== 'file_already_exists'
            ) {
                return recordFileResult;
            }

            const createdAtMs = Date.now();
            const sizeInBytes = request.item.auxFileRequest.fileByteLength;
            const fileName =
                recordFileResult.success === true
                    ? recordFileResult.fileName
                    : recordFileResult.existingFileName;
            const sha256 = getHash({
                auxFileName: fileName,
                auxSha256: request.item.auxFileRequest.fileSha256Hex,
                createdAtMs: createdAtMs,
                entitlements: request.item.entitlements,
                readme: request.item.readme,
                sizeInBytes: sizeInBytes,
            });

            const item: PackageRecordVersion = {
                address: request.item.address,
                entitlements: request.item.entitlements,
                key: request.item.key,
                readme: request.item.readme,
                auxFileName: fileName,
                auxSha256: request.item.auxFileRequest.fileSha256Hex,
                sha256,
                sizeInBytes,
                createdAtMs,
            };

            const crudResult = await this._store.putItem(recordName, item);

            if (crudResult.success === false) {
                return crudResult;
            }

            return {
                success: true,
                recordName,
                address: item.address,
                auxFileResult: recordFileResult,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[${this._name}] Error recording item:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Gets the item with the given address from the given record.
     * @param request The request to get the item.
     */
    @traced(TRACE_NAME)
    async getItem(
        request: SubCrudGetItemRequest<PackageRecordVersionKey>
    ): Promise<CrudGetItemResult<PackageRecordVersionWithMetadata>> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
                instances: request.instances,
            };

            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const result = await this._store.getItemByKey(
                context.context.recordName,
                request.address,
                request.key
            );

            if (!result.item) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.markers;
            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        resourceId: request.address,
                        action: 'read',
                        markers: markers,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const item: PackageRecordVersionWithMetadata = {
                ...result.item,
                approved: true,
            };

            if (item.entitlements.some((e) => entitlementRequiresApproval(e))) {
                let review = await this.store.getMostRecentPackageVersionReview(
                    context.context.recordName,
                    item.address,
                    item.key
                );

                item.approved = review?.approved ?? false;
            }

            return {
                success: true,
                item: item,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[${this._name}] Error getting item:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Deletes the item with the given address from the given record.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async eraseItem(
        request: SubCrudEraseItemRequest<PackageRecordVersionKey>
    ): Promise<CrudEraseItemResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const result = await this._store.getItemByKey(
                context.context.recordName,
                request.address,
                request.key
            );

            if (!result.item) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.markers;

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        resourceId: request.address,
                        action: 'delete',
                        markers,
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const recordName = context.context.recordName;
            const subscriptionResult = await this._checkSubscriptionMetrics(
                'delete',
                context.context,
                authorization
            );

            if (subscriptionResult.success === false) {
                return subscriptionResult;
            }

            await this._store.deleteItem(
                recordName,
                request.address,
                request.key
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[${this._name}] Error erasing item:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Lists items in the given record.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async listItems(
        request: SubCrudListItemsRequest
    ): Promise<CrudListItemsResult<PackageRecordVersion>> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
                instances: request.instances,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        action: 'list',
                        markers: [ACCOUNT_MARKER],
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const result2 = await this._store.listItems(
                context.context.recordName,
                request.address
            );

            return {
                success: true,
                recordName: context.context.recordName,
                items: result2.items.map((item) => item),
                totalCount: result2.totalCount,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[${this._name}] Error listing items:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: PackageRecordVersionInput
    ): Promise<PackageRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getPackageFeatures(
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
                errorMessage: 'Packages are not allowed for this subscription.',
            };
        }

        if (action === 'create') {
            if (typeof features.maxPackageVersions === 'number') {
                if (metrics.totalItems >= features.maxPackageVersions) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum number of package versions has been reached for your subscription.',
                    };
                }
            }

            if (
                typeof features.maxPackageVersionSizeInBytes === 'number' &&
                item.auxFileRequest.fileByteLength >=
                    features.maxPackageVersionSizeInBytes
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The package version is too large for your subscription.',
                };
            }

            if (
                action === 'create' &&
                typeof features.maxPackageBytesTotal === 'number'
            ) {
                if (
                    metrics.totalPackageVersionBytes +
                        item.auxFileRequest.fileByteLength >=
                    features.maxPackageBytesTotal
                ) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum size of package versions has been reached for your subscription.',
                    };
                }
            }
        } else if (action === 'update') {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Updating package versions is not supported.',
            };
        }
        // else if (action === 'read') {
        //     if (item) {
        //
        //     }
        // }

        return {
            success: true,
            config,
            metrics,
            features,
        };
    }
}

/**
 * Determines whether the given entitlement requires approval.
 * @param entitlement The entitlement to test.
 */
export function entitlementRequiresApproval(entitlement: Entitlement): boolean {
    return entitlement.scope === 'shared' || entitlement.scope === 'designated';
}

export type PackageRecordVersionInput = Omit<
    PackageRecordVersion,
    'createdAtMs' | 'sha256' | 'sizeInBytes' | 'auxFileName' | 'auxSha256'
> & {
    auxFileRequest: Omit<RecordFileRequest, 'markers' | 'instances'>;
};

export type RecordPackageVersionResult =
    | RecordPackageVersionSuccess
    | CrudRecordItemFailure;

export interface RecordPackageVersionSuccess extends CrudRecordItemSuccess {
    /**
     * The result of recording the aux file.
     */
    auxFileResult: RecordFileResult;
}

export type PackageRecordsSubscriptionMetricsResult =
    | PackageRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface PackageRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: PackageVersionSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}
