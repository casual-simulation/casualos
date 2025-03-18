import { parseInstancesList } from './Utils';
import { z } from 'zod';

/**
 * The Zod validation for record keys.
 */
export const RECORD_KEY_VALIDATION = z
    .string({
        invalid_type_error: 'recordKey must be a string.',
        required_error: 'recordKey is required.',
    })
    .nonempty('recordKey must not be empty.');

/**
 * The Zod validation for addresses.
 */
export const ADDRESS_VALIDATION = z
    .string({
        invalid_type_error: 'address must be a string.',
        required_error: 'address is required.',
    })
    .min(1)
    .max(512);

/**
 * The Zod validation for event names.
 */
export const EVENT_NAME_VALIDATION = z
    .string({
        invalid_type_error: 'eventName must be a string.',
        required_error: 'eventName is required.',
    })
    .min(1)
    .max(128);

export const STUDIO_ID_VALIDATION = z
    .string({
        invalid_type_error: 'studioId must be a string.',
        required_error: 'studioId is required.',
    })
    .min(1)
    .max(128);

export const COM_ID_VALIDATION = z
    .string({
        invalid_type_error: 'comId must be a string.',
        required_error: 'comId is required.',
    })
    .min(1)
    .max(128);

export const STUDIO_DISPLAY_NAME_VALIDATION = z
    .string({
        invalid_type_error: 'displayName must be a string.',
        required_error: 'displayName is required.',
    })
    .min(1)
    .max(128);

export const MARKER_VALIDATION = z
    .string({
        invalid_type_error: 'individual markers must be strings.',
        required_error: 'invidiaul markers must not be null or empty.',
    })
    .nonempty('individual markers must not be null or empty.')
    .max(100, 'individual markers must not be longer than 100 characters.');

/**
 * The Zod validation for markers.
 */
export const MARKERS_VALIDATION = z
    .array(MARKER_VALIDATION, {
        invalid_type_error: 'markers must be an array of strings.',
        required_error: 'markers is required.',
    })
    .nonempty('markers must not be empty.')
    .max(10, 'markers lists must not contain more than 10 markers.');

export const NO_WHITESPACE_MESSAGE = 'The value cannot not contain spaces.';
export const NO_WHITESPACE_REGEX = /^\S*$/g;
export const NO_SPECIAL_CHARACTERS_MESSAGE =
    'The value cannot not contain special characters.';
export const NO_SPECIAL_CHARACTERS_REGEX =
    /^[^!@#$%^&*()[\]{}\-_=+`~,./?;:'"\\<>|]*$/g;

export const DISPLAY_NAME_VALIDATION = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(NO_WHITESPACE_REGEX, NO_WHITESPACE_MESSAGE)
    .regex(NO_SPECIAL_CHARACTERS_REGEX, NO_SPECIAL_CHARACTERS_MESSAGE);

export const NAME_VALIDATION = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(NO_WHITESPACE_REGEX, NO_WHITESPACE_MESSAGE)
    .regex(NO_SPECIAL_CHARACTERS_REGEX, NO_SPECIAL_CHARACTERS_MESSAGE);

export const RECORD_NAME_VALIDATION = z
    .string({
        required_error: 'recordName is required.',
        invalid_type_error: 'recordName must be a string.',
    })
    .trim()
    .min(1)
    .max(128);

export const INSTANCE_VALIDATION = z.string().min(1).max(128);

export const INSTANCES_ARRAY_VALIDATION = z.preprocess((value) => {
    if (typeof value === 'string') {
        return parseInstancesList(value);
    }
    return value;
}, z.array(INSTANCE_VALIDATION).min(1).max(3));

export const RECORD_FILE_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    fileSha256Hex: z
        .string({
            invalid_type_error: 'fileSha256Hex must be a string.',
            required_error: 'fileSha256Hex is required.',
        })
        .min(1)
        .max(128)
        .nonempty('fileSha256Hex must be non-empty.'),
    fileByteLength: z
        .number({
            invalid_type_error:
                'fileByteLength must be a positive integer number.',
            required_error: 'fileByteLength is required.',
        })
        .positive('fileByteLength must be a positive integer number.')
        .int('fileByteLength must be a positive integer number.'),
    fileMimeType: z
        .string({
            invalid_type_error: 'fileMimeType must be a string.',
            required_error: 'fileMimeType is required.',
        })
        .min(1)
        .max(128),
    fileDescription: z
        .string({
            invalid_type_error: 'fileDescription must be a string.',
            required_error: 'fileDescription is required.',
        })
        .min(1)
        .max(128)
        .optional(),
    markers: MARKERS_VALIDATION.optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const UPDATE_FILE_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    fileUrl: z
        .string({
            invalid_type_error: 'fileUrl must be a string.',
            required_error: 'fileUrl is required.',
        })
        .nonempty('fileUrl must be non-empty.'),
    markers: MARKERS_VALIDATION,
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const READ_FILE_SCHEMA = z.object({
    recordName: RECORD_NAME_VALIDATION.optional(),
    fileName: z
        .string({
            invalid_type_error: 'fileName must be a string.',
            required_error: 'fileName is required.',
        })
        .nonempty('fileName must be non-empty.')
        .optional(),
    fileUrl: z
        .string({
            invalid_type_error: 'fileUrl must be a string.',
            required_error: 'fileUrl is required.',
        })
        .nonempty('fileUrl must be non-empty.')
        .optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const LIST_FILES_SCHEMA = z.object({
    recordName: RECORD_NAME_VALIDATION,
    fileName: z
        .string({
            invalid_type_error: 'fileName must be a string.',
            required_error: 'fileName is required.',
        })
        .nonempty('fileName must be non-empty.')
        .optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const ERASE_FILE_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    fileUrl: z.string({
        invalid_type_error: 'fileUrl must be a string.',
        required_error: 'fileUrl is required.',
    }),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const RECORD_DATA_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    address: ADDRESS_VALIDATION,
    data: z.any(),
    updatePolicy: z
        .union([z.literal(true), z.array(z.string())], {
            invalid_type_error:
                'updatePolicy must be a boolean or an array of strings.',
        })
        .optional(),
    deletePolicy: z
        .union([z.literal(true), z.array(z.string())], {
            invalid_type_error:
                'deletePolicy must be a boolean or an array of strings.',
        })
        .optional(),
    markers: MARKERS_VALIDATION.optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const GET_DATA_SCHEMA = z.object({
    recordName: RECORD_NAME_VALIDATION,
    address: z
        .string({
            required_error: 'address is required.',
            invalid_type_error: 'address must be a string.',
        })
        .nonempty('address must not be empty'),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const ERASE_DATA_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    address: ADDRESS_VALIDATION,
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});
