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
import type { VersionVector } from '../common';
import type { Doc, ID, Text } from 'yjs';
import {
    createAbsolutePositionFromRelativePosition,
    createID,
    findRootTypeKey,
    RelativePosition,
} from 'yjs';

/**
 * Return the states as a Map<client,clock>.
 * Note that clock refers to the next expected clock id.
 *
 * @param store
 */
export function getStateVector(doc: Doc) {
    const sm = {} as VersionVector;
    doc.store.clients.forEach((structs, client) => {
        const struct = structs[structs.length - 1];
        sm[client.toString()] = struct.id.clock + struct.length;
    });
    return sm;
}

/**
 * Gets the latest clock value for the given client.
 * @param doc The document.
 * @param client The client.
 */
export function getClock(doc: Doc, client: number): number {
    const structs = doc.store.clients.get(client);
    if (structs) {
        const struct = structs[structs.length - 1];
        if (struct) {
            return struct.id.clock + struct.length;
        }
    }
    return undefined;
}

/**
 * Creates a relative position from an absolute position based on the given state vector.
 * @param text The text that the position should be created from.
 * @param vector The version vector that the position should be calculated from.
 * @param index The index.
 */
export function createRelativePositionFromStateVector(
    text: Text,
    vector: VersionVector,
    index: number,
    assoc: number = 0,
    includeDeleted: boolean = false
) {
    // Mostly copied from https://github.com/yjs/yjs/blob/c67428d7150b0ea0f1cce935fcd3bf520476d021/src/utils/RelativePosition.js#L163
    // under MIT license.
    let t = text._start;
    if (assoc < 0) {
        // associated to the left character or the beginning of a type, increment index if possible.
        if (index === 0) {
            return createRelativePosition(text, null, assoc);
        }
        index--;
    }
    while (t !== null) {
        const clientVersion = vector[t.id.client.toString()];
        if (typeof clientVersion === 'number' && t.id.clock <= clientVersion) {
            if ((!t.deleted || includeDeleted) && t.countable) {
                if (t.length > index) {
                    // case 1: found position somewhere in the linked list
                    return createRelativePosition(
                        text,
                        createID(t.id.client, t.id.clock + index),
                        assoc
                    );
                }
                index -= t.length;
            }
            if (t.right === null && assoc < 0) {
                // left-associated position, return last available id
                return createRelativePosition(text, t.lastId, assoc);
            }
        }
        t = t.right;
    }
    return createRelativePosition(text, null, assoc);
}

/**
 * Creates a relative position from an absolute position based on the given state vector.
 * @param text The text that the position should be created from.
 * @param vector The version vector that the position should be calculated from.
 * @param index The index.
 */
export function createAbsolutePositionFromStateVector(
    doc: Doc,
    text: Text,
    vector: VersionVector,
    index: number,
    assoc: number = 0,
    includeDeleted: boolean = false
) {
    const relative = createRelativePositionFromStateVector(
        text,
        vector,
        index,
        assoc,
        includeDeleted
    );
    const absolute = createAbsolutePositionFromRelativePosition(relative, doc);

    return absolute;
}

/**
 * @param {AbstractType<any>} type
 * @param {ID|null} item
 * @param {number} [assoc]
 *
 * @function
 */
function createRelativePosition(type: Text, item: ID, assoc: number) {
    let typeid = null;
    let tname = null;
    if (type._item === null) {
        tname = findRootTypeKey(type);
    } else {
        typeid = createID(type._item.id.client, type._item.id.clock);
    }
    return new RelativePosition(typeid, tname, item, assoc);
}
