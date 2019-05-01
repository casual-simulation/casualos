/**
 * Defines an interface for any object that can be initialized.
 */
export interface Initable {
    /**
     * Initializes the object.
     */
    init(): Promise<void>;
}
