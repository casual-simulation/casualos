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
import type { PartitionAuthSource } from '../partitions/PartitionAuthSource';
import type { SharedDocument } from './SharedDocument';
import type { RemoteSharedDocumentConfig } from './SharedDocumentConfig';

export interface SharedDocumentServices {
    /**
     * The auth source that should be used for the partition, if needed.
     */
    authSource: PartitionAuthSource;
}

export type SharedDocumentFactory = (
    config: RemoteSharedDocumentConfig,
    services: SharedDocumentServices
) => Promise<SharedDocument> | SharedDocument;

/**
 * Creates a shared document from the given list of factory functions.
 * The first factory function that returns a doc is the document
 * that gets returned.
 * @param config The config which indicates the type of document to create.
 * @param services The services which should be used by the document.
 * @param factories The factory functions.
 */
export async function createSharedDocument(
    config: RemoteSharedDocumentConfig,
    services: SharedDocumentServices,
    ...factories: SharedDocumentFactory[]
): Promise<SharedDocument> {
    for (let factory of factories) {
        let result = await factory(config, services);
        if (result) {
            return result;
        }
    }

    return undefined;
}
