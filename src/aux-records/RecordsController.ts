import { PublicRecordKeyPolicy, RecordsStore } from './RecordsStore';
import { toBase64String, fromBase64String } from './Utils';
import {
    createRandomPassword,
    hashPasswordWithSalt,
    verifyPasswordAgainstHashes,
} from '@casual-simulation/crypto';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import { NotLoggedInError, ServerError } from './Errors';

/**
 * Defines a class that manages records and their keys.
 */
export class RecordsController {
    private _store: RecordsStore;

    constructor(store: RecordsStore) {
        this._store = store;
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
        userId: string,
    ): Promise<CreatePublicRecordKeyResult> {
        try {
            if (!userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage: 'The user must be logged in in order to create a record key.'
                };
            }

            const record = await this._store.getRecordByName(name);

            if (!!policy && policy !== 'subjectfull' && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'invalid_policy',
                    errorMessage: 'The record key policy must be either "subjectfull" or "subjectless".'
                };
            }

            if (record) {
                if (record.ownerId !== userId) {
                    return {
                        success: false,
                        errorCode: 'unauthorized_to_create_record_key',
                        errorMessage:
                            'Another user has already created this record.',
                    };
                }

                const passwordBytes = randomBytes(16);
                const password = fromByteArray(passwordBytes); // convert to human-readable string
                const salt = record.secretSalt;
                const passwordHash = hashPasswordWithSalt(password, salt);

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
                const passwordBytes = randomBytes(16);
                const password = fromByteArray(passwordBytes); // convert to human-readable string
                const salt = fromByteArray(randomBytes(16));
                const passwordHash = hashPasswordWithSalt(password, salt);

                await this._store.addRecord({
                    name,
                    ownerId: userId,
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
            console.error(err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
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

            const hash = hashPasswordWithSalt(password, record.secretSalt);

            let valid = false;
            let resultPolicy: PublicRecordKeyPolicy = DEFAULT_RECORD_KEY_POLICY;
            if (record.secretHashes.some(h => h === hash)) {
                valid = true;
            } else {
                const key = await this._store.getRecordKeyByRecordAndHash(name, hash);
                if (!!key) {
                    resultPolicy = key.policy;
                    valid = true;
                }
            }

            if (resultPolicy !== policy) {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.'
                };
            }

            if (valid) {
                return {
                    success: true,
                    recordName: name,
                    policy: policy,
                    ownerId: record.ownerId,
                };
            } else {
                return {
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.',
                };
            }
        } catch (err) {
            console.error(err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
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
 */
export type CreatePublicRecordKeyResult =
    | CreatePublicRecordKeySuccess
    | CreatePublicRecordKeyFailure;

/**
 * Defines an interface that represents a successful "create public record key" result.
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
        | 'invalid_policy'
        | ServerError
        | 'not_supported';

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
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
 */
export type InvalidRecordKey = 'invalid_record_key';

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
    recordSecret: string,
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
    return `vRK2.${toBase64String(recordName)}.${toBase64String(recordSecret)}.${keyPolicy ?? DEFAULT_RECORD_KEY_POLICY}`;
}

/**
 * Parses the given record key into a name and password pair.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 */
export function parseRecordKey(key: string): [name: string, password: string, policy: PublicRecordKeyPolicy] {
    return parseV2RecordKey(key) ?? parseV1RecordKey(key);
}

/**
 * Parses a version 2 record key into a name, password, and policy trio.
 * Returns null if the key cannot be parsed or if it is not a V2 key.
 * @param key The key to parse.
 */
export function parseV2RecordKey(key: string): [name: string, password: string, policy: PublicRecordKeyPolicy] {
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
export function parseV1RecordKey(key: string): [name: string, password: string, policy: PublicRecordKeyPolicy] {
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
