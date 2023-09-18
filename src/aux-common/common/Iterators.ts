/**
 * Gets the first value from the given iterator.
 * returns undefined if the iterator contains no values.
 * @param iterator The iterator.
 */
export function first<T>(iterator: IterableIterator<T>) {
    for (let node of iterator) {
        return node;
    }
    return undefined;
}

/**
 * Gets the last value from the given iterator.
 * Returns undefined if the iterator contains no values.
 * @param iterator The iterator.
 */
export function last<T>(iterator: IterableIterator<T>) {
    let last: T = undefined;
    for (let node of iterator) {
        last = node;
    }
    return last;
}

/**
 * Gets the item at the given index in the iterator.
 * @param iterator The iterator.
 * @param item The index of the item to get.
 */
export function nth<T>(iterator: IterableIterator<T>, item: number) {
    let count = 0;
    for (let node of iterator) {
        if (count === item) {
            return node;
        }
        count += 1;
    }

    return null;
}
