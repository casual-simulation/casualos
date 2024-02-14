/**
 * Defines an interface that defines user info that is able to be made public.
 */
export interface PublicUserInfo {
    /**
     * The ID of the user.
     */
    userId: string;

    /**
     * The name of the user.
     */
    name: string;

    /**
     * The display name of the user.
     * Null if the user has not set a display name.
     */
    displayName: string | null;

    /**
     * The email of the user.
     * May be omitted.
     */
    email?: string;
}
