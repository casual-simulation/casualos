import Joi from '@hapi/joi';

export interface DirectoryUpdate {
    /**
     * The public human readable name of the directory entry.
     */
    publicName: string;

    /**
     * The key that can be used to uniquely identify the entry.
     */
    key: string;

    /**
     * The password that should be used to update the entry.
     * If the password doesn't match then the entry should not be allowed to update.
     */
    password: string;

    /**
     * The private IP Address that should be stored in the listing.
     */
    privateIpAddress: string;

    /**
     * The public IP Address should be stored in the listing.
     */
    publicIpAddress: string;
}

/**
 * The schema for a directory update.
 */
export const DirectoryUpdateSchema = Joi.object().keys({
    publicName: Joi.string().required(),
    key: Joi.string().required(),
    password: Joi.string().required(),
    privateIpAddress: Joi.string().required(),
    publicIpAddress: Joi.string().required(),
});
