/**
 * The privacy-related features that a user can have access to.
 */
export interface PrivacyFeatures {
    /**
     * Whether the user is allowed to publish data.
     */
    publishData: boolean;

    /**
     * Whether the user is allowed to publish or access public data.
     */
    allowPublicData: boolean;

    /**
     * Whether the user is allowed to access AI features.
     */
    allowAI: boolean;

    /**
     * Whether the user is allowed to access public insts.
     */
    allowPublicInsts: boolean;
}
