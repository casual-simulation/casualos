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
