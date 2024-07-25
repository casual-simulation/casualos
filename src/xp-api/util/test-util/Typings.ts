/**
 * Note: This file provides generics.
 * To prevent circular dependencies, the types are to take parameters.
 */

/**
 * Configuration interface for the XpController tests
 */
export type TestConfig = {
    /**
     * The email of the mock "user" to be used in testing
     * * This will not send an actual email to the "user"
     * * This should obviously not be a real email
     */
    userEmail: string;
};
/**
 * Cache interface for the XpController tests
 * @template UserType The type of the user object.
 * @description generics / template types are used to prevent against circular dependencies.
 */
export type TestCache<UserType> = {
    user: UserType;
};
