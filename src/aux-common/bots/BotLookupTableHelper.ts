import type { BotLookupTable } from './BotLookupTable';
import { valuesToKey, buildLookupTable } from './BotLookupTable';
import type { Bot } from './Bot';
import type { BotObjectsContext } from './BotObjectsContext';
import { zip, sortBy } from 'lodash';

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
