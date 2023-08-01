/**
 * Defines an interface that represents a generic error.
 *
 * @dochash types/error
 * @docname GenericError
 */
export interface GenericError {
    /**
     * The error code.
     */
    errorCode: string;

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines a class that represents a generic CasualOS error.
 *
 * @dochash types/error
 * @doctitle Error Types
 * @docsidebar Error
 * @docdescription Types that contain information about errors that can occur in CasualOS.
 * @docname CasualOSError
 */
export class CasualOSError extends Error {
    /**
     * The error code that occurred.
     */
    errorCode: string;

    /**
     * The error message that occurred.
     */
    errorMessage: string;

    constructor(error: GenericError | string) {
        super(
            typeof error === 'string'
                ? error
                : `${error.errorCode}: ${error.errorMessage}`
        );
        if (typeof error === 'string') {
            this.errorCode = 'error';
            this.errorMessage = error;
        } else {
            this.errorCode = error.errorCode;
            this.errorMessage = error.errorMessage;
        }
    }
}
