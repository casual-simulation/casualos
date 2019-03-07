
/**
 * Defines an interface that represents a tag update.
 * That is, a notification which indicates that a tag was updated.
 */
export interface TagUpdatedEvent {
    /**
     * The tag that was updated.
     */
    tag: string;

    /**
     * The new tag value.
     * This value is pre-calculated so any filters have been processed
     * and any parsing has already been taken care of.
     */
    calculatedValue: any;
}