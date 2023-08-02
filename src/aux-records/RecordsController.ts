import {
    ListedRecord,
    ListedStudio,
    PublicRecordKeyPolicy,
    RecordsStore,
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
} from './Errors';
import type { ValidateSessionKeyFailure } from './AuthController';
import { AuthStore } from './AuthStore';
import { v4 as uuid } from 'uuid';

/**
 * Defines a class that manages records and their keys.
 */
export class RecordsController {
    private _store: RecordsStore;
    private _auth: AuthStore;

    constructor(store: RecordsStore, auth: AuthStore) {
        this._store = store;
        this._auth = auth;
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

            const record = await this._store.getRecordByName(name);

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

            if (record) {
                if (record.ownerId !== userId && name !== userId) {
                    return {
                        success: false,
                        errorCode: 'unauthorized_to_create_record_key',
                        errorMessage:
                            'Another user has already created this record.',
                        errorReason: 'record_owned_by_different_user',
                    };
                }

                console.log(
                    `[RecordsController] [action: recordKey.create recordName: ${name}, userId: ${userId}] Creating record key.`
                );

                if (name === userId) {
                    // The user is not currently the owner of their own record.
                    // This is an issue that needs to be fixed because users should always own the record that has the same name as their ID.
                    console.log(
                        `[RecordsController] [action: recordKey.create recordName: ${name}, userId: ${userId}] Fixing record owner to match actual owner.`
                    );
                    record.ownerId = userId;
                    // Clear the hashes and re-create the salt so that access to the record is revoked for any record key that was created before.
                    record.secretHashes = [];
                    record.secretSalt = this._createSalt();
                    await this._store.updateRecord({
                        ...record,
                    });
                }

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
                    creatorId: record.ownerId,
                });

                return {
                    success: true,
                    recordKey: formatV2RecordKey(name, password, policy),
                    recordName: name,
                };
            } else {
                if (name !== userId) {
                    const user = await this._auth.findUser(name);

                    if (user) {
                        // User exists for record. They should own the record and all record keys for it.
                        return {
                            success: false,
                            errorCode: 'unauthorized_to_create_record_key',
                            errorMessage:
                                'Another user has already created this record.',
                            errorReason: 'record_owned_by_different_user',
                        };
                    }
                }

                console.log(
                    `[RecordsController] [action: recordKey.create recordName: ${name}, userId: ${userId}] Creating record.`
                );

                const passwordBytes = randomBytes(16);
                const password = fromByteArray(passwordBytes); // convert to human-readable string
                const salt = this._createSalt();
                const passwordHash = hashHighEntropyPasswordWithSalt(
                    password,
                    salt
                );

                await this._store.addRecord({
                    name,
                    ownerId: userId,
                    studioId: null,
                    secretHashes: [],
                    secretSalt: salt,
                });

                await this._store.addRecordKey({
                    recordName: name,
                    secretHash: passwordHash,
                    policy: policy ?? DEFAULT_RECORD_KEY_POLICY,
                    creatorId: userId,
                });

                return {
                    success: true,
                    recordKey: formatV2RecordKey(name, password, policy),
                    recordName: name,
                };
            }
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

            return {
                success: true,
                recordName: name,
                ownerId: record.ownerId,
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
     * @param userId The ID of the user.
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

    private _createSalt(): string {
        return fromByteArray(randomBytes(16));
    }
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
        | 'invalid_policy'
        | ServerError
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
        | ServerError;
}

export type ValidateRecordNameResult =
    | ValidateRecordNameSuccess
    | ValidateRecordNameFailure;

export interface ValidateRecordNameSuccess {
    success: true;
    recordName: string;
    ownerId: string;
}

export interface ValidateRecordNameFailure {
    success: false;
    errorCode: ValidatePublicRecordKeyFailure['errorCode'];
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

export type ListStudiosResult = ListStudiosSuccess | ListStudiosFailure;

export interface ListStudiosSuccess {
    success: true;
    studios: ListedStudio[];
}

export interface ListStudiosFailure {
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
