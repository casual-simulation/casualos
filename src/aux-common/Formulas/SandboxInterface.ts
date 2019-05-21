import { File } from '../Files/File';
import { FileProxy } from '../Files/FileProxy';

export type FilterFunction = ((value: any) => boolean) | any;

/**
 * Defines an interface for objects that can allow the sandbox to communicate with the outside world.
 * In particular, this interface allows the sandbox to request tag values and tag objects.
 */
export default interface SandboxInterface {
    /**
     * The list of objects contained by the interface.
     */
    objects: File[];

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

    /**
     * Adds the given file to the interface.
     * @param file
     */
    addFile(file: File): FileProxy;

    /**
     * Gets the ID of the current user.
     */
    userId(): string;
}
