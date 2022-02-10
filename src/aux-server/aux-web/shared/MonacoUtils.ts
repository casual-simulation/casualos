import { hasValue } from '@casual-simulation/aux-common';

export function getModelUriFromId(
    id: string,
    tag: string,
    space: string
): string {
    let tagWithExtension = tag.indexOf('.') >= 0 ? tag : `${tag}.js`;
    if (hasValue(space)) {
        return encodeURI(`file:///${id}/${space}/${tagWithExtension}`);
    } else {
        return encodeURI(`file:///${id}/${tagWithExtension}`);
    }
}
