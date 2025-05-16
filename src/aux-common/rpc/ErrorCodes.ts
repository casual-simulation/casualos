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
    | 'insufficient_funds'
    | 'item_already_purchased'
    | 'item_not_found'
    | 'store_disabled'
    | 'currency_not_supported';

/**
 * Gets the status code that should be used for the given response.
 * @param response The response.
 */
export function getStatusCode(
    response: { success: false; errorCode: KnownErrorCodes } | { success: true }
) {
    if (response.success === false) {
        if (response.errorCode === 'not_logged_in') {
            return 401;
        } else if (response.errorCode === 'not_supported') {
            return 501;
        } else if (response.errorCode === 'data_not_found') {
            return 404;
        } else if (response.errorCode === 'data_too_large') {
            return 400;
        } else if (response.errorCode === 'record_not_found') {
            return 404;
        } else if (response.errorCode === 'file_not_found') {
            return 404;
        } else if (response.errorCode === 'session_not_found') {
            return 404;
        } else if (response.errorCode === 'operation_not_found') {
            return 404;
        } else if (response.errorCode === 'studio_not_found') {
            return 404;
        } else if (response.errorCode === 'user_not_found') {
            return 404;
        } else if (response.errorCode === 'session_already_revoked') {
            return 200;
        } else if (response.errorCode === 'invalid_code') {
            return 403;
        } else if (response.errorCode === 'invalid_key') {
            return 403;
        } else if (response.errorCode === 'invalid_record_key') {
            return 403;
        } else if (response.errorCode === 'invalid_request') {
            return 403;
        } else if (response.errorCode === 'invalid_origin') {
            return 403;
        } else if (response.errorCode === 'session_expired') {
            return 401;
        } else if (response.errorCode === 'unacceptable_address') {
            return 400;
        } else if (response.errorCode === 'unacceptable_user_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_code') {
            return 400;
        } else if (response.errorCode === 'unacceptable_session_key') {
            return 400;
        } else if (response.errorCode === 'unacceptable_session_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_request_id') {
            return 400;
        } else if (response.errorCode === 'unacceptable_ip_address') {
            return 500;
        } else if (response.errorCode === 'unacceptable_address_type') {
            return 400;
        } else if (response.errorCode === 'unacceptable_expire_time') {
            return 400;
        } else if (response.errorCode === 'unacceptable_request') {
            return 400;
        } else if (response.errorCode === 'address_type_not_supported') {
            return 501;
        } else if (response.errorCode === 'server_error') {
            return 500;
        } else if (response.errorCode === 'unauthorized_to_create_record_key') {
            return 403;
        } else if (response.errorCode === 'price_does_not_match') {
            return 412;
        } else if (response.errorCode === 'user_is_banned') {
            return 403;
        } else if (response.errorCode === 'rate_limit_exceeded') {
            return 429;
        } else if (response.errorCode === 'not_authorized') {
            return 403;
        } else if (response.errorCode === 'not_subscribed') {
            return 403;
        } else if (response.errorCode === 'invalid_subscription_tier') {
            return 403;
        } else if (response.errorCode === 'record_already_exists') {
            return 403;
        } else if (response.errorCode === 'subscription_limit_reached') {
            return 403;
        } else if (response.errorCode === 'inst_not_found') {
            return 404;
        } else if (response.errorCode === 'action_not_supported') {
            return 500;
        } else if (response.errorCode === 'policy_not_found') {
            return 404;
        } else if (response.errorCode === 'comId_not_found') {
            return 404;
        } else if (response.errorCode === 'comId_already_taken') {
            return 409;
        } else if (response.errorCode === 'permission_not_found') {
            return 404;
        } else if (response.errorCode === 'message_not_found') {
            return 404;
        } else if (response.errorCode === 'not_found') {
            return 404;
        } else if (response.errorCode === 'item_not_found') {
            return 404;
        } else if (response.errorCode === 'invalid_connection_state') {
            return 500;
        } else if (response.errorCode === 'user_already_exists') {
            return 400;
        } else {
            return 400;
        }
    }

    return 200;
}
