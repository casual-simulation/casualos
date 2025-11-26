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

import { getSchemaMetadata } from '@casual-simulation/aux-common';
import {
    ADDRESS_VALIDATION,
    COM_ID_VALIDATION,
    DISPLAY_NAME_VALIDATION,
    EVENT_NAME_VALIDATION,
    INSTANCES_ARRAY_VALIDATION,
    MARKER_VALIDATION,
    MARKERS_VALIDATION,
    NAME_VALIDATION,
    RECORD_KEY_VALIDATION,
    RECORD_NAME_VALIDATION,
    STUDIO_DISPLAY_NAME_VALIDATION,
    STUDIO_ID_VALIDATION,
} from './Validations';
import type z from 'zod';

describe('Validations', () => {
    validationTests('INSTANCES_ARRAY_VALIDATION', INSTANCES_ARRAY_VALIDATION, {
        success: [
            ['parse string', 'instance1,instance2', ['instance1', 'instance2']],
            [
                'parse array of string',
                ['instance1', 'instance2'],
                ['instance1', 'instance2'],
            ],
        ],
        failure: [
            ['empty string', ''],
            ['too many instances', 'instance1,instance2,instance3,instance4'],
            ['empty array', []],
            [
                'too many instances in array',
                ['instance1', 'instance2', 'instance3', 'instance4'],
            ],
        ],
    });

    validationTests('RECORD_KEY_VALIDATION', RECORD_KEY_VALIDATION, {
        success: [['parse string', 'recordKey', 'recordKey']],
        failure: [
            ['empty string', ''],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('ADDRESS_VALIDATION', ADDRESS_VALIDATION, {
        success: [['parse string', 'address123', 'address123']],
        failure: [
            ['empty string', ''],
            ['too long string', 'a'.repeat(513)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('EVENT_NAME_VALIDATION', EVENT_NAME_VALIDATION, {
        success: [['parse string', 'address123', 'address123']],
        failure: [
            ['empty string', ''],
            ['too long string', 'a'.repeat(129)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('STUDIO_ID_VALIDATION', STUDIO_ID_VALIDATION, {
        success: [['parse string', 'studioId', 'studioId']],
        failure: [
            ['empty string', ''],
            ['too long string', 'a'.repeat(129)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('COM_ID_VALIDATION', COM_ID_VALIDATION, {
        success: [['parse string', 'comId', 'comId']],
        failure: [
            ['empty string', ''],
            ['too long string', 'a'.repeat(129)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests(
        'STUDIO_DISPLAY_NAME_VALIDATION',
        STUDIO_DISPLAY_NAME_VALIDATION,
        {
            success: [
                ['parse string', 'studioDisplayName', 'studioDisplayName'],
            ],
            failure: [
                ['empty string', ''],
                ['too long string', 'a'.repeat(129)],
                ['undefined', undefined],
                ['number', 123],
            ],
        }
    );

    validationTests('MARKER_VALIDATION', MARKER_VALIDATION, {
        success: [['parse string', 'marker', 'marker']],
        failure: [
            ['empty string', ''],
            ['too long string', 'a'.repeat(101)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('MARKERS_VALIDATION', MARKERS_VALIDATION, {
        success: [
            ['empty array', [], []],
            ['parse single', ['marker'], ['marker']],
            ['parse multiple', ['marker', 'marker2'], ['marker', 'marker2']],
        ],
        failure: [
            ['too long array', new Array(11).fill('marker')],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('DISPLAY_NAME_VALIDATION', DISPLAY_NAME_VALIDATION, {
        success: [['parse string', 'displayName', 'displayName']],
        failure: [
            ['empty string', ''],
            ['string with spaces', 'abc def'],
            ['string with tabs', 'abc\tdef'],
            ['string with newlines', 'abc\ndef'],
            ['string with special characters', 'abc!@#'],
            ['too long string', 'a'.repeat(129)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('NAME_VALIDATION', NAME_VALIDATION, {
        success: [['parse string', 'Name', 'Name']],
        failure: [
            ['empty string', ''],
            ['string with spaces', 'abc def'],
            ['string with tabs', 'abc\tdef'],
            ['string with newlines', 'abc\ndef'],
            ['string with special characters', 'abc!@#'],
            ['too long string', 'a'.repeat(129)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });

    validationTests('RECORD_NAME_VALIDATION', RECORD_NAME_VALIDATION, {
        success: [
            ['parse string', 'recordName', 'recordName'],
            ['trim string', '  recordName  ', 'recordName'],
        ],
        failure: [
            ['empty string', ''],
            ['too long string', 'a'.repeat(129)],
            ['undefined', undefined],
            ['number', 123],
        ],
    });
});

function validationTests(
    name: string,
    schema: z.ZodType,
    cases: {
        success: [string, any, any][];
        failure: [string, any][];
    }
) {
    describe(name, () => {
        it.each(cases.success)('should %s', (_, input, expected) => {
            const result = schema.safeParse(input);
            expect(result).toEqual({
                success: true,
                data: expected,
            });
        });

        it.each(cases.failure)('should fail for %s', (_, input) => {
            const result = schema.safeParse(input);
            expect(result.success).toBe(false);
            expect(result).toMatchSnapshot();
        });

        it('should produce a consistent schema', () => {
            expect(getSchemaMetadata(schema)).toMatchSnapshot();
        });
    });
}
