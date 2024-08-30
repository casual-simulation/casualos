/**
 * @module xp-api/util/generic/TypeUtils
 * @description Utility functions for types and type manipulation that can be used across the project
 */

/**
 * Extracts the type of a promise.
 * Infers the generic type of a promise and returns it.
 */
export type ParsePromiseGeneric<T> = T extends Promise<infer U> ? U : never;

/**
 * Extracts a value type from a property descriptor. (e.g. { value: 'value' } => 'value')
 */
export type PropertyDescriptorValue<T> = T extends { value: infer V }
    ? V
    : never;

/**
 * Converts a property descriptor map to a type.
 */
export type DescriptorMapToType<T> = {
    [K in keyof T]: PropertyDescriptorValue<T[K]> extends Object
        ? DescriptorMapToType<PropertyDescriptorValue<T[K]>>
        : PropertyDescriptorValue<T[K]>;
};

/**
 * Provides a type representing a value as a promise or direct value.
 */
export type PromiseOrValue<T> = T | Promise<T>;

/**
 * Type representing a generic class constructor (class type).
 */
export type ClassType = new (...args: any) => any;

/**
 * Type representing a generic function / arrow function.
 */
export type FunctionType = (...args: any) => any;
