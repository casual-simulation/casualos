/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export function first<T>(iterator: Iterable<T>) {
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
export function last<T>(iterator: Iterable<T>) {
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
export function nth<T>(iterator: Iterable<T>, item: number) {
    let count = 0;
    for (let node of iterator) {
        if (count === item) {
            return node;
        }
        count += 1;
    }

    return null;
}
