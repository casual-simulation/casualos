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
export const DEFAULT_SPACE_REALTIME_EDIT_MODE_MAP: SpaceRealtimeEditModeMap = new Map(
    [
        ['shared', RealtimeEditMode.Immediate],
        ['local', RealtimeEditMode.Immediate],
        ['tempLocal', RealtimeEditMode.Immediate],
        ['history', RealtimeEditMode.Delayed],
        ['error', RealtimeEditMode.Delayed],
        ['admin', RealtimeEditMode.Delayed],
        ['certified', RealtimeEditMode.None],
        ['bootstrap', RealtimeEditMode.None],
    ]
);

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
    implements AuxRealtimeEditModeProvider {
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
