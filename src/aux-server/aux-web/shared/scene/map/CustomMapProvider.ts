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
export class CustomMapProvider {
    private _urlTemplate: string =
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    private _isDirectUrl: boolean = false;

    constructor(urlTemplate?: string) {
        if (urlTemplate) {
            this.setUrlTemplate(urlTemplate);
        }
    }

    /**
     * Sets the URL template or direct URL for this provider
     * @param template The URL template or direct URL
     */
    setUrlTemplate(template: string) {
        this._urlTemplate = template;

        // Check if this is a direct URL or a template
        this._isDirectUrl =
            !template.includes('{z}') &&
            !template.includes('{x}') &&
            !template.includes('{y}');
    }

    /**
     * Attempts to generate a template from a direct tile URL
     * @param url Direct tile URL
     * @param zoom Detected zoom level
     * @param x Detected x coordinate
     * @param y Detected y coordinate
     * @returns A URL template with placeholders
     */
    static createTemplateFromUrl(
        url: string,
        zoom: number,
        x: number,
        y: number
    ): string {
        try {
            const urlObj = new URL(url);

            // Replace the specific coordinates with placeholders
            let template = url
                .replace(`/${zoom}/`, '/{z}/')
                .replace(`/${x}/`, '/{x}/')
                .replace(`/${y}.`, '/{y}.');

            // If the URL contains a subdomain like 'a.tile', make it variable
            if (urlObj.host.match(/^[a-z]\.tile\./)) {
                const domainParts = urlObj.host.split('.');
                domainParts.shift();

                const domain = domainParts.join('.');

                template = template.replace(
                    urlObj.protocol + '//' + urlObj.host,
                    urlObj.protocol + '//{s}.' + domain
                );
            }

            return template;
        } catch (error) {
            console.error('Failed to create template from URL:', error);
            return url; // Return original URL as fallback
        }
    }

    async fetchTile(
        zoom: number,
        x: number,
        y: number
    ): Promise<HTMLImageElement> {
        let url: string;

        if (this._isDirectUrl) {
            url = this._urlTemplate;
        } else {
            // Process the URL template replacing {z}, {x}, {y}, {s}
            url = this._urlTemplate
                .replace('{z}', zoom.toString())
                .replace('{x}', x.toString())
                .replace('{y}', y.toString())
                .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)]);
        }

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
