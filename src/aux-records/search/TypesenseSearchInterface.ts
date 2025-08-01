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
    SearchInterface,
    UpdatedSearchCollection,
} from './SearchInterface';
import type { Client } from 'typesense';
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import { success } from '@casual-simulation/aux-common';

export class TypesenseSearchInterface implements SearchInterface {
    private _client: Client;

    constructor(client: Client) {
        this._client = client;
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
}
