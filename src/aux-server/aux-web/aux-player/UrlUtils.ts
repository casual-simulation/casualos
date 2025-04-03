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
import { hasValue } from '@casual-simulation/aux-common';

export interface InstParameters {
    /**
     * The name of the inst that should be loaded.
     */
    inst: string;

    /**
     * The name of the record that the inst should be loaded from.
     * If null, then the inst should be loaded from the public partition.
     */
    recordName: string | null;

    /**
     * The owner that was specified.
     */
    owner: string | null;

    /**
     * Whether the inst should be static.
     */
    isStatic: boolean;

    /**
     * Whether the story query parameter was used for the inst.
     */
    story?: boolean;

    /**
     * Whether the server query parameter was used for the inst.
     */
    server?: boolean;
}

/**
 * Gets the inst parameters from the given query.
 */
export function getInstParameters(query: any): InstParameters {
    const inst: string =
        query.staticInst ?? query.inst ?? query.story ?? query.server ?? null;
    const recordName = query.owner ?? query.record ?? query.player ?? null;
    const owner = query.owner ?? null;

    if (!hasValue(inst)) {
        return null;
    }

    const ret: InstParameters = {
        inst: inst,
        recordName: recordName,
        owner,
        isStatic: inst === query.staticInst,
    };

    if (inst === query.story) {
        ret.story = true;
    }
    if (inst === query.server) {
        ret.server = true;
    }

    return ret;
}

/**
 * Gets a sharable link for the given URL and record name.
 * @param url The URL that the link should be generated for.
 * @param recordName The name of the record that the inst was loaded from.
 */
export function getPermalink(url: string, recordName: string): string {
    const link = new URL(url);
    if (recordName) {
        link.searchParams.set('owner', recordName);
        link.searchParams.delete('record');
        link.searchParams.delete('player');
    } else if (link.searchParams.get('owner') !== 'public') {
        link.searchParams.delete('owner');
    }
    return link.href;
}
