import {
    ListedRecord,
    ListedStudio,
    ListedStudioAssignment,
    PublicRecordKeyPolicy,
    RecordsStore,
    StudioAssignmentRole,
} from './RecordsStore';
import { toBase64String, fromBase64String } from './Utils';
import {
    createRandomPassword,
    hashHighEntropyPasswordWithSalt,
    hashPasswordWithSalt,
    verifyPasswordAgainstHashes,
} from '@casual-simulation/crypto';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import {
    NotAuthorizedError,
    NotLoggedInError,
    NotSupportedError,
    ServerError,
    SubscriptionLimitReached,
} from './Errors';
import type { ValidateSessionKeyFailure } from './AuthController';
import { AuthStore } from './AuthStore';
import { v4 as uuid } from 'uuid';
import { MetricsStore, SubscriptionFilter } from './MetricsStore';
import { ConfigurationStore } from './ConfigurationStore';
import { getSubscriptionFeatures } from './SubscriptionConfiguration';

export interface RecordsControllerConfig {
    store: RecordsStore;
    auth: AuthStore;
    metrics: MetricsStore;
    config: ConfigurationStore;
}

/**
 * Defines a class that manages records and their keys.
 */
export class RecordsController {
    private _store: RecordsStore;
    private _auth: AuthStore;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;

    constructor(config: RecordsControllerConfig) {
        this._store = config.store;
        this._auth = config.auth;
        this._metrics = config.metrics;
        this._config = config.config;
    }

    /**
     * Creates a new record.
     * @param request The request that should be used to create the record.
     */
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
            const passwordHash = hashHighEntropyPasswordWithSalt(
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

    /**
     * Validates the given record key. Returns success if the key is valid and can be used to publish things to its bucket.
     * @param key The key that should be validated.
     * @returns
     */
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
                    const hash = hashPasswordWithSalt(
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
            console.error(
                '[RecordsController] [validateRecordName] An error occurred while creating a public record key:',
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
                metrics.ownerId ? 'user' : 'studio'
            ),
        };
    }

    /**
     * Gets the list of records that the user with the given ID has access to.
     * @param userId The ID of the user.
     */
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
            console.log(
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
            const records = await this._store.listRecordsByStudioIdAndUserId(
                studioId,
                userId
            );
            return {
                success: true,
                records: records,
            };
        } catch (err) {
            console.log(
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
     * Gets the list of studios that the user with the given ID has access to.
     * @param userId The ID of the user.
     */
    async listStudios(userId: string): Promise<ListStudiosResult> {
        try {
            const studios = await this._store.listStudiosForUser(userId);

            return {
                success: true,
                studios: studios.map((s) => ({
                    studioId: s.studioId,
                    displayName: s.displayName,
                    role: s.role,
                    isPrimaryContact: s.isPrimaryContact,
                })),
            };
        } catch (err) {
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
    async listStudioMembers(
        studioId: string,
        userId: string
    ): Promise<ListStudioMembersResult> {
        try {
            const members = await this._store.listStudioAssignments(studioId);

            const userAssignment = members.find((m) => m.userId === userId);

            if (!userAssignment) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to access this studio.',
                };
            }

            if (userAssignment.role === 'admin') {
                return {
                    success: true,
                    members: members.map((m) => ({
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
                    })),
                };
            }

            return {
                success: true,
                members: members.map((m) => ({
                    studioId: m.studioId,
                    userId: m.userId,
                    isPrimaryContact: m.isPrimaryContact,
                    role: m.role,
                    user: {
                        id: m.user.id,
                        name: m.user.name,
                    },
                })),
            };
        } catch (err) {
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

                if (!addedUser) {
                    return {
                        success: false,
                        errorCode: 'user_not_found',
                        errorMessage: 'The user was not able to be found.',
                    };
                }

                addedUserId = addedUser.id;
            } else {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'You must provide an email, phone number, or user ID to add a studio member.',
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
    errorReason:
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

/**
 * The default policy for keys that do not have a specified record key.
 */
export const DEFAULT_RECORD_KEY_POLICY: PublicRecordKeyPolicy = 'subjectfull';

/**
 * Formats the given record name and record secret into a record key.
 * @param recordName The name of the record.
 * @param recordSecret The secret that is used to access the record.
 */
export function formatV1RecordKey(
    recordName: string,
    recordSecret: string
): string {
    return `vRK1.${toBase64String(recordName)}.${toBase64String(recordSecret)}`;
}

/**
 * Formats the given record name and record secret into a record key.
 * @param recordName The name of the record.
 * @param recordSecret The secret that is used to access the record.
 * @param keyPolicy The policy that the key uses.
 */
export function formatV2RecordKey(
    recordName: string,
    recordSecret: string,
    keyPolicy: PublicRecordKeyPolicy
): string {
    return `vRK2.${toBase64String(recordName)}.${toBase64String(
        recordSecret
    )}.${keyPolicy ?? DEFAULT_RECORD_KEY_POLICY}`;
}

/**
 * Parses the given record key into a name and password pair.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 */
export function parseRecordKey(
    key: string
): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    return parseV2RecordKey(key) ?? parseV1RecordKey(key);
}

/**
 * Parses a version 2 record key into a name, password, and policy trio.
 * Returns null if the key cannot be parsed or if it is not a V2 key.
 * @param key The key to parse.
 */
export function parseV2RecordKey(
    key: string
): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vRK2.')) {
        return null;
    }

    const withoutVersion = key.slice('vRK2.'.length);
    let periodAfterName = withoutVersion.indexOf('.');
    if (periodAfterName < 0) {
        return null;
    }

    const nameBase64 = withoutVersion.slice(0, periodAfterName);
    const passwordPlusPolicy = withoutVersion.slice(periodAfterName + 1);

    if (nameBase64.length <= 0 || passwordPlusPolicy.length <= 0) {
        return null;
    }

    const periodAfterPassword = passwordPlusPolicy.indexOf('.');
    if (periodAfterPassword < 0) {
        return null;
    }

    const passwordBase64 = passwordPlusPolicy.slice(0, periodAfterPassword);
    const policy = passwordPlusPolicy.slice(periodAfterPassword + 1);

    if (passwordBase64.length <= 0 || policy.length <= 0) {
        return null;
    }

    if (policy !== 'subjectfull' && policy !== 'subjectless') {
        return null;
    }

    try {
        const name = fromBase64String(nameBase64);
        const password = fromBase64String(passwordBase64);

        return [name, password, policy];
    } catch (err) {
        return null;
    }
}

/**
 * Parses a version 1 record key into a name and password pair.
 * Returns null if the key cannot be parsed or if it is not a V1 key.
 * @param key The key to parse.
 */
export function parseV1RecordKey(
    key: string
): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vRK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vRK1.'.length);
    let nextPeriod = withoutVersion.indexOf('.');
    if (nextPeriod < 0) {
        return null;
    }

    const nameBase64 = withoutVersion.slice(0, nextPeriod);
    const passwordBase64 = withoutVersion.slice(nextPeriod + 1);

    if (nameBase64.length <= 0 || passwordBase64.length <= 0) {
        return null;
    }

    try {
        const name = fromBase64String(nameBase64);
        const password = fromBase64String(passwordBase64);

        return [name, password, DEFAULT_RECORD_KEY_POLICY];
    } catch (err) {
        return null;
    }
}

/**
 * Determines if the given value is a record key.
 * @param key The value to check.
 * @returns
 */
export function isRecordKey(key: unknown): key is string {
    return typeof key === 'string' && parseRecordKey(key) !== null;
}
