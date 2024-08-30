/**
 * @module xp-api/util/generic/Generic
 * @description Generic utility functions that can be used across the project (not specific to any module)
 */

// import { DescriptorMapToType } from './TypeUtils';

/**
 * Throws an error if the response object does not contain success property set to true
 * @param definition A string that describes the response object
 * @param response The response object to check
 */
export const throwIfNotSuccess = (definition: string, response: unknown) => {
    if (
        typeof response !== 'object' ||
        response === null ||
        !(response as Record<string, unknown>)?.success
    ) {
        throw new Error(
            `${definition}.\nResponse Reference [expected object with success property true]?: ${response}`
        );
    }
};

/**
 * Throws an error if the value is undefined, otherwise returns the value
 * @param definition A string that describes the value
 * @param value The value to check
 */
export const asDefined = <T = unknown>(
    definition: string,
    value: T
): T extends undefined ? never : T => {
    if (value === undefined) {
        throw new Error(
            `${definition}.\nValue Reference [expected defined]?: ${value}`
        );
    }
    return value as T extends undefined ? never : T;
};

// /**
//  * Creates a class-like object with the given prototype and object definition
//  * Provides an abstraction which adds a layer of type safety to Object.create
//  * @param proto The prototype object
//  * @param objectDef The object definition
//  */
// export const classLike = <P extends Object, O extends PropertyDescriptorMap>(
//     proto: P,
//     objectDef: O
// ) => {
//     return Object.create(proto, objectDef) as P & DescriptorMapToType<O>;
// };
