/**
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
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
