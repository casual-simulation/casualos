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
    Entitlement,
    KnownErrorCodes,
    ResourceKinds,
} from '@casual-simulation/aux-common';
import {
    ACCOUNT_MARKER,
    PRIVATE_MARKER,
    ServerError,
} from '@casual-simulation/aux-common';
import type {
    AuthorizationContext,
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
    PolicyController,
    AuthorizeUserAndInstancesForResourcesResult,
    ConstructAuthorizationContextRequest,
    ResourceInfo,
} from '../../PolicyController';
import {
    AuthorizeSubjectFailure,
    getMarkerResourcesForCreation,
    getMarkerResourcesForUpdate,
} from '../../PolicyController';
import type {
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
    CrudRecordItemRequest,
    CrudRecordItemSuccess,
    CrudRecordItemFailure,
    CrudEraseItemResult,
    CrudListItemsResult,
    CrudGetItemFailure,
    CrudGetItemSuccess,
} from '../../crud';
import {
    CheckSubscriptionMetricsResult,
    CrudRecordsConfiguration,
    CrudRecordsController,
    CrudGetItemResult,
    CrudRecordItemResult,
} from '../../crud';
import type {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionKeySpecifier,
    PackageRecordVersionWithMetadata,
    PackageVersionRecordsStore,
    PackageVersionReview,
    PackageVersionSubscriptionMetrics,
} from './PackageVersionRecordsStore';
import type {
    PackageFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../../SubscriptionConfiguration';
import {
    getNotificationFeatures,
    getPackageFeatures,
    NotificationFeaturesConfiguration,
} from '../../SubscriptionConfiguration';
import type {
    SubCrudEraseItemRequest,
    SubCrudGetItemRequest,
    SubCrudListItemsRequest,
    SubCrudRecordsConfiguration,
} from '../../crud/sub/SubCrudRecordsController';
import { SubCrudRecordsController } from '../../crud/sub/SubCrudRecordsController';
import type { PackageRecordsStore } from '../PackageRecordsStore';
import { getHash } from '@casual-simulation/crypto';
import type {
    FileRecordsController,
    ReadFileResult,
    RecordFileRequest,
    RecordFileResult,
} from '../../FileRecordsController';
import {
    ReadFileSuccess,
    RecordFileSuccess,
} from '../../FileRecordsController';
import type { ConfigurationStore } from '../../ConfigurationStore';
import { traced } from '../../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { SystemNotificationMessenger } from '../../SystemNotificationMessenger';
import type { UserRole } from '../../AuthStore';
import { isPackageReviewerRole, isSuperUserRole } from '../../AuthUtils';
import { v7 as uuid } from 'uuid';
import type { PackageRecordsController } from '../PackageRecordsController';
import { isEqual } from 'lodash';
import { record } from 'zod';

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
    /**
     * The controller that should be used for package records.
     */
    packages: PackageRecordsController;

    /**
     * The controller that should be used for file records.
     */
    files: FileRecordsController;

    /**
     * The controller that should be used for sending system notifications.
     */
    systemNotifications: SystemNotificationMessenger | null;
}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageVersionRecordsController {
    private _store: PackageVersionRecordsStore;
    private _recordStore: PackageRecordsStore;
    private _policies: PolicyController;
    private _packages: PackageRecordsController;
    private _config: ConfigurationStore;
    private _resourceKind: ResourceKinds;
    private _files: FileRecordsController;
    private _systemNotifications: SystemNotificationMessenger | null;
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
        this._packages = config.packages;
        this._config = config.config;
        this._files = config.files;
        this._systemNotifications = config.systemNotifications;
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

            let parentMarkers: string[];
            if (!existingItem.parentMarkers) {
                console.log(`[${this._name}] Parent package not found.`);
                parentMarkers = [PRIVATE_MARKER];
                const result = await this._packages.recordItem({
                    userId: request.userId,
                    recordKeyOrRecordName: recordName,
                    instances: request.instances,
                    item: {
                        address: request.item.address,
                        markers: parentMarkers,
                    },
                });

                if (result.success === false) {
                    return result;
                } else {
                    console.log(
                        `[${this._name}] Created parent package ${request.item.address}`
                    );
                }
            } else {
                parentMarkers = existingItem.parentMarkers;
            }

            let resourceMarkers: string[];
            let action = existingItem.item
                ? ('update' as const)
                : ('create' as const);
            let authorization: AuthorizeUserAndInstancesForResourcesResult;
            if (action === 'update') {
                const existingMarkers = existingItem.item.markers;
                resourceMarkers = request.item.markers ?? existingMarkers;
                // resourceMarkers = existingItem.item.markers;
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
                                ...getMarkerResourcesForUpdate(
                                    existingMarkers,
                                    resourceMarkers
                                ),
                            ],
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            } else {
                // TODO: Allow these markers to be inherited from the parent package.
                // When the markers are inherited, then the user shouldn't need permission to assign them.
                let usingGivenMarkers = true;
                resourceMarkers = request.item.markers;

                if (!resourceMarkers) {
                    resourceMarkers = parentMarkers;
                    usingGivenMarkers = false;
                }

                let resources: ResourceInfo[] = [
                    {
                        resourceKind: this._resourceKind,
                        resourceId: request.item.address,
                        action: action,
                        markers: resourceMarkers,
                    },
                ];

                if (!usingGivenMarkers) {
                    resources.push(
                        ...getMarkerResourcesForCreation(resourceMarkers)
                    );
                }

                // TODO: Make sure that whenever the user is selecting markers that they also have permissions to
                // assign the markers they are selecting.
                authorization =
                    await this._policies.authorizeUserAndInstancesForResources(
                        contextResult.context,
                        {
                            userId: request.userId,
                            instances: request.instances,
                            resources,
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            }

            if (!resourceMarkers || resourceMarkers.length <= 0) {
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

            if (action === 'update') {
                const sizeInBytes = request.item.auxFileRequest.fileByteLength;
                const fileName = existingItem.item.auxFileName;
                const sha256 = getHash({
                    auxFileName: fileName,
                    auxSha256: request.item.auxFileRequest.fileSha256Hex,
                    createdAtMs: existingItem.item.createdAtMs,
                    entitlements: request.item.entitlements,
                    description: request.item.description,
                    sizeInBytes: sizeInBytes,
                });
                if (sha256 !== existingItem.item.sha256) {
                    return {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage:
                            'Updating package versions is not supported.',
                    };
                }
            }

            // TODO: File records should always be private if the system is creating them
            // so that the file can only be accessed via the package version API unless the user has access
            // to private items.
            //record file
            let recordFileResult = await this.files.recordFile(
                recordName,
                null,
                {
                    ...request.item.auxFileRequest,
                    markers: [PRIVATE_MARKER],
                    instances: request.instances,
                    userRole: 'system',
                }
            );

            if (recordFileResult.success === false) {
                if (recordFileResult.errorCode === 'file_already_exists') {
                    // Retry the request to see if the user has the ability to upload to a file record
                    // that has already been made but may not yet be uploaded.
                    // If the file record has been made, but not uplaoded, then this will succeed.
                    recordFileResult = await this.files.recordFile(
                        recordName,
                        contextResult.context.userId,
                        {
                            ...request.item.auxFileRequest,
                            markers: resourceMarkers,
                            instances: request.instances,
                        }
                    );
                }

                if (
                    recordFileResult.success === false &&
                    recordFileResult.errorCode !== 'file_already_exists'
                ) {
                    return recordFileResult;

                    // if (recordFileResult.errorCode === 'file_already_exists') {
                    //     // TODO:
                    //     // If the file already exists and has already been uploaded, then
                    //     // we should see if we need to update the file record markers to match the package version markers.

                    //     // if(recordFileResult.existingFileName) {

                    //     // }

                    // } else {
                    //     return recordFileResult;
                    // }
                }
            } else if (!isEqual(recordFileResult.markers, [PRIVATE_MARKER])) {
                // System is able to upload the file, but the file record has already been made with different markers and not uploaded.
                // In this case, we want to retry the request but with the user so that we can be sure the user has permission to upload the file.
                // Retry the request to see if the user has the ability to upload to a file record
                // that has already been made but may not yet be uploaded.
                // If the file record has been made, but not uplaoded, then this will succeed.
                recordFileResult = await this.files.recordFile(
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
            }

            const address = request.item.address;
            let item: PackageRecordVersion;

            if (action === 'create') {
                const createdAtMs = Date.now();
                const sizeInBytes = request.item.auxFileRequest.fileByteLength;
                const fileName =
                    recordFileResult.success === true
                        ? recordFileResult.fileName
                        : recordFileResult.existingFileName;

                if (!fileName) {
                    throw new Error(
                        'Unable to determine file name for package'
                    );
                }

                const sha256 = getHash({
                    auxFileName: fileName,
                    auxSha256: request.item.auxFileRequest.fileSha256Hex,
                    createdAtMs: createdAtMs,
                    entitlements: request.item.entitlements,
                    description: request.item.description,
                    sizeInBytes: sizeInBytes,
                });
                item = {
                    id: uuid(),
                    address: address,
                    entitlements: request.item.entitlements,
                    key: request.item.key,
                    description: request.item.description,
                    auxFileName: fileName,
                    auxSha256: request.item.auxFileRequest.fileSha256Hex,
                    sha256,
                    sizeInBytes,
                    createdAtMs,
                    createdFile: recordFileResult.success,
                    requiresReview: request.item.entitlements.some((e) =>
                        entitlementRequiresApproval(e)
                    ),
                    markers: resourceMarkers,
                };

                const crudResult = await this._store.putItem(recordName, item);

                if (crudResult.success === false) {
                    return crudResult;
                }

                await this._systemNotifications?.sendRecordNotification({
                    resource: 'package_version_publish',
                    action: 'created',
                    recordName: recordName,
                    resourceId: address,
                    timeMs: createdAtMs,
                    package: item,
                    markers: resourceMarkers,
                });
            } else {
                item = {
                    ...existingItem.item,
                    markers: resourceMarkers,
                };
                const crudResult = await this._store.putItem(recordName, item);

                if (crudResult.success === false) {
                    return crudResult;
                }
            }

            return {
                success: true,
                recordName,
                address: item.address,
                auxFileResult: recordFileResult,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
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
        request: SubCrudGetItemRequest<PackageRecordVersionKeySpecifier>
    ): Promise<GetPackageVersionResult> {
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

            const result = await this._store.getItemBySpecifier(
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
            const markers = result.parentMarkers;
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
                id: result.item.id,
                address: result.item.address,
                key: result.item.key,
                auxFileName: result.item.auxFileName,
                createdAtMs: result.item.createdAtMs,
                auxSha256: result.item.auxSha256,
                createdFile: result.item.createdFile,
                entitlements: result.item.entitlements,
                markers: result.item.markers,
                description: result.item.description,
                requiresReview: result.item.requiresReview,
                sha256: result.item.sha256,
                sizeInBytes: result.item.sizeInBytes,
                packageId: result.packageId,
                approved: true,
                approvalType: 'normal',
            };

            if (item.requiresReview) {
                let review = await this.store.getMostRecentPackageVersionReview(
                    item.id
                );

                item.approved = review?.approved ?? false;
                item.approvalType = review?.approvalType ?? null;
            }

            const auxFile = item.createdFile
                ? await this.files.readFile(
                      context.context.recordName,
                      item.auxFileName,
                      null,
                      undefined,
                      'system'
                  )
                : await this.files.readFile(
                      context.context.recordName,
                      item.auxFileName,
                      context.context.userId
                  );

            return {
                success: true,
                item: item,
                auxFile,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
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

            if (!result.item || !result.parentMarkers) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                };
            }

            const markers = result.parentMarkers;

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
            if (err instanceof Error) {
                span?.recordException(err);
            }
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

            const recordName = context.context.recordName;
            const packageRecord = await this._recordStore.getItemByAddress(
                recordName,
                request.address
            );

            if (!packageRecord) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The parent item was not found.',
                };
            }

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resourceKind: this._resourceKind,
                        action: 'list',
                        markers: packageRecord.markers,
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
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[${this._name}] Error listing items:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async reviewItem(
        request: ReviewPackageVersionRequest
    ): Promise<ReviewPackageVersionResult> {
        try {
            const packageVersion = await this.store.getItemById(
                request.packageVersionId
            );

            if (!packageVersion.item || !packageVersion.recordName) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The package version was not found.',
                };
            }

            const baseRequest: ConstructAuthorizationContextRequest = {
                recordKeyOrRecordName: packageVersion.recordName,
                userId: request.userId,
                userRole: request.userRole,
                sendNotLoggedIn: true,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            if (!isPackageReviewerRole(context.context.userRole)) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to submit reviews for package versions.',
                };
            }

            const now = Date.now();
            const reviewId = request.review.id ?? uuid();
            const result = await this.store.putReviewForVersion({
                id: reviewId,
                packageVersionId: request.packageVersionId,
                approved: request.review.approved,
                approvalType: request.review.approvalType,
                reviewComments: request.review.reviewComments,
                reviewingUserId: context.context.userId,
                reviewStatus: request.review.reviewStatus,
                createdAtMs: now,
                updatedAtMs: now,
            });

            if (result.success === false) {
                return result;
            }

            return {
                success: true,
                reviewId: reviewId,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[${this._name}] Error reviewing item:`, err);
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
            ownerId: context.recordOwnerId ?? undefined,
            studioId: context.recordStudioId ?? undefined,
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
                item &&
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
                    item &&
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
        }

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
    | 'createdAtMs'
    | 'sha256'
    | 'sizeInBytes'
    | 'auxFileName'
    | 'auxSha256'
    | 'createdFile'
    | 'requiresReview'
    | 'id'
    | 'markers'
> & {
    auxFileRequest: Omit<
        RecordFileRequest,
        'markers' | 'instances' | 'userRole'
    >;

    /**
     * The markers that should be used for the item if the package doesn't exist.
     */
    markers?: string[];
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
    config: SubscriptionConfiguration | null;
    metrics: PackageVersionSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}

export type GetPackageVersionResult =
    | GetPackageVersionSuccess
    | CrudGetItemFailure;

export interface GetPackageVersionSuccess
    extends CrudGetItemSuccess<PackageRecordVersionWithMetadata> {
    /**
     * The result of reading the aux file.
     *
     * If successful, then the user is authorized to read the file.
     * If unsuccessful, then the user is not authorized to read the file.
     */
    auxFile: ReadFileResult;
}

export type PackageVersionReviewInput = Omit<
    PackageVersionReview,
    | 'id'
    | 'packageVersionId'
    | 'reviewingUserId'
    | 'createdAtMs'
    | 'updatedAtMs'
> & {
    /**
     * The ID of the review.
     * If omitted, then a new review will be created.
     */
    id?: string;
};

export interface ReviewPackageVersionRequest {
    /**
     * The ID of the package version that the review is for.
     */
    packageVersionId: string;

    /**
     * The review that should be stored for the package version.
     */
    review: PackageVersionReviewInput;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string | null;

    /**
     * The role of the user that is currently logged in.
     * If userId is provided, then this should be null or undefined.
     */
    userRole?: UserRole;
}

export type ReviewPackageVersionResult =
    | ReviewPackageVersionSuccess
    | ReviewPackageVersionFailure;

export interface ReviewPackageVersionSuccess {
    success: true;

    /**
     * The ID of the review that was created or updated.
     */
    reviewId: string;
}

export interface ReviewPackageVersionFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}
