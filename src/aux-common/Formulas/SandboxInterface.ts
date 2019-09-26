import { Bot } from '../Files/File';
import { UpdateBotAction } from '../Files/FileEvents';

export type FilterFunction = ((value: any) => boolean) | any;
export interface FileFilterFunction {
    (file: Bot): boolean;
    sort?: (file: Bot) => any;
}

/**
 * Defines an interface for objects that can allow the sandbox to communicate with the outside world.
 * In particular, this interface allows the sandbox to request tag values and tag objects.
 */
export interface SandboxInterface {
    /**
     * The list of objects contained by the interface.
     */
    objects: Bot[];

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
     * Calculates the list of objects that match the given filters.
     * @param filters The filters.
     */
    listObjects(...filters: FileFilterFunction[]): Bot[];

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
    addFile(file: Bot): Bot;

    /**
     * Removes the given file ID from the interface.
     * @param id The ID of the file to remove.
     */
    removeFile(id: string): void;

    /**
     * Gets the ID of the current user.
     */
    userId(): string;

    /**
     * Gets the given tag for the given file.
     * @param file
     * @param tag
     */
    getTag(file: Bot, tag: string): any;

    /**
     * Sets the given tag on the given file.
     * @param file
     * @param tag
     * @param value
     */
    setTag(file: Bot, tag: string, value: any): any;

    /**
     * Gets the list of file updates that happened.
     */
    getFileUpdates(): UpdateBotAction[];
}
