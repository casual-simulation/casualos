import type { Value } from '@casual-simulation/engine262';

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

/**
 * Determines if the given function is a constructor function.
 * Returns true if the function can be called as a constructor. Returns false otherwise.
 */
export function isConstructor(f: any) {
    try {
        Reflect.construct(String, [], f);
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * Defines a symbol for a property that contains the original object that
 * a value was transformed from.
 */
export let INTERPRETER_OBJECT = Symbol('INTERPRETER_OBJECT');

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

export function markWithInterpretedObject<T>(value: T, obj: Value): T {
    Object.defineProperty(value, INTERPRETER_OBJECT, {
        value: obj,
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return value as T;
}

/**
 * Defines a symbol for a property that contains the original object that
 * a value was transformed from.
 */
export let REGULAR_OBJECT = Symbol('REGULAR_OBJECT');

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

export function markWithRegularObject<T>(value: T, obj: any): T {
    Object.defineProperty(value, REGULAR_OBJECT, {
        value: obj,
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return value as T;
}

export let IS_PROXY_OBJECT = Symbol('IS_PROXY_OBJECT');

export function markAsProxyObject<T>(value: T): T {
    Object.defineProperty(value, IS_PROXY_OBJECT, {
        value: true,
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return value;
}

/**
 * Defines a symbol that can be used to mark objects and uncopiable.
 */
export let UNCOPIABLE = Symbol('UNCOPIABLE');

/**
 * Marks the given value as uncopiable.
 * @param value The value that should be marked.
 */
export function markAsUncopiableObject<T>(value: T): T {
    Object.defineProperty(value, UNCOPIABLE, {
        value: true,
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return value;
}

export function overwriteSymbols(
    interpreterObject: symbol,
    regularObject: symbol,
    isProxyObject: symbol,
    uncopiable: symbol
) {
    INTERPRETER_OBJECT = interpreterObject;
    REGULAR_OBJECT = regularObject;
    IS_PROXY_OBJECT = isProxyObject;
    UNCOPIABLE = uncopiable;
}
