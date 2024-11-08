import { PartitionAuthSource } from '../partitions/PartitionAuthSource';
import { SharedDocument } from './SharedDocument';
import { RemoteSharedDocumentConfig } from './SharedDocumentConfig';

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
