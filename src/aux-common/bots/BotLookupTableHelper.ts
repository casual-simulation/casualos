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
import type { BotLookupTable } from './BotLookupTable';
import { valuesToKey, buildLookupTable } from './BotLookupTable';
import type { Bot } from './Bot';
import type { BotObjectsContext } from './BotObjectsContext';
import { zip, sortBy } from 'es-toolkit/compat';

/**
 * Defines a helper class for BotLookupTable which is able to dynamically create and reuse
 * lookup tables for a calculation context.
 */
export class BotLookupTableHelper {
    private _tables: Map<string, BotLookupTable>;

    constructor() {
        this._tables = new Map();
    }

    /**
     * Queries the given bot calculation context for bots that match a set of tags with the given values.
     * @param calc The bot calculation context.
     * @param tags The tags to query against.
     * @param values The values to query for.
     * @param defaulst The default values to use for missing tags.
     */
    query(
        calc: BotObjectsContext,
        tags: string[],
        values: any[],
        defaults?: any[]
    ): Bot[] {
        const zipped = zip(tags, values);
        const sorted = sortBy(zipped, (z) => z[0]);

        const sortedTags = sorted.map((s) => s[0]);
        const sortedValues = sorted.map((s) => s[1]);
        let key = valuesToKey(sortedTags);
        let table = this._tables.get(key);
        if (!table) {
            table = buildLookupTable(calc, sortedTags, defaults);
            this._tables.set(key, table);
        }

        return table.query(sortedValues);
    }
}
