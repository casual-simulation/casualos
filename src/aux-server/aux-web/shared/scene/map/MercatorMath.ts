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

//! This is a utility class for Mercator projection math— some methods are already present or derived from MapView.

export class MercatorMath {
    /**
     * Calculates the pixel coordinates of the given zoom, longitude and latitude.
     * Pixel coordinates are able to be used to determine where inside a tile a particular geographic point is.
     * See https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system for more information.
     */
    static calculatePixel(
        zoom: number,
        longitude: number,
        latitude: number,
        TILE_SIZE: number = 256
    ): [number, number] {
        const sinLatitude = Math.sin((latitude * Math.PI) / 180);
        const powZoom = Math.pow(2, zoom);
        const mapSize = powZoom * TILE_SIZE;
        const pixelX = ((longitude + 180) / 360) * mapSize + 0.5;
        const pixelY =
            (0.5 -
                Math.log((1 + sinLatitude) / (1 - sinLatitude)) /
                    (4 * Math.PI)) *
                mapSize +
            0.5;

        return [pixelX, pixelY];
    }
}
