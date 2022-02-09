import { hasValue } from '@casual-simulation/aux-common';

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
