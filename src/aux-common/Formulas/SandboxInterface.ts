export type FilterFunction = (value: any) => boolean;

/**
 * Defines an interface for objects that can allow the sandbox to communicate with the outside world.
 * In particular, this interface allows the sandbox to request tag values and tag objects.
 */
export interface SandboxInterface {
    /**
     * Calculates the list of tag values for the given tag.
     * @param tag The tag.
     * @param filter The filter to apply to the tag values.
     * @param extras Extra data.
     */
    listTagValues(tag: string, filter?: FilterFunction, extras?: any): any;

    /**
     * Calculates the list of objects that have the given tag.
     * @param tag The tag.
     * @param filter The filter to apply to the tag values.
     * @param extras Extra data.
     */
    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any): any;

    /**
     * Lists the objects on the same grid space as the given object.
     * @param obj The object.
     */
    list(obj: any, context: string): any;

    /**
     * Calculates a new UUID.
     */
    uuid(): string;
}