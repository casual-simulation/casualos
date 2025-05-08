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
import type { KnownErrorCodes } from '../rpc/ErrorCodes';
import {
    ADDRESS_FIELD,
    CODE_FIELD,
    DISPLAY_NAME_FIELD,
    EMAIL_FIELD,
    FormError,
    PARENT_EMAIL_FIELD,
    getFormErrors,
} from './FormError';

describe('getFormErrors()', () => {
    const fieldCases: [KnownErrorCodes, string | null][] = [
        ['email_already_exists', EMAIL_FIELD],
        ['child_email_already_exists', EMAIL_FIELD],
        ['parent_email_already_exists', PARENT_EMAIL_FIELD],
        ['parent_email_required', PARENT_EMAIL_FIELD],
        ['unacceptable_address', ADDRESS_FIELD],
        ['address_type_not_supported', ADDRESS_FIELD],
        ['unacceptable_address_type', ADDRESS_FIELD],
        ['invalid_code', CODE_FIELD],
        ['invalid_username', DISPLAY_NAME_FIELD],
        ['unacceptable_code', CODE_FIELD],
        ['user_is_banned', null],
        ['invalid_display_name', DISPLAY_NAME_FIELD],
    ];

    it.each(fieldCases)(
        'should return the field for the error code %s',
        (errorCode, field) => {
            const errors = getFormErrors({
                success: false,
                errorCode: errorCode,
                errorMessage: 'test',
            });
            expect(errors).toEqual([
                {
                    for: field,
                    errorCode: errorCode,
                    errorMessage: 'test',
                },
            ]);
        }
    );

    it('should return an empty array if the response is successful', () => {
        const errors = getFormErrors({
            success: true,
        });
        expect(errors).toEqual([]);
    });

    it('should return an error for responses that dont have a specific field', () => {
        const errors = getFormErrors({
            success: false,
            errorCode: 'action_not_supported',
            errorMessage: 'test',
        });
        expect(errors).toEqual([
            {
                for: null,
                errorCode: 'action_not_supported',
                errorMessage: 'test',
            },
        ]);
    });

    it('should map zod issues to form errors', () => {
        const errors = getFormErrors({
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage: 'Error message',
            issues: [
                {
                    path: ['email'],
                    message: 'Email is required',
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'array',
                },
                {
                    path: ['displayName'],
                    message: 'displayName is required',
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'array',
                },
                {
                    path: ['subObject.displayName'],
                    message: 'displayName is required',
                    code: 'invalid_type',
                    expected: 'string',
                    received: 'array',
                },
            ],
        });

        expect(errors).toEqual([
            {
                for: 'email',
                errorCode: 'invalid_type',
                errorMessage: 'Email is required',
            },
            {
                for: 'displayName',
                errorCode: 'invalid_type',
                errorMessage: 'displayName is required',
            },
            {
                for: 'subObject.displayName',
                errorCode: 'invalid_type',
                errorMessage: 'displayName is required',
            },
        ]);
    });
});
