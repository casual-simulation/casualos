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

import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import type {
    SearchApiKey,
    SearchApiKeyData,
    SearchCollection,
    SearchCollectionInfo,
    SearchDocument,
    SearchDocumentInfo,
    SearchHighlight,
    SearchInterface,
    SearchNode,
    SearchQuery,
    SearchResult,
    UpdatedSearchCollection,
} from './SearchInterface';
import type { Client } from 'typesense';
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';
import { TypesenseError } from 'typesense/lib/Typesense/Errors';

export class TypesenseSearchInterface implements SearchInterface {
    private _client: Client;

    constructor(client: Client) {
        this._client = client;
    }

    get nodes() {
        return this._client.configuration.nodes.slice() as SearchNode[];
    }

    async createCollection(
        collection: SearchCollection
    ): Promise<SearchCollectionInfo> {
        const schema = {
            name: collection.name,
            fields: collection.fields as CollectionFieldSchema[],
            default_sorting_field: collection.defaultSortingField,
        };
        const response = await this._client.collections().create(schema);

        return {
            name: response.name,
            fields: response.fields,
            numDocuments: response.num_documents,
        };
    }

    async updateCollection(
        collection: UpdatedSearchCollection
    ): Promise<SearchCollectionInfo> {
        const schema = {
            name: collection.name,
            fields: collection.fields as CollectionFieldSchema[],
            default_sorting_field: collection.defaultSortingField,
        };
        const response = await this._client
            .collections(collection.name)
            .update(schema);

        return {
            name: response.name,
            fields: response.fields,
            numDocuments: response.num_documents,
        };
    }

    async dropCollection(
        collectionName: string
    ): Promise<SearchCollectionInfo> {
        const response = await this._client
            .collections(collectionName)
            .delete();

        return {
            name: response.name,
            fields: response.fields,
            numDocuments: response.num_documents,
        };
    }

    async getCollection(collectionName: string): Promise<SearchCollectionInfo> {
        const response = await this._client
            .collections(collectionName)
            .retrieve();

        return {
            name: response.name,
            fields: response.fields,
            numDocuments: response.num_documents,
        };
    }

    async createDocument(
        collectionName: string,
        document: SearchDocument,
        action?: 'create' | 'upsert' | 'update' | 'emplace'
    ): Promise<SearchDocumentInfo> {
        const response = await this._client
            .collections<SearchDocument>(collectionName)
            .documents()
            .create(document, { action });

        return response as SearchDocumentInfo;
    }

    async deleteDocument(
        collectionName: string,
        documentId: string
    ): Promise<Result<SearchDocumentInfo, SimpleError>> {
        const response = await this._client
            .collections<SearchDocumentInfo>(collectionName)
            .documents(documentId)
            .delete();
        return success(response);
    }

    async createApiKey(apiKey: SearchApiKeyData): Promise<SearchApiKey> {
        const response = await this._client.keys().create({
            description: apiKey.description,
            actions: apiKey.actions,
            collections: apiKey.collections,
            expires_at: apiKey.expiresAt,
        });

        return {
            id: response.id,
            value: response.value,
            description: response.description,
            actions: response.actions,
            collections: response.collections,
            expiresAt: response.expires_at,
        };
    }

    async searchCollection(
        collectionName: string,
        query: SearchQuery
    ): Promise<SearchResult> {
        return this._handleErrors(async () => {
            const result = await this._client
                .collections(collectionName)
                .documents()
                .search({
                    ...query,
                    q: query.q,
                    query_by: query.queryBy,
                    filter_by: query.filterBy,
                });

            return success({
                found: result.found,
                outOf: result.out_of,
                page: result.page,
                searchTimeMs: result.search_time_ms,
                hits: result.hits.map((hit) => ({
                    document: hit.document,
                    highlights: hit.highlights?.map(mapHighlight),
                    highlight: hit.highlight
                        ? mapHighlight(hit.highlight as any)
                        : undefined,
                    textMatch: hit.text_match,
                })),
            });
        });
    }

    private async _handleErrors<T>(
        func: () => Promise<Result<T, SimpleError>>
    ): Promise<Result<T, SimpleError>> {
        try {
            return await func();
        } catch (err) {
            if (err instanceof TypesenseError) {
                console.error(
                    '[TypesenseSearchInterface] Typesense error during search:',
                    err,
                    err.cause,
                    err.httpStatus,
                    err.httpBody,
                    err.message,
                    err.name
                );
                if (
                    err.httpStatus === 400 ||
                    err.httpStatus === 404 ||
                    err.httpStatus === 422
                ) {
                    return failure({
                        errorCode: 'invalid_request',
                        errorMessage: err.message,
                    });
                } else if (err.httpStatus === 503) {
                    return failure({
                        errorCode: 'service_unavailable',
                        errorMessage:
                            'The search service is currently unavailable. Please try again later.',
                    });
                }
            }
            throw err;
        }
    }
}

function mapHighlight(highlight: {
    field: never;
    snippet?: string;
    value?: string;
    snippets?: string[];
    indices?: number[];
    matched_tokens: string[][] | string[];
}): SearchHighlight {
    return {
        field: highlight.field,
        indices: highlight.indices as [number, number],
        snippet: highlight.snippet,
        snippets: highlight.snippets,
        matchedTokens: highlight.matched_tokens,
        value: highlight.value,
    };
}
