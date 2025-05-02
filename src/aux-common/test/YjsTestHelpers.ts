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
import { fromByteArray, toByteArray } from 'base64-js';
import type { Map as YMap } from 'yjs';
import { applyUpdate, Doc } from 'yjs';

export function getUpdates(
    func: (doc: Doc, bots: YMap<YMap<any>>, masks: YMap<any>) => void,
    doc: Doc = new Doc()
): string[] {
    const bots = doc.getMap('bots') as YMap<YMap<any>>;
    const masks = doc.getMap('masks') as YMap<YMap<any>>;
    let update: Uint8Array;
    doc.on('update', (u: Uint8Array) => {
        update = u;
    });
    doc.transact(() => {
        func(doc, bots, masks);
    });

    return [fromByteArray(update)];
}

export function createDocFromUpdates(messageUpdates: any[]) {
    const doc = new Doc();
    for (let update of messageUpdates) {
        applyUpdate(doc, toByteArray(update));
    }

    return doc;
}
