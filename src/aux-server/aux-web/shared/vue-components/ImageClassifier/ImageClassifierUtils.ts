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
 * Calculates the URLs that the model JSON and metadata are at based on the given input options.
 * @param options The options.
 */
export function getImageClassifierUrls(
    options: GetImageClassifierUrlsInput
): ImageClassifierUrls {
    let json =
        options.modelJsonUrl ?? inferPath(options.modelUrl, 'model.json');
    let metadata =
        options.modelMetadataUrl ??
        inferPath(options.modelUrl, 'metadata.json');

    return {
        json,
        metadata,
    };
}

/**
 * Calculates the absolute path from the given base path and relative path.
 * @param basePath The base path that the relative path should be added to.
 * @param relativePath The relative path that should be added to the base path.
 */
export function inferPath(basePath: string, relativePath: string): string {
    let lastChar = basePath[basePath.length - 1];
    if (lastChar != '/') {
        basePath += '/';
    }
    if (relativePath[0] != '/' && !relativePath.startsWith('./')) {
        relativePath = './' + relativePath;
    }

    return new URL(relativePath, basePath).href;
}

export interface GetImageClassifierUrlsInput {
    modelUrl?: string;
    modelJsonUrl?: string;
    modelMetadataUrl?: string;
}

export interface ImageClassifierUrls {
    json: string;
    metadata: string;
}
