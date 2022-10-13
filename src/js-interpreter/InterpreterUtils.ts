import { Value } from '@casual-simulation/engine262';

/**
 * Unwinds the given generator and returns the resulting value from it.
 * @param generator The generator that should be unwound.
 */
export function unwind<T>(generator: Generator<any, T, any>): T {
    if (!isGenerator(generator)) {
        return generator;
    }
    while (true) {
        let { done, value } = generator.next();
        if (done) {
            return value;
        }
    }
}

/**
 * Unwinds the given generator and returns the resulting value from it.
 * @param generator The generator that should be unwound.
 */
export function unwindAndCapture<T, TReturn>(
    generator: Generator<T, TReturn, any>
): {
    result: TReturn;
    states: T[];
} {
    if (!isGenerator(generator)) {
        return generator;
    }

    let states = [] as T[];
    while (true) {
        let { done, value } = generator.next();
        if (done) {
            return {
                result: value as TReturn,
                states,
            };
        } else {
            states.push(value as T);
        }
    }
}

/**
 * Determines if the given value represents a generator object.
 * @param value The value.
 */
export function isGenerator(value: unknown): value is Generator<any, any, any> {
    return (
        typeof value === 'object' &&
        !!value &&
        'next' in value &&
        'throw' in value &&
        'return' in value &&
        Symbol.iterator in value &&
        typeof (value as any).next === 'function' &&
        typeof (value as any).throw === 'function' &&
        typeof (value as any).return === 'function' &&
        typeof (value as any)[Symbol.iterator] === 'function'
    );
}

export interface ConvertedFromInterpreterObject {
    [INTERPRETER_OBJECT]: Value;
}

export interface ConvertedFromRegularObject {
    [REGULAR_OBJECT]: any;
}

/**
 * Defines a symbol for a property that contains the original object that
 * a value was transformed from.
 */
export const INTERPRETER_OBJECT = Symbol('INTERPRETER_OBJECT');

/**
 * Gets the original object that the given object was constructed from.
 * Returns null if there is no original object.
 * @param obj The object.
 */
export function getInterpreterObject(obj: any): Value {
    if (
        (typeof obj === 'object' || typeof obj === 'function') &&
        !!obj &&
        INTERPRETER_OBJECT in obj
    ) {
        return obj[INTERPRETER_OBJECT];
    }
    return null;
}

export function markWithInterpretedObject<T>(
    value: T,
    obj: Value
): T & ConvertedFromInterpreterObject {
    Object.defineProperty(value, INTERPRETER_OBJECT, {
        value: obj,
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return value as T & ConvertedFromInterpreterObject;
}

/**
 * Defines a symbol for a property that contains the original object that
 * a value was transformed from.
 */
export const REGULAR_OBJECT = Symbol('REGULAR_OBJECT');

/**
 * Gets the original object that the given object was constructed from.
 * Returns null if there is no original object.
 * @param obj The object.
 */
export function getRegularObject(obj: any): any {
    if (
        (typeof obj === 'object' || typeof obj === 'function') &&
        !!obj &&
        REGULAR_OBJECT in obj
    ) {
        return obj[REGULAR_OBJECT];
    }
    return null;
}

export function markWithRegularObject<T>(
    value: T,
    obj: any
): T & ConvertedFromRegularObject {
    Object.defineProperty(value, REGULAR_OBJECT, {
        value: obj,
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return value as T & ConvertedFromRegularObject;
}
