import { PrivoClientCredentials } from './PrivoStore';

/**
 * Defines an interface for objects that can interface with the Privo API.
 */
export interface PrivoClientInterface {
    // /**
    //  * Gets the client credentials that should be used to authenticate with the Privo API.
    //  */
    // getClientCredentials(): Promise<PrivoClientCredentials | null>;

    /**
     * Attempts to create a new child account.
     * @param request The request for the child account.
     */
    createChildAccount(
        request: CreateChildAccountRequest
    ): Promise<CreateChildAccountResponse>;

    /**
     * Attempts to create a new adult account.
     * @param request The request for the adult account.
     */
    createAdultAccount(
        request: CreateAdultAccountRequest
    ): Promise<CreateAdultAccountResponse>;
}

export interface CreateChildAccountRequest {
    /**
     * The email address of the parent.
     */
    parentEmail: string;

    /**
     * The name of the child's first name.
     */
    childFirstName: string;

    /**
     * The date of birth of the child.
     */
    childDateOfBirth: Date;

    /**
     * The username that the child will use to log in.
     */
    childEmail: string;

    /**
     * The list of feature IDs that are being requested.
     */
    featureIds: string[];
}

export interface CreateChildAccountResponse {
    /**
     * The parent service ID.
     */
    parentServiceId: string;

    /**
     * The child service ID.
     */
    childServiceId: string;

    /**
     * The URL that can be used to set the initial password of the child account.
     */
    updatePasswordLink: string;

    /**
     * The list of features and statuses for the child account.
     */
    features: PrivoFeatureStatus[];
}

export interface PrivoFeatureStatus {
    /**
     * The ID of the feature.
     */
    featureId: string;

    /**
     * Whether the feature is enabled or not.
     */
    on: boolean;
}

export interface CreateAdultAccountRequest {
    /**
     * The email address of the adult.
     */
    adultEmail: string;

    /**
     * The name of the adult.
     */
    adultFirstName: string;

    /**
     * The birth date of the adult.
     */
    adultDateOfBirth: Date;

    /**
     * The list of feature IDs that the adult should have access to.
     */
    featureIds: string[];
}

export interface CreateAdultAccountResponse {
    /**
     * The adult's service ID.
     */
    adultServiceId: string;

    /**
     * The URL that can be used to set the initial password of the child account.
     */
    updatePasswordLink: string;

    /**
     * The list of features and statuses for the child account.
     */
    features: PrivoFeatureStatus[];
}
