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
