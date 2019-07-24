/**
 * Defines a role that identifies the device as a user with basic access to a channel.
 */
export const USER_ROLE = 'user';

/**
 * Defines a role that identifies the device as an admin.
 */
export const ADMIN_ROLE = 'admin';

/**
 * Defines a role that identifies the device as a guest.
 */
export const GUEST_ROLE = 'guest';

/**
 * Defines a claim that gets the username that the device is representing.
 */
export const USERNAME_CLAIM = 'username';

/**
 * An interface for an object that contains a set of roles that a user has.
 */
export interface DeviceInfo {
    /**
     * The list of roles.
     */
    roles: string[];

    /**
     * The claims that the device contains.
     * That is, information about the device which has been verified.
     */
    claims: {
        [USERNAME_CLAIM]: string;
        [key: string]: string;
    };
}
