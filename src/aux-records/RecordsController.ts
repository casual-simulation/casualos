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
    ListedRecord,
    ListedStudioAssignment,
    RecordsStore,
    Studio,
    StudioAssignmentRole,
    StudioComIdRequest,
    LoomConfig,
    HumeConfig,
} from './RecordsStore';
import type {
    StripeAccountStatus,
    StripeRequirementsStatus,
} from './StripeInterface';
import {
    hashHighEntropyPasswordWithSalt,
    hashLowEntropyPasswordWithSalt,
} from './InstrumentedHashHelpers';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import type {
    NotAuthorizedError,
    NotLoggedInError,
    NotSupportedError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import type { ValidateSessionKeyFailure } from './AuthController';
import type { AuthStore } from './AuthStore';
import { v4 as uuid } from 'uuid';
import type { MetricsStore, SubscriptionFilter } from './MetricsStore';
import type { ConfigurationStore } from './ConfigurationStore';
import type {
    AIHumeFeaturesConfiguration,
    PurchasableItemFeaturesConfiguration,
    StudioComIdFeaturesConfiguration,
    StudioLoomFeaturesConfiguration,
} from './SubscriptionConfiguration';
import {
    getComIdFeatures,
    getHumeAiFeatures,
    getLoomFeatures,
    getPurchasableItemsFeatures,
    getSubscriptionFeatures,
    getSubscriptionTier,
    storeFeaturesSchema,
} from './SubscriptionConfiguration';
import type { ComIdConfig, ComIdPlayerConfig } from './ComIdConfig';
import { isActiveSubscription } from './Utils';
import type { SystemNotificationMessenger } from './SystemNotificationMessenger';
import type {
    CasualOSConfig,
    Result,
    SimpleError,
} from '@casual-simulation/aux-common';
import { isSuperUserRole, success } from '@casual-simulation/aux-common';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { PrivoClientInterface } from './PrivoClient';
import type { PublicRecordKeyPolicy } from '@casual-simulation/aux-common/records/RecordKeys';
import {
    DEFAULT_RECORD_KEY_POLICY,
    formatV2RecordKey,
    parseRecordKey,
} from '@casual-simulation/aux-common/records/RecordKeys';
import type z from 'zod';

const TRACE_NAME = 'RecordsController';

export interface RecordsControllerConfig {
    store: RecordsStore;
    auth: AuthStore;
    metrics: MetricsStore;
    config: ConfigurationStore;
    messenger: SystemNotificationMessenger | null;
    privo: PrivoClientInterface | null;
}

/**
 * Defines a class that manages records and their keys.
 */
export class RecordsController {
    private _store: RecordsStore;
    private _auth: AuthStore;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;
    private _messenger: SystemNotificationMessenger | null;
    private _privo: PrivoClientInterface | null;

    constructor(config: RecordsControllerConfig) {
        this._store = config.store;
        this._auth = config.auth;
        this._metrics = config.metrics;
        this._config = config.config;
        this._messenger = config.messenger;
        this._privo = config.privo;
    }

    /**
     * Creates a new record.
     * @param request The request that should be used to create the record.
     */
    @traced(TRACE_NAME)
    async createRecord(
        request: CreateRecordRequest
    ): Promise<CreateRecordResult> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to create a record.',
                };
            }

            const record = await this._store.getRecordByName(
                request.recordName
            );

            if (record) {
                if (
                    record.name === request.userId &&
                    record.ownerId !== request.userId &&
                    request.ownerId === request.userId
                ) {
                    const allowed =
                        await this._doesSubscriptionAllowToCreateRecord({
                            ownerId: request.userId,
                        });

                    if (!allowed.success) {
                        return allowed;
                    }

                    console.log(
                        `[RecordsController] [action: record.create recordName: ${record.name}, userId: ${request.userId}] Fixing record owner to match actual owner.`
                    );

                    record.ownerId = request.userId;
                    record.studioId = null;
                    // Clear the hashes and re-create the salt so that access to the record is revoked for any record key that was created before.
                    record.secretHashes = [];
                    record.secretSalt = this._createSalt();
                    await this._store.updateRecord({
                        ...record,
                    });

                    return {
                        success: true,
                    };
                }

                let existingStudioMembers =
                    await this._store.listStudioAssignments(record.name);
                if (
                    existingStudioMembers.length > 0 &&
                    record.studioId !== record.name &&
                    request.studioId === record.name
                ) {
                    const allowed =
                        await this._doesSubscriptionAllowToCreateRecord({
                            studioId: request.studioId,
                        });

                    if (!allowed.success) {
                        return allowed;
                    }

                    console.log(
                        `[RecordsController] [action: record.create recordName: ${record.name}, userId: ${request.userId}, studioId: ${request.studioId}] Fixing record owner to match actual owner.`
                    );

                    record.ownerId = null;
                    record.studioId = request.studioId;
                    // Clear the hashes and re-create the salt so that access to the record is revoked for any record key that was created before.
                    record.secretHashes = [];
                    record.secretSalt = this._createSalt();
                    await this._store.updateRecord({
                        ...record,
                    });

                    return {
                        success: true,
                    };
                }

                return {
                    success: false,
                    errorCode: 'record_already_exists',
                    errorMessage: 'A record with that name already exists.',
                };
            }

            if (
                request.recordName !== request.ownerId &&
                request.recordName !== request.studioId
            ) {
                const existingUser = await this._auth.findUser(
                    request.recordName
                );
                if (existingUser) {
                    return {
                        success: false,
                        errorCode: 'record_already_exists',
                        errorMessage: 'A record with that name already exists.',
                    };
                }
            }

            if (!request.ownerId && !request.studioId) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'You must provide an owner ID or a studio ID.',
                };
            }

            if (request.ownerId) {
                if (request.ownerId !== request.userId) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to create a record for another user.',
                    };
                }

                const allowed = await this._doesSubscriptionAllowToCreateRecord(
                    {
                        ownerId: request.userId,
                    }
                );

                if (!allowed.success) {
                    return allowed;
                }

                console.log(
                    `[RecordsController] [action: record.create recordName: ${request.recordName}, userId: ${request.userId}, ownerId: ${request.ownerId}] Creating record.`
                );

                await this._store.addRecord({
                    name: request.recordName,
                    ownerId: request.ownerId,
                    secretHashes: [],
                    secretSalt: this._createSalt(),
                    studioId: null,
                });
            } else {
                const assignments = await this._store.listStudioAssignments(
                    request.studioId,
                    {
                        userId: request.userId,
                        role: 'admin',
                    }
                );

                if (assignments.length <= 0) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to create a record for this studio.',
                    };
                }

                const allowed = await this._doesSubscriptionAllowToCreateRecord(
                    {
                        studioId: request.studioId,
                    }
                );

                if (!allowed.success) {
                    return allowed;
                }

                console.log(
                    `[RecordsController] [action: record.create recordName: ${request.recordName}, userId: ${request.userId}, studioId: ${request.studioId}] Creating record.`
                );
                await this._store.addRecord({
                    name: request.recordName,
                    ownerId: null,
                    secretHashes: [],
                    secretSalt: this._createSalt(),
                    studioId: request.studioId,
                });
            }
            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [createRecord] An error occurred while creating a record:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Creates a new public record key for the given bucket name.
     * @param name The name of the record.
     * @param policy The policy that should be used for the public record key.
     * @param userId The ID of the user that is creating the public record.
     * @returns
     */
    @traced(TRACE_NAME)
    async createPublicRecordKey(
        name: string,
        policy: PublicRecordKeyPolicy,
        userId: string
    ): Promise<CreatePublicRecordKeyResult> {
        try {
            if (!userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to create a record key.',
                    errorReason: 'not_logged_in',
                };
            }

            if (
                !!policy &&
                policy !== 'subjectfull' &&
                policy !== 'subjectless'
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_policy',
                    errorMessage:
                        'The record key policy must be either "subjectfull" or "subjectless".',
                    errorReason: 'invalid_policy',
                };
            }

            let existingStudioMembers = await this._store.listStudioAssignments(
                name
            );

            let createResult: CreateRecordResult;
            // recordName matches studioId
            if (existingStudioMembers.length > 0) {
                createResult = await this.createRecord({
                    recordName: name,
                    userId: userId,
                    studioId: name,
                });
            } else {
                createResult = await this.createRecord({
                    recordName: name,
                    userId: userId,
                    ownerId: userId,
                });
            }

            if (createResult.success === false) {
                if (createResult.errorCode !== 'record_already_exists') {
                    return {
                        ...createResult,
                        errorReason: 'not_authorized',
                    };
                }
            }

            const record = await this._store.getRecordByName(name);

            if (!record) {
                if (
                    createResult.success === false &&
                    createResult.errorCode === 'record_already_exists'
                ) {
                    return {
                        success: false,
                        errorCode: 'unauthorized_to_create_record_key',
                        errorMessage:
                            'Another user has already created this record.',
                        errorReason: 'record_owned_by_different_user',
                    };
                }

                console.error(
                    `[RecordsController] [action: recordKey.create recordName: ${name}, userId: ${userId}] Unable to find record that was just created!`
                );

                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                    errorReason: 'server_error',
                };
            }

            if (record.ownerId) {
                if (existingStudioMembers.length > 0) {
                    console.error(
                        `[RecordsController] [action: recordKey.create recordName: ${name}, userId: ${userId}] Studio members exist for the record, but the record is owned by a user!`
                    );
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                        errorReason: 'server_error',
                    };
                }
                if (record.ownerId !== userId) {
                    return {
                        success: false,
                        errorCode: 'unauthorized_to_create_record_key',
                        errorMessage:
                            'Another user has already created this record.',
                        errorReason: 'record_owned_by_different_user',
                    };
                }
            } else if (record.studioId) {
                let existingStudioMembers =
                    await this._store.listStudioAssignments(record.studioId, {
                        userId: userId,
                        role: 'admin',
                    });

                if (existingStudioMembers.length <= 0) {
                    return {
                        success: false,
                        errorCode: 'unauthorized_to_create_record_key',
                        errorMessage:
                            'You are not authorized to create a record key for this record.',
                        errorReason: 'record_owned_by_different_user',
                    };
                }
            }

            console.log(
                `[RecordsController] [action: recordKey.create recordName: ${name}, userId: ${userId}] Creating record key.`
            );

            const passwordBytes = randomBytes(16);
            const password = fromByteArray(passwordBytes); // convert to human-readable string
            const salt = record.secretSalt;
            const passwordHash = this.hashHighEntropyPasswordWithSalt(
                password,
                salt
            );

            await this._store.addRecordKey({
                recordName: name,
                secretHash: passwordHash,
                policy: policy ?? DEFAULT_RECORD_KEY_POLICY,
                creatorId: record.ownerId ?? userId,
            });

            return {
                success: true,
                recordKey: formatV2RecordKey(name, password, policy),
                recordName: name,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [createPublicRecordKey] An error occurred while creating a public record key:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
                errorReason: 'server_error',
            };
        }
    }

    @traced(TRACE_NAME)
    hashHighEntropyPasswordWithSalt(
        sessionSecret: string,
        sessionId: string
    ): string {
        return hashHighEntropyPasswordWithSalt(sessionSecret, sessionId);
    }

    /**
     * Validates the given record key. Returns success if the key is valid and can be used to publish things to its bucket.
     * @param key The key that should be validated.
     * @returns
     */
    @traced(TRACE_NAME)
    async validatePublicRecordKey(
        key: string
    ): Promise<ValidatePublicRecordKeyResult> {
        try {
            const parseResult = parseRecordKey(key);

            if (!parseResult) {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.',
                };
            }

            const [name, password, policy] = parseResult;

            const record = await this._store.getRecordByName(name);

            if (!record) {
                return {
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                };
            }

            // Check v2 hashes first because they are much quicker to check
            const hashV2 = hashHighEntropyPasswordWithSalt(
                password,
                record.secretSalt
            );

            let valid = false;
            let resultPolicy: PublicRecordKeyPolicy = DEFAULT_RECORD_KEY_POLICY;
            let creatorId: string = null;
            if (record.secretHashes.some((h) => h === hashV2)) {
                valid = true;
                creatorId = record.ownerId;
            } else {
                const key = await this._store.getRecordKeyByRecordAndHash(
                    name,
                    hashV2
                );
                if (key) {
                    if (
                        name === record.ownerId &&
                        key.creatorId !== record.ownerId
                    ) {
                        // The record is a user record (because the name is the same as the owner ID)
                        // but this key was created when the record was owned by someone else.
                        // Normally, this shouldn't happen, but it is possible if the record was created before v3.2.0 or if the record was created before the user was created.
                        // This check is a failsafe to ensure that user records are always owned by the user, and not by someone else.
                        valid = false;
                    } else {
                        resultPolicy = key.policy;
                        creatorId = key.creatorId;
                        valid = true;
                    }
                } else {
                    // Check v1 hashes
                    const hash = hashLowEntropyPasswordWithSalt(
                        password,
                        record.secretSalt
                    );

                    if (record.secretHashes.some((h) => h === hash)) {
                        valid = true;
                    } else {
                        const key =
                            await this._store.getRecordKeyByRecordAndHash(
                                name,
                                hash
                            );

                        if (key) {
                            if (
                                name === record.ownerId &&
                                key.creatorId !== record.ownerId
                            ) {
                                // The record is a user record (because the name is the same as the owner ID)
                                // but this key was created when the record was owned by someone else.
                                // Normally, this shouldn't happen, but it is possible if the record was created before v3.2.0 or if the record was created before the user was created.
                                // This check is a failsafe to ensure that user records are always owned by the user, and not by someone else.
                                valid = false;
                            } else {
                                resultPolicy = key.policy;
                                creatorId = key.creatorId;
                                valid = true;
                            }
                        }
                    }
                }
            }

            if (resultPolicy !== policy) {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.',
                };
            }

            if (valid) {
                return {
                    success: true,
                    recordName: name,
                    policy: policy,
                    ownerId: record.ownerId,
                    keyCreatorId: creatorId ?? record.ownerId,
                };
            } else {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.',
                };
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [validatePublicRecordKey] An error occurred while creating a public record key:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Validates the given record name. Returns information about the record if it exists.
     * @param name The name of the record.
     * @param userId The ID of the user that is validating the record.
     */
    @traced(TRACE_NAME)
    async validateRecordName(
        name: string,
        userId: string | null
    ): Promise<ValidateRecordNameResult> {
        try {
            const record = await this._store.getRecordByName(name);

            if (!record) {
                if (userId && name === userId) {
                    const allowed =
                        await this._doesSubscriptionAllowToCreateRecord({
                            ownerId: userId,
                        });

                    if (allowed.success === false) {
                        return allowed;
                    }

                    console.log(
                        `[RecordsController] [validateRecordName recordName: ${name}, userId: ${userId}] Creating record for user.`
                    );
                    await this._store.addRecord({
                        name,
                        ownerId: userId,
                        studioId: null,
                        secretHashes: [],
                        secretSalt: this._createSalt(),
                    });

                    return {
                        success: true,
                        recordName: name,
                        ownerId: userId,
                        studioId: null,
                    };
                }

                let studioMembers = await this._store.listStudioAssignments(
                    name
                );

                if (studioMembers.length > 0) {
                    const allowed =
                        await this._doesSubscriptionAllowToCreateRecord({
                            studioId: name,
                        });

                    if (allowed.success === false) {
                        return allowed;
                    }

                    console.log(
                        `[RecordsController] [validateRecordName recordName: ${name}, userId: ${userId}, studioId: ${name}] Creating record for studio.`
                    );

                    await this._store.addRecord({
                        name,
                        ownerId: null,
                        studioId: name,
                        secretHashes: [],
                        secretSalt: this._createSalt(),
                    });

                    return {
                        success: true,
                        recordName: name,
                        ownerId: null,
                        studioId: name,
                        studioMembers,
                    };
                }

                return {
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: 'Record not found.',
                };
            } else if (
                userId &&
                record.name === userId &&
                record.ownerId !== userId
            ) {
                const allowed = await this._doesSubscriptionAllowToCreateRecord(
                    {
                        ownerId: userId,
                    }
                );

                if (allowed.success === false) {
                    return allowed;
                }

                // The user is not currently the owner of their own record.
                // This is an issue that needs to be fixed because users should always own the record that has the same name as their ID.
                console.log(
                    `[RecordsController] [validateRecordName recordName: ${name}, userId: ${userId}] Fixing record owner to match actual owner.`
                );

                record.ownerId = userId;
                // Clear the hashes and re-create the salt so that access to the record is revoked for any record key that was created before.
                record.secretHashes = [];
                record.secretSalt = this._createSalt();
                await this._store.updateRecord({
                    ...record,
                });
            }

            let existingStudioMembers = await this._store.listStudioAssignments(
                name
            );
            if (
                existingStudioMembers.length > 0 &&
                record.studioId !== name &&
                record.ownerId !== null
            ) {
                const allowed = await this._doesSubscriptionAllowToCreateRecord(
                    {
                        studioId: name,
                    }
                );

                if (allowed.success === false) {
                    return allowed;
                }

                console.log(
                    `[RecordsController] [validateRecordName recordName: ${name}, userId: ${userId}, studioId: ${name}] Fixing record studio to match actual studio.`
                );

                record.ownerId = null;
                record.studioId = name;
                record.secretHashes = [];
                record.secretSalt = this._createSalt();
                await this._store.updateRecord({
                    ...record,
                });
            }

            let studioMembers: ListedStudioAssignment[] = undefined;
            if (existingStudioMembers.length > 0) {
                studioMembers = existingStudioMembers;
            } else if (record.studioId) {
                studioMembers = await this._store.listStudioAssignments(
                    record.studioId
                );
            }

            return {
                success: true,
                recordName: name,
                ownerId: record.ownerId,
                studioId: record.studioId,
                studioMembers,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [validateRecordName] An error occurred while creating a validating a record name:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    private async _doesSubscriptionAllowToCreateRecord(
        filter: SubscriptionFilter
    ) {
        const { features, metrics } = await this._getSubscriptionFeatures(
            filter
        );

        if (!features.records?.allowed) {
            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            } as const;
        } else if (features.records?.maxRecords >= 0) {
            if (features.records.maxRecords <= metrics.totalRecords + 1) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: 'This subscription has hit its record limit.',
                } as const;
            }
        }

        return {
            success: true,
        } as const;
    }

    private async _getSubscriptionFeatures(filter: SubscriptionFilter) {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );
        const config = await this._config.getSubscriptionConfiguration();

        return {
            metrics,
            config,
            features: getSubscriptionFeatures(
                config,
                metrics.subscriptionStatus,
                metrics.subscriptionId,
                metrics.subscriptionType
            ),
        };
    }

    /**
     * Gets the list of records that the user with the given ID has access to.
     * @param userId The ID of the user.
     */
    @traced(TRACE_NAME)
    async listRecords(userId: string): Promise<ListRecordsResult> {
        try {
            if (!this._store.listRecordsByOwnerId) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }
            const records = await this._store.listRecordsByOwnerId(userId);
            return {
                success: true,
                records: records,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [listRecords] Error listing records: ',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Gets the list of records in the given studio that the user with the given ID has access to.
     * @param studioId The ID of the studio.
     * @param userId The ID of the user that is currently logged in.
     */
    @traced(TRACE_NAME)
    async listStudioRecords(
        studioId: string,
        userId: string
    ): Promise<ListRecordsResult> {
        try {
            if (!this._store.listRecordsByStudioIdAndUserId) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            const user = await this._auth.findUser(userId);
            if (isSuperUserRole(user?.role)) {
                const records = await this._store.listRecordsByStudioId(
                    studioId
                );
                return {
                    success: true,
                    records,
                };
            }

            const records = await this._store.listRecordsByStudioIdAndUserId(
                studioId,
                userId
            );
            return {
                success: true,
                records: records,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [listStudioRecords] Error listing records: ',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to create a new studio. That is, an entity that can be used to group records.
     * @param studioName The name of the studio.
     * @param userId The ID of the user that is creating the studio.
     */
    @traced(TRACE_NAME)
    async createStudio(
        studioName: string,
        userId: string
    ): Promise<CreateStudioResult> {
        try {
            const studioId = uuid();

            await this._store.createStudioForUser(
                {
                    id: studioId,
                    displayName: studioName,
                },
                userId
            );

            return {
                success: true,
                studioId: studioId,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [createStudio] An error occurred while creating a studio:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to create a new studio in the given comId. That is, an entity that can be used to group records.
     * @param studioName The name of the studio.
     * @param userId The ID of the user that is creating the studio.
     * @param comId The comId of the studio that this studio should belong to.
     */
    @traced(TRACE_NAME)
    async createStudioInComId(
        studioName: string,
        userId: string,
        comId: string
    ): Promise<CreateStudioInComIdResult> {
        try {
            const studioId = uuid();

            const existingStudio = await this._store.getStudioByComId(comId);

            if (!existingStudio) {
                return {
                    success: false,
                    errorCode: 'comId_not_found',
                    errorMessage: 'The given comId was not found.',
                };
            }

            const config = await this._config.getSubscriptionConfiguration();
            const features = getComIdFeatures(
                config,
                existingStudio.subscriptionStatus,
                existingStudio.subscriptionId
            );

            if (!features.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'comId features are not allowed for this comId. Make sure you have an active subscription that provides comId features.',
                };
            }

            if (typeof features.maxStudios === 'number') {
                const count = await this._store.countStudiosInComId(comId);
                if (count >= features.maxStudios) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum number of studios allowed for your comId subscription has been reached.',
                    };
                }
            }

            const comIdConfig = existingStudio.comIdConfig ?? {
                allowedStudioCreators: 'only-members',
            };

            if (comIdConfig.allowedStudioCreators === 'only-members') {
                const assignments = await this._store.listStudioAssignments(
                    existingStudio.id,
                    {
                        userId: userId,
                    }
                );

                if (assignments.length <= 0) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to create a studio in this comId.',
                    };
                }
            }

            await this._store.createStudioForUser(
                {
                    id: studioId,
                    displayName: studioName,
                    ownerStudioComId: comId,
                },
                userId
            );

            return {
                success: true,
                studioId: studioId,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [createStudio] An error occurred while creating a studio in a comId:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to update the given studio.
     */
    @traced(TRACE_NAME)
    async updateStudio(
        request: UpdateStudioRequest
    ): Promise<UpdateStudioResult> {
        try {
            const { id, loomConfig, humeConfig, ...updates } = request.studio;
            const existingStudio = await this._store.getStudioById(
                request.studio.id
            );

            if (!existingStudio) {
                return {
                    success: false,
                    errorCode: 'studio_not_found',
                    errorMessage: 'The given studio was not found.',
                };
            }

            const assignments = await this._store.listStudioAssignments(
                existingStudio.id,
                {
                    userId: request.userId,
                    role: 'admin',
                }
            );

            if (assignments.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to update this studio.',
                };
            }

            const final: Studio = {
                ...existingStudio,
                ...updates,
            };

            await this._store.updateStudio(final);

            if (loomConfig) {
                await this._store.updateStudioLoomConfig(final.id, loomConfig);
            }

            if (humeConfig) {
                await this._store.updateStudioHumeConfig(final.id, humeConfig);
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [updateStudio] An error occurred while updating a studio:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to get information about the given studio.
     * @param studioId The ID of the studio.
     * @param userId The ID of the user that is making this request.
     */
    @traced(TRACE_NAME)
    async getStudio(
        studioId: string,
        userId: string
    ): Promise<GetStudioResult> {
        try {
            const studio = await this._store.getStudioById(studioId);

            if (!studio) {
                return {
                    success: false,
                    errorCode: 'studio_not_found',
                    errorMessage: 'The given studio was not found.',
                };
            }

            const assignments = await this._store.listStudioAssignments(
                studio.id,
                {
                    userId: userId,
                }
            );

            if (assignments.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to access this studio.',
                };
            }

            let comIdFeatures: StudioComIdFeaturesConfiguration = {
                allowed: false,
            };
            let storeFeatures: PurchasableItemFeaturesConfiguration;
            let loomFeatures: StudioLoomFeaturesConfiguration = {
                allowed: false,
            };
            let humeFeatures: AIHumeFeaturesConfiguration = {
                allowed: false,
            };
            let loomConfig: LoomConfig = undefined;
            let humeConfig: HumeConfig = undefined;

            if (
                studio.subscriptionId &&
                isActiveSubscription(studio.subscriptionStatus)
            ) {
                const config =
                    await this._config.getSubscriptionConfiguration();
                comIdFeatures = getComIdFeatures(
                    config,
                    studio.subscriptionStatus,
                    studio.subscriptionId,
                    studio.subscriptionPeriodStartMs,
                    studio.subscriptionPeriodEndMs
                );
                loomFeatures = getLoomFeatures(
                    config,
                    studio.subscriptionStatus,
                    studio.subscriptionId,
                    studio.subscriptionPeriodStartMs,
                    studio.subscriptionPeriodEndMs
                );

                if (loomFeatures.allowed) {
                    loomConfig = await this._store.getStudioLoomConfig(
                        studio.id
                    );
                }

                humeFeatures = getHumeAiFeatures(
                    config,
                    studio.subscriptionStatus,
                    studio.subscriptionId,
                    'studio',
                    studio.subscriptionPeriodStartMs,
                    studio.subscriptionPeriodEndMs
                );

                if (humeFeatures.allowed) {
                    humeConfig = await this._store.getStudioHumeConfig(
                        studio.id
                    );
                }

                storeFeatures = getPurchasableItemsFeatures(
                    config,
                    studio.subscriptionStatus,
                    studio.subscriptionId,
                    'studio',
                    studio.subscriptionPeriodStartMs,
                    studio.subscriptionPeriodEndMs
                );
            } else {
                storeFeatures = storeFeaturesSchema.parse({
                    allowed: false,
                } satisfies z.input<typeof storeFeaturesSchema>);
            }

            return {
                success: true,
                studio: {
                    id: studio.id,
                    displayName: studio.displayName,
                    logoUrl: studio.logoUrl,
                    comId: studio.comId,
                    ownerStudioComId: studio.ownerStudioComId,
                    comIdConfig: studio.comIdConfig,
                    playerConfig: studio.playerConfig,
                    loomConfig: loomConfig
                        ? {
                              appId: loomConfig.appId,
                          }
                        : undefined,
                    humeConfig: humeConfig
                        ? {
                              apiKey: humeConfig.apiKey,
                          }
                        : undefined,
                    comIdFeatures: comIdFeatures,
                    storeFeatures: storeFeatures,
                    stripeAccountStatus: studio.stripeAccountStatus ?? null,
                    stripeRequirementsStatus:
                        studio.stripeAccountRequirementsStatus ?? null,
                    loomFeatures,
                    humeFeatures,
                },
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [getStudio] An error occurred while getting a studio:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to get the player config for the given comId.
     * @param comId The comId.
     */
    @traced(TRACE_NAME)
    async getPlayerConfig(comId: string): Promise<GetPlayerConfigResult> {
        try {
            const studio = await this._store.getStudioByComId(comId);

            if (!studio) {
                return {
                    success: false,
                    errorCode: 'comId_not_found',
                    errorMessage: 'The given comId was not found.',
                };
            }

            return {
                success: true,
                comId: studio.comId,
                displayName: studio.displayName,
                logoUrl: studio.logoUrl ?? null,
                playerConfig: studio.playerConfig ?? null,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [getPlayerConfig] An error occurred while getting the player config:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to get the web config.
     */
    @traced(TRACE_NAME)
    async getWebConfig(): Promise<Result<CasualOSConfig, SimpleError>> {
        const [config, subscriptions, privo] = await Promise.all([
            this._config.getWebConfig(),
            this._config.getSubscriptionConfiguration(),
            this._config.getPrivoConfiguration(),
        ]);

        return success({
            ...(config ?? {
                version: 2,
                causalRepoConnectionProtocol: 'websocket',
            }),
            studiosSupported: !!subscriptions,
            subscriptionsSupported: !!subscriptions,
            requirePrivoLogin: !!privo,
        });
    }

    /**
     * Gets the list of studios that the user with the given ID has access to.
     * @param userId The ID of the user.
     */
    @traced(TRACE_NAME)
    async listStudios(userId: string): Promise<ListStudiosResult> {
        try {
            const studios = await this._store.listStudiosForUser(userId);
            const config = await this._config.getSubscriptionConfiguration();
            return {
                success: true,
                studios: studios.map((s) => {
                    return {
                        studioId: s.studioId,
                        displayName: s.displayName,
                        role: s.role,
                        isPrimaryContact: s.isPrimaryContact,
                        subscriptionTier: getSubscriptionTier(
                            config,
                            s.subscriptionStatus,
                            s.subscriptionId,
                            'studio'
                        ),
                        ownerStudioComId: s.ownerStudioComId,
                        comId: s.comId,
                    };
                }),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [listStudios] An error occurred while listing studios:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Gets the list of studios that the user with the given ID has access to and that are owned by the given comId.
     * @param userId The ID of the user.
     * @param comId The comId.
     */
    @traced(TRACE_NAME)
    async listStudiosByComId(
        userId: string,
        comId: string
    ): Promise<ListStudiosResult> {
        try {
            const studios = await this._store.listStudiosForUserAndComId(
                userId,
                comId
            );
            const config = await this._config.getSubscriptionConfiguration();
            return {
                success: true,
                studios: studios.map((s) => {
                    return {
                        studioId: s.studioId,
                        displayName: s.displayName,
                        role: s.role,
                        isPrimaryContact: s.isPrimaryContact,
                        subscriptionTier: getSubscriptionTier(
                            config,
                            s.subscriptionStatus,
                            s.subscriptionId,
                            'studio'
                        ),
                        ownerStudioComId: s.ownerStudioComId,
                        comId: s.comId,
                    };
                }),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [listStudios] An error occurred while listing studios:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Gets the list of members in a studio.
     * @param studioId The ID of the studio.
     * @param userId The ID of the user that is currently logged in.
     */
    @traced(TRACE_NAME)
    async listStudioMembers(
        studioId: string,
        userId: string
    ): Promise<ListStudioMembersResult> {
        try {
            const members = await this._store.listStudioAssignments(studioId);

            const userAssignment = members.find((m) => m.userId === userId);

            let role: StudioAssignmentRole;
            if (!userAssignment) {
                const user = await this._auth.findUser(userId);
                if (!isSuperUserRole(user?.role)) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to access this studio.',
                    };
                } else {
                    role = 'admin';
                }
            } else {
                role = userAssignment.role;
            }

            const resultMembers: ListedStudioMember[] = await Promise.all(
                members.map(async (m) => {
                    if (this._privo && m.user.privoServiceId) {
                        const result = await this._privo.getUserInfo(
                            m.user.privoServiceId
                        );
                        return {
                            studioId: m.studioId,
                            userId: m.userId,
                            isPrimaryContact: m.isPrimaryContact,
                            role: m.role,
                            user: {
                                id: m.user.id,
                                name: result.givenName,
                                displayName: result.displayName,
                            },
                        };
                    } else {
                        return {
                            studioId: m.studioId,
                            userId: m.userId,
                            isPrimaryContact: m.isPrimaryContact,
                            role: m.role,
                            user: {
                                id: m.user.id,
                                name: m.user.name,
                                email: m.user.email,
                                phoneNumber: m.user.phoneNumber,
                            },
                        };
                    }
                })
            );

            if (role === 'admin') {
                return {
                    success: true,
                    members: resultMembers.map((m) => ({
                        studioId: m.studioId,
                        userId: m.userId,
                        isPrimaryContact: m.isPrimaryContact,
                        role: m.role,
                        user: {
                            id: m.user.id,
                            name: m.user.name,
                            email: m.user.email,
                            phoneNumber: m.user.phoneNumber,
                            displayName: m.user.displayName,
                        },
                    })),
                };
            }

            return {
                success: true,
                members: resultMembers.map((m) => ({
                    studioId: m.studioId,
                    userId: m.userId,
                    isPrimaryContact: m.isPrimaryContact,
                    role: m.role,
                    user: {
                        id: m.user.id,
                        name: m.user.name,
                        displayName: m.user.displayName,
                    },
                })),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [listStudioMembers] An error occurred while listing studio members:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async addStudioMember(
        request: AddStudioMemberRequest
    ): Promise<AddStudioMemberResult> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You must be logged in to add a studio member.',
                };
            }

            const list = await this._store.listStudioAssignments(
                request.studioId,
                {
                    userId: request.userId,
                    role: 'admin',
                }
            );

            if (list.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this operation.',
                };
            }

            let addedUserId: string = null;
            if (request.addedUserId) {
                addedUserId = request.addedUserId;
            } else if (request.addedEmail || request.addedPhoneNumber) {
                const addedUser = await this._auth.findUserByAddress(
                    request.addedEmail ?? request.addedPhoneNumber,
                    request.addedEmail ? 'email' : 'phone'
                );

                if (addedUser) {
                    addedUserId = addedUser.id;
                }
            }

            if (
                !addedUserId &&
                this._privo &&
                (request.addedEmail ||
                    request.addedPhoneNumber ||
                    request.addedDisplayName)
            ) {
                const privoServiceId = await this._privo.lookupServiceId({
                    displayName: request.addedDisplayName ?? undefined,
                    email: request.addedEmail ?? undefined,
                    phoneNumber: request.addedPhoneNumber ?? undefined,
                });

                if (privoServiceId) {
                    const user = await this._auth.findUserByPrivoServiceId(
                        privoServiceId
                    );
                    if (user) {
                        addedUserId = user.id;
                    }
                }
            }

            if (!addedUserId) {
                if (
                    this._privo &&
                    !request.addedEmail &&
                    !request.addedPhoneNumber &&
                    !request.addedUserId &&
                    !request.addedDisplayName
                ) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'You must provide a display name, email, phone number, or user ID to add a studio member.',
                    };
                } else if (
                    !this._privo &&
                    !request.addedEmail &&
                    !request.addedPhoneNumber &&
                    !request.addedUserId
                ) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'You must provide an email, phone number, or user ID to add a studio member.',
                    };
                }

                return {
                    success: false,
                    errorCode: 'user_not_found',
                    errorMessage: 'The user was not able to be found.',
                };
            }

            await this._store.addStudioAssignment({
                studioId: request.studioId,
                userId: addedUserId,
                isPrimaryContact: false,
                role: request.role,
            });

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [addStudioMember] An error occurred while adding a studio member:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async removeStudioMember(
        request: RemoveStudioMemberRequest
    ): Promise<RemoveStudioMemberResult> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You must be logged in to remove a studio member.',
                };
            }

            if (request.userId === request.removedUserId) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this operation.',
                };
            }

            const list = await this._store.listStudioAssignments(
                request.studioId,
                {
                    userId: request.userId,
                    role: 'admin',
                }
            );

            if (list.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this operation.',
                };
            }

            await this._store.removeStudioAssignment(
                request.studioId,
                request.removedUserId
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [removeStudioMember] An error occurred while removing a studio member:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async requestComId(request: ComIdRequest): Promise<ComIdRequestResult> {
        try {
            const existingStudio = await this._store.getStudioById(
                request.studioId
            );

            if (!existingStudio) {
                return {
                    success: false,
                    errorCode: 'studio_not_found',
                    errorMessage: 'The given studio was not found.',
                };
            }

            const assignments = await this._store.listStudioAssignments(
                request.studioId,
                {
                    role: 'admin',
                    userId: request.userId,
                }
            );

            if (assignments.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this operation.',
                };
            }

            const existingComIdStudio = await this._store.getStudioByComId(
                request.requestedComId
            );

            if (existingComIdStudio) {
                return {
                    success: false,
                    errorCode: 'comId_already_taken',
                    errorMessage: 'The given comID is already taken.',
                };
            }

            const id = uuid();
            const now = Date.now();
            const comIdRequest: StudioComIdRequest = {
                id,
                userId: request.userId,
                studioId: request.studioId,
                requestingIpAddress: request.ipAddress,
                requestedComId: request.requestedComId,
                createdAtMs: now,
                updatedAtMs: now,
            };

            await this._store.saveComIdRequest(comIdRequest);
            if (this._messenger) {
                await this._messenger.sendRecordNotification({
                    timeMs: now,
                    resource: 'studio_com_id_request',
                    action: 'created',
                    recordName: null,
                    resourceId: comIdRequest.studioId,
                    request: comIdRequest,
                });
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[RecordsController] [requestComId] An error occurred while requesting a comId:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    private _createSalt(): string {
        return fromByteArray(randomBytes(16));
    }
}

/**
 * Defines an interface that represents a request to create a record.
 */
export interface CreateRecordRequest {
    /**
     * The name of the record that should be created.
     */
    recordName: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The ID of the user that should be the owner of the record.
     */
    ownerId?: string;

    /**
     * The ID of the studio that should own the record.
     */
    studioId?: string;
}

export type CreateRecordResult = CreateRecordSuccess | CreateRecordFailure;

export interface CreateRecordSuccess {
    success: true;
}

export interface CreateRecordFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | SubscriptionLimitReached
        | 'record_already_exists'
        | 'unacceptable_request';
    errorMessage: string;
}

export type ValidatePublicRecordKeyResult =
    | ValidatePublicRecordKeySuccess
    | ValidatePublicRecordKeyFailure;

/**
 * Defines an interface that represents the result of a "validate public record key" operation.
 */
export interface ValidatePublicRecordKeySuccess {
    success: true;

    /**
     * The name of the record that the key is for.
     */
    recordName: string;

    /**
     * The ID of the user that owns the record.
     */
    ownerId: string;

    /**
     * The ID of the user that created the key.
     */
    keyCreatorId: string;

    /**
     * The policy for the record key.
     */
    policy: PublicRecordKeyPolicy;
}

/**
 * Defines an interface that represents a failed "validate public record key" result.
 */
export interface ValidatePublicRecordKeyFailure {
    /**
     * Whether the operation was successful.
     */
    success: false;

    /**
     * The type of error that occurred.
     */
    errorCode: InvalidRecordKey | ServerError | 'record_not_found';

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines an interface that represents the result of a "create public record key" operation.
 *
 * @dochash types/records/key
 * @doctitle Record Key Types
 * @docsidebar Record Keys
 * @docdescription Types that are used for actions that manage record keys.
 * @docgroup 01-key
 * @docorder 0
 * @docname CreatePublicRecordKeyResult
 */
export type CreatePublicRecordKeyResult =
    | CreatePublicRecordKeySuccess
    | CreatePublicRecordKeyFailure;

/**
 * Defines an interface that represents a successful "create public record key" result.
 *
 * @dochash types/records/key
 * @docgroup 01-key
 * @docorder 1
 * @docname CreatePublicRecordKeySuccess
 */
export interface CreatePublicRecordKeySuccess {
    /**
     * Whether the operation was successful.
     */
    success: true;

    /**
     * The key that was created.
     */
    recordKey: string;

    /**
     * The name of the record the key was created for.
     */
    recordName: string;
}

/**
 * Defines an interface that represents a failed "create public record key" result.
 *
 * @dochash types/records/key
 * @docgroup 01-key
 * @docorder 2
 * @docname CreatePublicRecordKeyFailure
 */
export interface CreatePublicRecordKeyFailure {
    /**
     * Whether the operation was successful.
     */
    success: false;

    /**
     * The type of error that occurred.
     */
    errorCode:
        | UnauthorizedToCreateRecordKeyError
        | NotLoggedInError
        | ValidateSessionKeyFailure['errorCode']
        | SubscriptionLimitReached
        | 'record_already_exists'
        | 'unacceptable_request'
        | 'invalid_policy'
        | ServerError
        | NotAuthorizedError
        | 'not_supported';

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The unique reason as to why the error occurred.
     */
    errorReason?:
        | 'user_denied'
        | NotLoggedInError
        | 'record_owned_by_different_user'
        | 'invalid_policy'
        | 'not_supported'
        | 'not_authorized'
        | ServerError;
}

export type ValidateRecordNameResult =
    | ValidateRecordNameSuccess
    | ValidateRecordNameFailure;

export interface ValidateRecordNameSuccess {
    success: true;
    recordName: string;
    ownerId: string;
    studioId: string;

    /**
     * The IDs of the members of the studio.
     */
    studioMembers?: ListedStudioAssignment[];
}

export interface ValidateRecordNameFailure {
    success: false;
    errorCode:
        | ValidatePublicRecordKeyFailure['errorCode']
        | 'not_authorized'
        | SubscriptionLimitReached
        | ServerError;
    errorMessage: string;
}

/**
 * The possible results of a "list records" operation.
 */
export type ListRecordsResult = ListRecordsSuccess | ListRecordsFailure;

/**
 * Defines an interface that represents a successful "list records" result.
 */
export interface ListRecordsSuccess {
    success: true;

    /**
     * The list of records.
     */
    records: ListedRecord[];
}

/**
 * Defines an interface that represents a failed "list records" result.
 */
export interface ListRecordsFailure {
    success: false;
    /**
     * The type of error that occurred.
     */
    errorCode:
        | NotLoggedInError
        | NotAuthorizedError
        | NotSupportedError
        | ServerError;

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines an error that occurs when a user is not authorized to create a key for the public record.
 * This may happen when the user is not the owner of the record.
 */
export type UnauthorizedToCreateRecordKeyError =
    'unauthorized_to_create_record_key';

/**
 * Defines an error that occurs when an invalid record key is used to
 */
export type InvalidRecordKey = 'invalid_record_key';

export type CreateStudioResult = CreateStudioSuccess | CreateStudioFailure;

export interface CreateStudioSuccess {
    success: true;
    studioId: string;
}

export interface CreateStudioFailure {
    success: false;
    errorCode: NotLoggedInError | NotAuthorizedError | ServerError;
    errorMessage: string;
}

export type CreateStudioInComIdResult =
    | CreateStudioSuccess
    | CreateStudioInComIdFailure;

export interface CreateStudioInComIdFailure {
    success: false;
    errorCode:
        | 'comId_not_found'
        | 'subscription_limit_reached'
        | NotLoggedInError
        | NotAuthorizedError
        | ServerError;
    errorMessage: string;
}

/**
 * Defines the list of possible results for the {@link os.listUserStudios} function.
 *
 * @dochash types/records/studios
 * @doctitle Studio Types
 * @docsidebar Studios
 * @docdescription Types that are used for actions that manage studios.
 * @docname ListStudiosResult
 */
export type ListStudiosResult = ListStudiosSuccess | ListStudiosFailure;

/**
 * Defines an interface that represents a successful "list studios" result.
 *
 * @dochash types/records/studios
 * @docname ListStudiosSuccess
 */
export interface ListStudiosSuccess {
    success: true;

    /**
     * The list of studios that the user is a member of.
     */
    studios: ListedStudio[];
}

/**
 * Defines an interface that represents a failed "list studios" result.
 *
 * @dochash types/records/studios
 * @docname ListStudiosFailure
 */
export interface ListStudiosFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode: NotLoggedInError | NotAuthorizedError | ServerError;

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines an interface that represents a studio that has been listed.
 *
 * @dochash types/records/studios
 * @docname ListedStudio
 */
export interface ListedStudio {
    /**
     * The ID of the studio.
     */
    studioId: string;

    /**
     * The name of the studio.
     */
    displayName: string;

    /**
     * The role that the user has in the studio.
     */
    role: StudioAssignmentRole;

    /**
     * Whether the user is the primary contact for this studio.
     */
    isPrimaryContact: boolean;

    /**
     * The tier of the studio's subscription.
     */
    subscriptionTier: string;

    /**
     * The comId of the studio that owns this one.
     */
    ownerStudioComId: string | null;

    /**
     * The comId of this studio.
     */
    comId: string | null;
}

export type ListStudioMembersResult =
    | ListStudioMembersSuccess
    | ListStudioMembersFailure;

export interface ListStudioMembersSuccess {
    success: true;
    members: ListedStudioMember[];
}

export interface ListedStudioMember {
    userId: string;
    studioId: string;
    role: 'admin' | 'member';
    isPrimaryContact: boolean;
    user: ListedStudioMemberUser;
}

export interface ListedStudioMemberUser {
    id: string;
    name: string;
    email?: string;
    phoneNumber?: string;
    displayName?: string;
}

export interface ListStudioMembersFailure {
    success: false;
    errorCode: NotLoggedInError | NotAuthorizedError | ServerError;
    errorMessage: string;
}

export interface AddStudioMemberRequest {
    /**
     * The ID of the studio.
     */
    studioId: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The email address of the user that should be added to the studio.
     */
    addedEmail?: string;

    /**
     * The phone number of the user that should be added to the studio.
     */
    addedPhoneNumber?: string;

    /**
     * The ID of the user that should be added to the studio.
     */
    addedUserId?: string;

    /**
     * The display name of the user that should be added to the studio.
     */
    addedDisplayName?: string;

    /**
     * The role that the added user should have in the studio.
     */
    role: StudioAssignmentRole;
}

export type AddStudioMemberResult =
    | AddStudioMemberSuccess
    | AddStudioMemberFailure;

export interface AddStudioMemberSuccess {
    success: true;
}

export interface AddStudioMemberFailure {
    success: false;
    errorCode:
        | NotLoggedInError
        | NotAuthorizedError
        | ServerError
        | 'studio_not_found'
        | 'unacceptable_request'
        | 'user_not_found';
    errorMessage: string;
}

export interface RemoveStudioMemberRequest {
    /**
     * The ID of the studio.
     */
    studioId: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The ID of the user that should be removed from the studio.
     */
    removedUserId: string;
}

export type RemoveStudioMemberResult =
    | RemoveStudioMemberSuccess
    | RemoveStudioMemberFailure;

export interface RemoveStudioMemberSuccess {
    success: true;
}

export interface RemoveStudioMemberFailure {
    success: false;
    errorCode: NotLoggedInError | NotAuthorizedError | ServerError;
    errorMessage: string;
}

export interface UpdateStudioRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The studio that should be updated.
     */
    studio: {
        /**
         * The ID of the studio.
         */
        id: string;

        /**
         * The display name of the studio.
         * If omitted, then the display name will not be updated.
         */
        displayName?: string;

        /**
         * The URL of the studio's logo.
         * If omitted, then the logo will not be updated.
         */
        logoUrl?: string;

        /**
         * The player configuration for the studio.
         * If omitted, then the player configuration will not be updated.
         */
        playerConfig?: ComIdPlayerConfig;

        /**
         * The configuration for the studio's comId.
         * If omitted, then the comId configuration will not be updated.
         */
        comIdConfig?: ComIdConfig;

        /**
         * The studios loom configuration.
         * If omitted, then the loom configuration will not be updated.
         */
        loomConfig?: LoomConfig;

        /**
         * The studio's hume configuration.
         * If omitted, then the Hume configuration will not be updated.
         */
        humeConfig?: HumeConfig;
    };
}

export type UpdateStudioResult = UpdateStudioSuccess | UpdateStudioFailure;

export interface UpdateStudioSuccess {
    success: true;
}

export interface UpdateStudioFailure {
    success: false;
    errorCode:
        | 'studio_not_found'
        | NotLoggedInError
        | NotAuthorizedError
        | ServerError;
    errorMessage: string;
}

export type GetStudioResult = GetStudioSuccess | GetStudioFailure;

export interface GetStudioSuccess {
    success: true;
    studio: StudioData;
}

export interface StudioData {
    /**
     * The ID of the studio.
     */
    id: string;

    /**
     * The display name of the studio.
     */
    displayName: string;

    /**
     * The URL of the logo for the studio.
     */
    logoUrl?: string;

    /**
     * The comId of the studio.
     */
    comId?: string;

    /**
     * The comId of the studio that owns this studio.
     */
    ownerStudioComId?: string;

    /**
     * The player configuration for the studio.
     */
    playerConfig?: ComIdPlayerConfig;

    /**
     * The configuration for the studio's comId.
     */
    comIdConfig?: ComIdConfig;

    /**
     * The studio's loom configuration.
     */
    loomConfig?: Omit<LoomConfig, 'privateKey'>;

    /**
     * The studio's hume configuration.
     */
    humeConfig?: Omit<HumeConfig, 'secretKey'>;

    /**
     * The comId features that this studio has access to.
     */
    comIdFeatures: StudioComIdFeaturesConfiguration;

    /**
     * The loom features that this studio has access to.
     */
    loomFeatures: StudioLoomFeaturesConfiguration;

    /**
     * The hume features that this studio has access to.
     */
    humeFeatures: AIHumeFeaturesConfiguration;

    /**
     * The store features that this studio has access to.
     */
    storeFeatures: PurchasableItemFeaturesConfiguration;

    /**
     * The status of the studio's stripe requirements.
     */
    stripeRequirementsStatus: StripeRequirementsStatus;

    /**
     * The status of the studio's stripe account.
     */
    stripeAccountStatus: StripeAccountStatus;
}

export interface GetStudioFailure {
    success: false;
    errorCode:
        | 'studio_not_found'
        | NotLoggedInError
        | NotAuthorizedError
        | ServerError;
    errorMessage: string;
}

export type GetPlayerConfigResult =
    | GetPlayerConfigSuccess
    | GetPlayerConfigFailure;

export interface GetPlayerConfigSuccess {
    success: true;

    /**
     * The comId that the player config is for.
     */
    comId: string;

    /**
     * The display name of the comId.
     */
    displayName: string;

    /**
     * The URL that the comId logo is available at.
     */
    logoUrl: string;

    /**
     * The config that should be used for the player.
     */
    playerConfig: ComIdPlayerConfig;
}

export interface GetPlayerConfigFailure {
    success: false;
    errorCode: 'comId_not_found' | ServerError;
    errorMessage: string;
}

export interface ComIdRequest {
    /**
     * The ID of the studio that the request is for.
     */
    studioId: string;

    /**
     * The user that is currently logged in.
     */
    userId: string;

    /**
     * The comID that is being requested.
     */
    requestedComId: string;

    /**
     * The IP Address that the request is coming from.
     */
    ipAddress: string;
}

export type ComIdRequestResult = ComIdRequestSuccess | ComIdRequestFailure;

export interface ComIdRequestSuccess {
    success: true;
}

export interface ComIdRequestFailure {
    success: false;
    errorCode:
        | 'studio_not_found'
        | 'comId_already_taken'
        | 'not_authorized'
        | ServerError;
    errorMessage: string;
}
