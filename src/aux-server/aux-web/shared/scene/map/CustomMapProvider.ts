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
    BingMapsProvider,
    OpenStreetMapsProvider,
    GoogleMapsProvider,
    MapBoxProvider,
    MapTilerProvider,
    OpenMapTilesProvider,
    HereMapsProvider,
} from 'geo-three';

/**
 * A map provider that allows custom URL templates for tiles
 */
export class CustomMapProvider extends OpenStreetMapsProvider {
    private _urlTemplate: string =
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    constructor(urlTemplate?: string) {
        super();
        if (urlTemplate) {
            this._urlTemplate = urlTemplate;
        }
    }

    updateURLTemplate(template: string) {
        this._urlTemplate = template;
    }

    async fetchTile(
        zoom: number,
        x: number,
        y: number
    ): Promise<HTMLImageElement> {
        // Process the URL template replacing {z}, {x}, {y}, {s}
        let url = this._urlTemplate
            .replace('{z}', zoom.toString())
            .replace('{x}', x.toString())
            .replace('{y}', y.toString())
            .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)]);

        // Fetch the image
        const image = new Image();

        return new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.crossOrigin = 'anonymous';
            image.src = url;
        });
    }
}

// Add to mapProviders
export const mapProviders = {
    openStreetMaps: new OpenStreetMapsProvider(),
    bingMaps: new BingMapsProvider(),
    mapbox: new MapBoxProvider('YOUR_MAPBOX_TOKEN'),
    custom: new CustomMapProvider(),
    // Add more providers as needed
};
