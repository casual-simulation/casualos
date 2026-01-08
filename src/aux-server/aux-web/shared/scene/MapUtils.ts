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

import type { MapProvider } from 'geo-three';
import {
    OpenStreetMapsProvider,
    BingMapsProvider,
    MapBoxProvider,
    GoogleMapsProvider,
    MapTilerProvider,
    OpenMapTilesProvider,
    HereMapsProvider,
} from 'geo-three';
import { CustomMapProvider } from './map/CustomMapProvider';

/**
 * Creates a map provider instance based on the provider name.
 * Supports aliases and case-insensitive matching.
 * @param name The name of the provider
 * @returns A map provider instance
 */
export function getMapProvider(name: string, apiKey?: string): MapProvider {
    // Check if name is a URL
    if (name && (name.startsWith('http://') || name.startsWith('https://'))) {
        return new CustomMapProvider(name);
    }
    if (!name) {
        return new BingMapsProvider();
    }

    switch (name.toLowerCase()) {
        case 'bing':
        case 'bingmaps':
            return new BingMapsProvider();
        case 'openstreetmap':
        case 'openstreetmaps':
        case 'osm':
            return new OpenStreetMapsProvider();
        case 'mapbox':
            return new MapBoxProvider(apiKey);
        case 'google':
        case 'googlemaps':
            return new GoogleMapsProvider(apiKey);
        case 'maptiler':
            return new MapTilerProvider(apiKey, 'tiles', 'satellite', 'jpg');
        case 'openmaptiles':
        case 'openmaptile':
        case 'omt':
            return new OpenMapTilesProvider(apiKey);
        case 'here':
        case 'heremap':
        case 'heremaps':
            return new HereMapsProvider();
        case 'custom':
            return new CustomMapProvider();

        default:
            console.warn(
                `Unknown provider "${name}", falling back to Bing Maps`
            );
            return new BingMapsProvider();
    }
}
