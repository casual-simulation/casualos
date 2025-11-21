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
import { parseInstancesList } from './Utils';
import { z } from 'zod';

/**
 * The Zod validation for record keys.
 */
export const RECORD_KEY_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'recordKey is required.'
                : 'recordKey must be a string.',
    })
    .nonempty('recordKey must not be empty.');

/**
 * The Zod validation for addresses.
 */
export const ADDRESS_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'address is required.'
                : 'address must be a string.',
    })
    .min(1)
    .max(512);

/**
 * The Zod validation for event names.
 */
export const EVENT_NAME_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'eventName is required.'
                : 'eventName must be a string.',
    })
    .min(1)
    .max(128);

export const STUDIO_ID_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'studioId is required.'
                : 'studioId must be a string.',
    })
    .min(1)
    .max(128);

export const COM_ID_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'comId is required.'
                : 'comId must be a string.',
    })
    .min(1)
    .max(128);

export const STUDIO_DISPLAY_NAME_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'displayName is required.'
                : 'displayName must be a string.',
    })
    .min(1)
    .max(128);

export const MARKER_VALIDATION = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'invidiaul markers must not be null or empty.'
                : 'individual markers must be strings.',
    })
    .nonempty('individual markers must not be null or empty.')
    .max(100, 'individual markers must not be longer than 100 characters.');

/**
 * The Zod validation for markers.
 */
export const MARKERS_VALIDATION = z
    .tuple(
        {
            error: (issue) =>
                issue.input === undefined
                    ? 'markers is required.'
                    : 'markers must be an array of strings.',
        },
        [MARKER_VALIDATION],
        MARKER_VALIDATION
    )
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
        error: (issue) =>
            issue.input === undefined
                ? 'recordName is required.'
                : 'recordName must be a string.',
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
            error: (issue) =>
                issue.input === undefined
                    ? 'fileSha256Hex is required.'
                    : 'fileSha256Hex must be a string.',
        })
        .min(1)
        .max(128)
        .nonempty('fileSha256Hex must be non-empty.'),
    fileByteLength: z
        .int('fileByteLength must be a positive integer number.')
        .positive('fileByteLength must be a positive integer number.'),
    fileMimeType: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? 'fileMimeType is required.'
                    : 'fileMimeType must be a string.',
        })
        .min(1)
        .max(128),
    fileDescription: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? 'fileDescription is required.'
                    : 'fileDescription must be a string.',
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
            error: (issue) =>
                issue.input === undefined
                    ? 'fileUrl is required.'
                    : 'fileUrl must be a string.',
        })
        .nonempty('fileUrl must be non-empty.'),
    markers: MARKERS_VALIDATION,
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const READ_FILE_SCHEMA = z.object({
    recordName: RECORD_NAME_VALIDATION.optional(),
    fileName: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? 'fileName is required.'
                    : 'fileName must be a string.',
        })
        .nonempty('fileName must be non-empty.')
        .optional(),
    fileUrl: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? 'fileUrl is required.'
                    : 'fileUrl must be a string.',
        })
        .nonempty('fileUrl must be non-empty.')
        .optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const LIST_FILES_SCHEMA = z.object({
    recordName: RECORD_NAME_VALIDATION,
    fileName: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? 'fileName is required.'
                    : 'fileName must be a string.',
        })
        .nonempty('fileName must be non-empty.')
        .optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const ERASE_FILE_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    fileUrl: z.string({
        error: (issue) =>
            issue.input === undefined
                ? 'fileUrl is required.'
                : 'fileUrl must be a string.',
    }),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const RECORD_DATA_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    address: ADDRESS_VALIDATION,
    data: z.any(),
    updatePolicy: z
        .union([z.literal(true), z.array(z.string())], {
            error: (issue) =>
                issue.input === undefined
                    ? undefined
                    : 'updatePolicy must be a boolean or an array of strings.',
        })
        .optional(),
    deletePolicy: z
        .union([z.literal(true), z.array(z.string())], {
            error: (issue) =>
                issue.input === undefined
                    ? undefined
                    : 'deletePolicy must be a boolean or an array of strings.',
        })
        .optional(),
    markers: MARKERS_VALIDATION.optional(),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const GET_DATA_SCHEMA = z.object({
    recordName: RECORD_NAME_VALIDATION,
    address: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? 'address is required.'
                    : 'address must be a string.',
        })
        .nonempty('address must not be empty'),
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});

export const ERASE_DATA_SCHEMA = z.object({
    recordKey: RECORD_KEY_VALIDATION,
    address: ADDRESS_VALIDATION,
    instances: INSTANCES_ARRAY_VALIDATION.optional(),
});
