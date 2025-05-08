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
import type { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import { getBotConfigDimensions } from '@casual-simulation/aux-common';
import { sortBy } from 'lodash';

interface PlayerContextSearchResult {
    /**
     * Is there a matching player dimension?
     */
    matchFound: boolean;

    /**
     * All player dimensions found during the search.
     */
    playerDimensions: string[];
}

export function doesBotDefinePlayerDimension(
    bot: Bot,
    dimension: string,
    calc: BotCalculationContext
): PlayerContextSearchResult {
    const dimensions = getBotConfigDimensions(calc, bot);
    return {
        playerDimensions: dimensions,
        matchFound: dimensions.indexOf(dimension) >= 0,
    };
}

/**
 * Safely parses the given URL.
 * If the given URL is invalid, null will be returned. Otherwise, the parsed URL object will be returned.
 * @param url The URL to parse.
 */
export function safeParseURL(url: string): URL {
    try {
        return new URL(url);
    } catch (err) {
        return null;
    }
}

/**
 * Sorts the given insts in the order that they should be stored in the inst tag.
 * @param insts The instance or instances.
 * @param currentInst The instance that the tag is being stored in.
 */
export function sortInsts<T extends string | string[]>(
    insts: T,
    currentInst: string
): T {
    if (Array.isArray(insts)) {
        return sortBy(insts, (i) => i !== currentInst) as T;
    } else {
        return insts;
    }
}
