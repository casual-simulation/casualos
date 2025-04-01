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
import { RealtimeEditMode } from './RuntimeBot';

/**
 * The default realtime edit mode.
 */
export const DEFAULT_REALTIME_EDIT_MODE: RealtimeEditMode =
    RealtimeEditMode.Immediate;

/**
 * A map between space types and the realtime edit modes they should use.
 */
export type SpaceRealtimeEditModeMap = Map<string, RealtimeEditMode>;

/**
 * The default map between bot spaces and realtime edit modes.
 */
export const DEFAULT_SPACE_REALTIME_EDIT_MODE_MAP: SpaceRealtimeEditModeMap =
    new Map([
        ['shared', RealtimeEditMode.Immediate],
        ['local', RealtimeEditMode.Immediate],
        ['tempLocal', RealtimeEditMode.Immediate],
        ['history', RealtimeEditMode.Delayed],
        ['admin', RealtimeEditMode.Delayed],
        ['certified', RealtimeEditMode.None],
        ['bootstrap', RealtimeEditMode.None],
    ]);

/**
 * Gets the realtime edit mode for the given space and map.
 * @param map The map.
 * @param space The space.
 */
export function getRealtimeEditMode(
    map: SpaceRealtimeEditModeMap,
    space: string
): RealtimeEditMode {
    return map.get(space) || DEFAULT_REALTIME_EDIT_MODE;
}

/**
 * Defines an interface for an object that is able to provide realtime edit modes for a particular partition key.
 */
export interface AuxRealtimeEditModeProvider {
    /**
     * Gets the edit mode for the given space.
     * @param space The space.
     */
    getEditMode(space: string): RealtimeEditMode;
}

export class DefaultRealtimeEditModeProvider
    implements AuxRealtimeEditModeProvider
{
    private _map: SpaceRealtimeEditModeMap;

    constructor(
        map: SpaceRealtimeEditModeMap = DEFAULT_SPACE_REALTIME_EDIT_MODE_MAP
    ) {
        this._map = map;
    }

    getEditMode(space: string): RealtimeEditMode {
        return getRealtimeEditMode(this._map, space);
    }
}
