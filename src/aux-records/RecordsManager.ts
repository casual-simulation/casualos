import { RecordsStore } from './RecordsStore';
import { toBase64String, fromBase64String } from './Utils';
import {
    createRandomPassword,
    hashPasswordWithSalt,
    verifyPasswordAgainstHashes,
} from '@casual-simulation/crypto';
import { randomBytes } from 'crypto';
import { fromByteArray } from 'base64-js';

/**
 * Defines a class that manages records and their keys.
 */
export class RecordsManager {
    private _store: RecordsStore;

    constructor(store: RecordsStore) {
        this._store = store;
    }

    /**
     * Creates a new public record key for the given bucket name.
     * @param name The name of the record.
     * @param userId The ID of the user that is creating the public record.
     * @returns
     */
    async createPublicRecordKey(
        name: string,
        userId: string
    ): Promise<CreatePublicRecordKeyResult> {
        try {
            const record = await this._store.getRecordByName(name);

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

                await this._store.updateRecord({
                    ...record,
                    secretHashes: [...record.secretHashes, passwordHash],
                });

                return {
                    success: true,
                    recordKey: formatRecordKey(name, password),
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
                    secretHashes: [passwordHash],
                    secretSalt: salt,
                });

                return {
                    success: true,
                    recordKey: formatRecordKey(name, password),
                    recordName: name,
                };
            }
        } catch (err) {
            return {
                success: false,
                errorCode: 'general_record_error',
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
        const parseResult = parseRecordKey(key);

        if (!parseResult) {
            return {
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: 'Invalid record key.',
            };
        }

        const [name, password] = parseResult;

        const record = await this._store.getRecordByName(name);

        if (!record) {
            return {
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'Record not found.',
            };
        }

        const result = verifyPasswordAgainstHashes(
            password,
            record.secretSalt,
            record.secretHashes
        );

        if (result) {
            return {
                success: true,
                recordName: name,
            };
        } else {
            return {
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: 'Invalid record key.',
            };
        }
    }
}

/**
 * Defines an interface that represents the result of a "create public record key" operation.
 */
export type CreatePublicRecordKeyResult =
    | CreatePublicRecordKeySuccess
    | CreatePublicRecordKeyFailure;

export type ValidatePublicRecordKeyResult =
    | ValidatePublicRecordKeySuccess
    | ValidatePublicRecordKeyFailure;

/**
 * Defines an interface that represents the result of a "validate public record key" operation.
 */
export interface ValidatePublicRecordKeySuccess {
    success: true;
    recordName: string;
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
    errorCode: InvalidRecordKey | GeneralRecordError | 'record_not_found';

    /**
     * The error message.
     */
    errorMessage: string;
}

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
    errorCode: UnauthorizedToCreateRecordKeyError | GeneralRecordError;

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
export type GeneralRecordError = 'general_record_error';

/**
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
 */
export type InvalidRecordKey = 'invalid_record_key';

/**
 * Formats the given record name and record secret into a record key.
 * @param recordName The name of the record.
 * @param recordSecret The secret that is used to access the record.
 */
export function formatRecordKey(
    recordName: string,
    recordSecret: string
): string {
    return `vRK1.${toBase64String(recordName)}.${toBase64String(recordSecret)}`;
}

/**
 * Parses the given record key into a name and password pair.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 * @returns
 */
export function parseRecordKey(key: string): [name: string, password: string] {
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

        return [name, password];
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
