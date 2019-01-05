export type FilterFunction = (value: any) => boolean;

/**
 * Defines an interface for objects that can allow the sandbox to communicate with the outside world.
 * In particular, this interface allows the sandbox to request tag values and tag objects.
 */
export interface SandboxInterface {
    listTagValues(tag: string, filter?: FilterFunction, extras?: any): any;
    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any): any;

    /**
     * Calculates a new UUID.
     */
    uuid(): string;
}