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

/**
 * Defines a store that is able to cache link preview data for URLs.
 */
export interface LinkPreviewStore {
    /**
     * Gets the cached link preview for the given cache key.
     * Returns null if no cached preview exists for the key.
     * @param cacheKey The cache key.
     */
    getLinkPreview(cacheKey: string): Promise<StoredLinkPreview | null>;

    /**
     * Saves the given link preview to the store.
     * @param entry The entry to save.
     */
    saveLinkPreview(entry: StoredLinkPreview): Promise<void>;
}

/**
 * Defines a link preview that has been cached in a LinkPreviewStore.
 */
export interface StoredLinkPreview {
    /**
     * The cache key that the preview was stored under.
     * Derived from the normalized URL and the requested locale.
     */
    cacheKey: string;

    /**
     * The link preview data.
     */
    data: LinkPreviewData;

    /**
     * The unix time in miliseconds after which the cached preview should be considered expired.
     */
    expireTimeMs: number;
}

/**
 * Defines the metadata that was extracted for a link preview.
 */
export interface LinkPreviewData {
    /**
     * The title of the page. Sourced from the og:title meta tag, falling back to the
     * contents of the title tag.
     */
    title?: string;

    /**
     * The description of the page. Sourced from the og:description meta tag, falling back
     * to the description meta tag.
     */
    description?: string;

    /**
     * The URL of the featured image for the page. Sourced from the og:image meta tag,
     * falling back to the link[rel="icon"] tag.
     */
    imageUrl?: string;

    /**
     * The height of the featured image in pixels. Sourced from the og:image:height meta tag.
     */
    imageHeight?: number;

    /**
     * The width of the featured image in pixels. Sourced from the og:image:width meta tag.
     */
    imageWidth?: number;

    /**
     * The alt text for the featured image. Sourced from the og:image:alt meta tag.
     */
    imageAlt?: string;

    /**
     * The type of the page. Sourced from the og:type meta tag.
     */
    type?: string;

    /**
     * The canonical URL of the page. Sourced from the og:url meta tag, falling back to the
     * link[rel="canonical"] tag.
     */
    canonicalUrl?: string;

    /**
     * The name of the site that the page belongs to. Sourced from the og:site_name meta tag.
     */
    siteName?: string;

    /**
     * The locale of the page. Sourced from the og:locale meta tag.
     */
    locale?: string;

    /**
     * All of the meta tags that were found in the page, keyed by their name or property.
     */
    meta: {
        [key: string]: string;
    };
}
