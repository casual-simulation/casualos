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
import type { Bot } from './Bot';
import type { BotObjectsContext } from './BotObjectsContext';
import { calculateBotValue } from './BotCalculations';
import { zip, sortBy } from 'es-toolkit/compat';

/**
 * Creates a lookup table for the given tags.
 * This makes repeated queries against the same tags much quicker.
 * @param calc The calculation context.
 * @param tags The tags that the lookup table should be built from.
 * @param defaults The default values that should be used for tags that are missing.
 */
export function buildLookupTable(
    calc: BotObjectsContext,
    tags: string[],
    defaults: any[] = null
) {
    return new BotLookupTable(calc, tags, defaults);
}

/**
 * Defines a lookup table for a group of bots.
 * Lookup tables help performance by calculating lists of bots which have the same values for
 * a given set of tags. This makes subsequent queries for the same set of tags effectively a O(1) operation instead of a O(N) operation.
 *
 * Building the table is O(N) because all the bots need to be scanned to build the table.
 */
export class BotLookupTable {
    private _map: Map<string, Bot[]>;
    private _tags: string[];

    constructor(calc: BotObjectsContext, tags: string[], defaults: any[]) {
        this._map = new Map();
        this._tags = sortBy(tags);

        for (let bot of calc.objects) {
            const val = calculateTagValueKey(calc, bot, tags, defaults);
            if (val !== null) {
                this._saveBot(val, bot);
            }
        }
    }

    /**
     * Queries the lookup table.
     * @param values The values to query.
     */
    query(values: any[]): Bot[] {
        return this._map.get(valuesToKey(values)) || [];
    }

    toString() {
        return `BotLookupTable[${this._tags.join(',')}]`;
    }

    private _saveBot(key: string, bot: Bot) {
        let list = this._map.get(key);
        if (!list) {
            list = [];
            this._map.set(key, list);
        }
        list.push(bot);
    }
}

/**
 * Calculates a key from the given bot's tags that can be used for the lookup table.
 * If null is returned then the key should not be used. (i.e. the bot should not be stored in the table)
 * @param calc The bot calculation context.
 * @param bot The bot.
 * @param tags The tags.
 * @param defaults The default values to use if any of the tags are missing.
 */
function calculateTagValueKey(
    calc: BotObjectsContext,
    bot: Bot,
    tags: string[],
    defaults: any[]
): string {
    let values: any[] = [];
    if (!defaults) {
        defaults = new Array(tags.length);
    }

    for (let [tag, def] of zip(tags, defaults)) {
        let val = calculateBotValue(calc, bot, tag);
        if (typeof val === 'undefined') {
            val = def;
        }

        if (typeof val === 'undefined') {
            return null;
        }
        values.push(val);
    }

    return valuesToKey(values);
}

export function valuesToKey(values: any[]) {
    return values.join(':');
}
