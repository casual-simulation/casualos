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
export type KnownErrorCodes =
    | 'not_logged_in'
    | 'not_supported'
    | 'data_not_found'
    | 'data_too_large'
    | 'record_not_found'
    | 'file_not_found'
    | 'session_not_found'
    | 'operation_not_found'
    | 'studio_not_found'
    | 'user_not_found'
    | 'inst_not_found'
    | 'session_already_revoked'
    | 'invalid_code'
    | 'invalid_key'
    | 'invalid_request'
    | 'invalid_origin'
    | 'invalid_record_key'
    | 'session_expired'
    | 'unacceptable_address'
    | 'unacceptable_user_id'
    | 'unacceptable_code'
    | 'unacceptable_session_key'
    | 'unacceptable_session_id'
    | 'unacceptable_request_id'
    | 'unacceptable_ip_address'
    | 'unacceptable_address_type'
    | 'unacceptable_expire_time'
    | 'unacceptable_request'
    | 'unacceptable_update'
    | 'address_type_not_supported'
    | 'server_error'
    | 'unauthorized_to_create_record_key'
    | 'price_does_not_match'
    | 'user_is_banned'
    | 'rate_limit_exceeded'
    | 'not_authorized'
    | 'not_subscribed'
    | 'invalid_subscription_tier'
    | 'subscription_limit_reached'
    | 'record_already_exists'
    | 'action_not_supported'
    | 'no_session_key'
    | 'unacceptable_studio_id'
    | 'email_already_exists'
    | 'parent_email_already_exists'
    | 'child_email_already_exists'
    | 'parent_email_required'
    | 'invalid_room_name'
    | 'invalid_username'
    | 'invalid_update_policy'
    | 'invalid_delete_policy'
    | 'unacceptable_url'
    | 'file_already_exists'
    | 'invalid_file_data'
    | 'invalid_model'
    | 'roles_too_large'
    | 'policy_not_found'
    | 'policy_too_large'
    | 'invalid_policy'
    | 'not_completed'
    | 'invalid_display_name'
    | 'permission_already_exists'
    | 'comId_not_found'
    | 'comId_already_taken'
    | 'permission_not_found'
    | 'unacceptable_connection_token'
    | 'invalid_token'
    | 'unacceptable_connection_id'
    | 'message_not_found'
    | 'not_found'
    | 'invalid_connection_state'
    | 'user_already_exists'
    | 'session_is_not_revokable'
    | 'hume_api_error'
    | 'invalid_webhook_target'
    | 'took_too_long'
    | 'parent_not_found'
    | 'insufficient_funds';

/**
 * Gets the status code that should be used for the given response.
 * @param response The response.
 */
export function getStatusCode(
    response: { success: false; errorCode: KnownErrorCodes } | { success: true }
) {
    if (response.success === false) {
        /**
         * JIT compiler will optimize this to be more efficient than accessing a declared object outside of the function.
         * Also allows typescript to check for "exhaustiveness" without unnecessary variables.
         */
        return (
            {
                session_already_revoked: 200,
                data_too_large: 400,
                unacceptable_address: 400,
                unacceptable_user_id: 400,
                unacceptable_code: 400,
                unacceptable_session_key: 400,
                unacceptable_session_id: 400,
                unacceptable_request_id: 400,
                unacceptable_address_type: 400,
                unacceptable_expire_time: 400,
                unacceptable_request: 400,
                unacceptable_connection_token: 400,
                unacceptable_connection_id: 400,
                user_already_exists: 400,
                unacceptable_update: 400,
                no_session_key: 400,
                unacceptable_studio_id: 400,
                email_already_exists: 400,
                parent_email_already_exists: 400,
                child_email_already_exists: 400,
                comId_already_taken: 400,
                parent_email_required: 400,
                permission_already_exists: 400,
                invalid_display_name: 400,
                invalid_policy: 400,
                invalid_token: 400,
                invalid_room_name: 400,
                invalid_username: 400,
                invalid_update_policy: 400,
                invalid_delete_policy: 400,
                invalid_file_data: 400,
                invalid_model: 400,
                unacceptable_url: 400,
                file_already_exists: 400,
                not_completed: 400,
                session_is_not_revokable: 400,
                roles_too_large: 400,
                policy_too_large: 400,
                not_logged_in: 401,
                session_expired: 401,
                invalid_code: 403,
                invalid_key: 403,
                invalid_record_key: 403,
                invalid_request: 403,
                invalid_origin: 403,
                unauthorized_to_create_record_key: 403,
                user_is_banned: 403,
                not_authorized: 403,
                not_subscribed: 403,
                invalid_subscription_tier: 403,
                record_already_exists: 403,
                subscription_limit_reached: 403,
                data_not_found: 404,
                record_not_found: 404,
                file_not_found: 404,
                session_not_found: 404,
                operation_not_found: 404,
                studio_not_found: 404,
                user_not_found: 404,
                inst_not_found: 404,
                policy_not_found: 404,
                comId_not_found: 404,
                permission_not_found: 404,
                message_not_found: 404,
                not_found: 404,
                insufficient_funds: 409,
                price_does_not_match: 412,
                rate_limit_exceeded: 429,
                unacceptable_ip_address: 500,
                server_error: 500,
                action_not_supported: 500,
                invalid_connection_state: 500,
                hume_api_error: 500,
                not_supported: 501,
                address_type_not_supported: 501,
                invalid_webhook_target: 501,
                took_too_long: 504,
                parent_not_found: 400,
            }[response.errorCode] ?? 400
        );
    }

    return 200;
}
