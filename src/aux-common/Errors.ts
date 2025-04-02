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

export type ServerError = 'server_error';

/**
 * Defines an error that occurs when the user is not logged in but they are required to be in order to perform an action.
 */
export type NotLoggedInError = 'not_logged_in';

/**
 * Defines an error that occurs when the user does not have the right permissions to perform an action.
 */
export type NotAuthorizedError = 'not_authorized';

/**
 * Defines an error that occurrs when the user tries to perform an action that is not supported by the current deployment.
 */
export type NotSupportedError = 'not_supported';

/**
 * Defines an error that occurrs when the user tries to perform an action that requires them to be subscribed.
 */
export type NotSubscribedError = 'not_subscribed';

/**
 * Defines an error that occurrs when the user tries to perform an action that requires a subscription tier that .
 */
export type InvalidSubscriptionTierError = 'invalid_subscription_tier';

/**
 * Defines an error that occurs when the user tries to perform an action that would exceed their subscription limit.
 */
export type SubscriptionLimitReached = 'subscription_limit_reached';
