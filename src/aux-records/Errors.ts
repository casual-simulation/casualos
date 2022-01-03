/**
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
 */
export type ServerError = 'server_error';

/**
 * Defines an error that occurs when the user is not logged in but they are required to be in order to perform an action.
 */
export type NotLoggedInError = 'not_logged_in';
