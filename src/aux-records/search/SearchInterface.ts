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

import type { Result, SimpleError } from '@casual-simulation/aux-common';

/**
 * Defines a basic interface that is able to interact with a search engine.
 */
export interface SearchInterface {
    /**
     * Creates a new collection in the search engine.
     * @param collection The collection to create.
     */
    createCollection(
        collection: SearchCollection
    ): Promise<SearchCollectionInfo>;

    /**
     * Updates an existing collection in the search engine.
     * @param collection The updated collection.
     */
    updateCollection(
        collection: UpdatedSearchCollection
    ): Promise<SearchCollectionInfo>;

    /**
     * Drops a collection from the search engine.
     * @param collectionName The name of the collection to drop.
     */
    dropCollection(collectionName: string): Promise<SearchCollectionInfo>;

    /**
     * Retrieves a collection from the search engine.
     * @param collectionName The name of the collection to retrieve.
     */
    getCollection(collectionName: string): Promise<SearchCollectionInfo>;

    /**
     * Creates a new document in the specified collection.
     * @param collectionName The name of the collection to create the document in.
     * @param document The document to create.
     * @param action The action to perform (create, upsert, update, emplace).
     */
    createDocument(
        collectionName: string,
        document: SearchDocument,
        action?: 'create' | 'upsert' | 'update' | 'emplace'
    ): Promise<SearchDocumentInfo>;

    /**
     * Deletes a document from the specified collection.
     * @param collectionName The name of the collection to delete the document from.
     * @param documentId The ID of the document to delete.
     */
    deleteDocument(
        collectionName: string,
        documentId: string
    ): Promise<Result<SearchDocumentInfo, SimpleError>>;

    /**
     * Creates a new API key for use with the search engine.
     * @param apiKey The API key.
     */
    createApiKey(apiKey: SearchApiKeyData): Promise<SearchApiKey>;
}

export interface SearchCollection {
    name: string;
    fields: SearchCollectionField[];
    defaultSortingField?: string;
}

export interface UpdatedSearchCollection extends SearchCollection {
    fields: UpdatedSearchCollectionField[];
}

export interface SearchCollectionInfo
    extends Omit<SearchCollection, 'defaultSortingField'> {
    numDocuments: number;
}

export interface SearchCollectionField {
    name: string;
    /**
     * The type of the field.
     */
    type:
        | 'string'
        | 'string[]'
        | 'int32'
        | 'int32[]'
        | 'int64'
        | 'int64[]'
        | 'float'
        | 'float[]'
        | 'bool'
        | 'bool[]'
        | 'geopoint'
        | 'geopoint[]'
        | 'geopolygon'
        | 'object'
        | 'object[]'
        | 'string*'
        | 'image'
        | 'auto';

    /**
     * Enables faceting on the field.
     *
     * Defaults to `false`.
     */
    facet?: boolean;

    /**
     * When set to `true`, the field can have empty, null or missing values. Default: `false`.
     */
    optional?: boolean;

    /**
     * When set to `false`, the field will not be indexed in any in-memory index (e.g. search/sort/filter/facet). Default: `true`.
     */
    index?: boolean;

    /**
     * When set to `false`, the field value will not be stored on disk. Default: `true`.
     */
    store?: boolean;

    /**
     * When set to true, the field will be sortable. Default: `true` for numbers, `false` otherwise.
     */
    sort?: boolean;

    /**
     * When set to `true`, the field value can be infix-searched. Incurs significant memory overhead. Default: `false`.
     */
    infix?: boolean;

    /**
     * For configuring language specific tokenization, e.g. `jp` for Japanese. Default: `en` which also broadly supports most European languages.
     */
    locale?: string;

    /**
     * Values are stemmed before indexing in-memory. Default: `false`.
     */
    stem?: boolean;

    // /**
    //  * Not currently supported.
    //  *
    //  * Set this to a non-zero value to treat a field of type `float[]` as a vector field.
    //  */
    // num_dim?: number;

    // /**
    //  * Not currently supported.
    //  *
    //  * The distance metric to be used for vector search. Default: `cosine`. You can also use `ip` for inner product.
    //  */
    // vec_dist?: boolean;

    // /**
    //  * Not currently supported.
    //  * Reserved for when/if references are supported.
    //  * Name of a field in another collection that should be linked to this collection so that it can be joined during query.
    //  */
    // reference?: string;

    // /**
    //  * Not currently supported.
    //  *
    //  * Enables an index optimized for range filtering on numerical fields (e.g. rating:>3.5). Default: `false`.
    //  */
    // range_index?: boolean;
}

export interface UpdatedSearchCollectionField extends SearchCollectionField {
    drop?: boolean;
}

/**
 * Defines a document that can be stored in a search collection.
 *
 * @dochash types/records/search
 * @docname SearchDocument
 */
export interface SearchDocument {
    /**
     * The ID of the document.
     * If not provided, a new ID will be generated.
     */
    id?: string;

    /**
     * The properties of the document.
     */
    [key: string]: any;
}

export interface SearchDocumentInfo extends SearchDocument {
    id: string;
}

export interface SearchApiKeyData {
    actions: string[];
    collections: string[];
    description: string;

    expiresAt?: number;
}

export interface SearchApiKey extends SearchApiKeyData {
    id: number;
    value: string;
    expiresAt: number;
}
