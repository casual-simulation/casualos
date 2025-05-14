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
import { getStatusCode } from './ErrorCodes';

describe('getStatusCode()', () => {
    it('should return 200 when given a success result', () => {
        expect(getStatusCode({ success: true })).toBe(200);
    });

    const cases = [
        ['not_logged_in', 401] as const,
        ['unauthorized_to_create_record_key', 403] as const,
        ['invalid_policy', 400] as const,
        ['not_supported', 501] as const,
        ['data_not_found', 404] as const,
        ['data_too_large', 400] as const,
        ['record_not_found', 404] as const,
        ['file_not_found', 404] as const,
        ['session_not_found', 404] as const,
        ['session_already_revoked', 200] as const,
        ['invalid_code', 403] as const,
        ['invalid_key', 403] as const,
        ['invalid_record_key', 403] as const,
        ['invalid_request', 403] as const,
        ['session_expired', 401] as const,
        ['unacceptable_address', 400] as const,
        ['unacceptable_user_id', 400] as const,
        ['unacceptable_code', 400] as const,
        ['unacceptable_session_key', 400] as const,
        ['unacceptable_session_id', 400] as const,
        ['unacceptable_request_id', 400] as const,
        ['unacceptable_ip_address', 500] as const,
        ['unacceptable_address_type', 400] as const,
        ['unacceptable_expire_time', 400] as const,
        ['unacceptable_request', 400] as const,
        ['address_type_not_supported', 501] as const,
        ['server_error', 500] as const,
        ['invalid_origin', 403] as const,
        ['operation_not_found', 404] as const,
        ['other', 400] as const,
        ['price_does_not_match', 412] as const,
        ['user_is_banned', 403] as const,
        ['rate_limit_exceeded', 429] as const,
        ['not_authorized', 403] as const,
        ['not_subscribed', 403] as const,
        ['invalid_subscription_tier', 403] as const,
        ['studio_not_found', 404] as const,
        ['user_not_found', 404] as const,
        ['record_already_exists', 403] as const,
        ['subscription_limit_reached', 403] as const,
        ['unacceptable_update', 400] as const,
        ['inst_not_found', 404] as const,
        ['no_session_key', 400] as const,
        ['action_not_supported', 500] as const,
        ['unacceptable_studio_id', 400] as const,
        ['email_already_exists', 400] as const,
        ['parent_email_already_exists', 400] as const,
        ['parent_email_required', 400] as const,
        ['invalid_room_name', 400] as const,
        ['invalid_username', 400] as const,
        ['invalid_update_policy', 400] as const,
        ['invalid_delete_policy', 400] as const,
        ['unacceptable_url', 400] as const,
        ['file_already_exists', 400] as const,
        ['invalid_file_data', 400] as const,
        ['invalid_model', 400] as const,
        ['roles_too_large', 400] as const,
        ['policy_not_found', 404] as const,
        ['policy_too_large', 400] as const,
        ['invalid_policy', 400] as const,
        ['not_completed', 400] as const,
        ['invalid_display_name', 400] as const,
        ['permission_already_exists', 400] as const,
        ['comId_not_found', 404] as const,
        ['comId_already_taken', 409] as const,
        ['permission_not_found', 404] as const,
        ['unacceptable_connection_token', 400] as const,
        ['invalid_token', 400] as const,
        ['unacceptable_connection_id', 400] as const,
        ['message_not_found', 404] as const,
        ['not_found', 404] as const,
        ['invalid_connection_state', 500] as const,
        ['user_already_exists', 400] as const,
        ['session_is_not_revokable', 400] as const,
        ['hume_api_error', 500] as const,
        ['invalid_webhook_target', 501] as const,
        ['took_too_long', 504] as const,
        ['parent_not_found', 400] as const,
        ['item_already_purchased', 400] as const,
        ['item_not_found', 404] as const,
        ['store_disabled', 400] as const,
        ['currency_not_supported', 400] as const,
    ];

    it.each(cases)('should map error code %s to %s', (code, expectedStatus) => {
        expect(
            getStatusCode({
                success: false,
                errorCode: code as any,
            })
        ).toBe(expectedStatus);
    });
});
