import { hasValue } from '@casual-simulation/aux-common';
import type { Uri } from './MonacoLibs';

export function getModelUriFromId(
    id: string,
    tag: string,
    space: string
): string {
    let tagWithExtension = tag.indexOf('.') >= 0 ? tag : `${tag}.tsx`;
    if (hasValue(space)) {
        return encodeURI(`file:///${id}/${space}/${tagWithExtension}`);
    } else {
        return encodeURI(`file:///${id}/${tagWithExtension}`);
    }
}

export function getIdFromModelUri(uri: Uri | string): {
    id: string;
    tag: string;
    space: string | null;
} {
    let uriString = typeof uri === 'string' ? uri : uri.toString();
    if (uriString.startsWith('file:///')) {
        uriString = uriString.substr(8);
    }
    let parts = uriString.split('/');

    let id = parts[0];
    let tag = parts[parts.length - 1];
    let space = parts.length > 2 ? parts[1] : null;

    return {
        id,
        tag,
        space,
    };
}
