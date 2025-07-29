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

export class MemorySearchInterface implements SearchInterface {
    private _collections: Map<string, SearchCollectionInfo> = new Map();
    private _documents: Map<string, SearchDocumentInfo[]> = new Map();
    private _apiKeys: SearchApiKey[] = [];
    // Using a simple counter for generating unique IDs.

    private _idCounter: number = 0;

    private _generateId(): string {
        return (this._idCounter++).toString();
    }

    get collections() {
        return [...this._collections.values()];
    }

    get documents() {
        return [...this._documents.entries()];
    }

    get apiKeys() {
        return this._apiKeys;
    }

    async createCollection(
        collection: SearchCollection
    ): Promise<SearchCollectionInfo> {
        const info: SearchCollectionInfo = { ...collection, numDocuments: 0 };
        this._collections.set(collection.name, info);
        return info;
    }

    async updateCollection(
        collection: UpdatedSearchCollection
    ): Promise<SearchCollectionInfo> {
        const existing = this._collections.get(collection.name);
        if (!existing) {
            throw new Error(`Collection ${collection.name} does not exist.`);
        }

        const updatedInfo: SearchCollectionInfo = {
            ...existing,
            fields: [...existing.fields],
        };

        for (let field of collection.fields) {
            const index = updatedInfo.fields.findIndex(
                (f) => f.name === field.name
            );
            if (field.drop) {
                if (index !== -1) {
                    updatedInfo.fields.splice(index, 1);
                }
            } else {
                if (index === -1) {
                    updatedInfo.fields.push(field);
                } else {
                    updatedInfo.fields[index] = {
                        ...field,
                    };
                }
            }
        }

        this._collections.set(collection.name, updatedInfo);
        return updatedInfo;
    }

    async dropCollection(
        collectionName: string
    ): Promise<SearchCollectionInfo> {
        const existing = this._collections.get(collectionName);
        if (!existing) {
            throw new Error(`Collection ${collectionName} does not exist.`);
        }

        this._collections.delete(collectionName);
        return existing;
    }

    async getCollection(collectionName: string): Promise<SearchCollectionInfo> {
        const collection = this._collections.get(collectionName);
        if (!collection) {
            return null;
        }
        return collection;
    }

    async createDocument(
        collectionName: string,
        document: SearchDocument,
        action?: 'create' | 'upsert' | 'update' | 'emplace'
    ): Promise<SearchDocumentInfo> {
        const collection = this._collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection ${collectionName} does not exist.`);
        }

        const documentInfo: SearchDocumentInfo = {
            ...document,
            id: this._generateId(),
        };

        if (!this._documents.has(collectionName)) {
            this._documents.set(collectionName, []);
        }
        const documents = this._documents.get(collectionName);

        if (
            action === 'create' &&
            documents.some((doc) => doc.id === documentInfo.id)
        ) {
            throw new Error(
                `Document with id ${documentInfo.id} already exists in collection ${collectionName}.`
            );
        }

        if (action === 'update' || action === 'emplace') {
            const existingIndex = documents.findIndex(
                (doc) => doc.id === documentInfo.id
            );
            if (existingIndex !== -1) {
                documents[existingIndex] = documentInfo;
                return documentInfo;
            }
        }

        this._documents.set(collectionName, [...documents, documentInfo]);
        collection.numDocuments++;

        return documentInfo;
    }

    async deleteDocument(
        collectionName: string,
        documentId: string
    ): Promise<SearchDocumentInfo> {
        const collection = this._collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection ${collectionName} does not exist.`);
        }

        const documents = this._documents.get(collectionName);
        if (!documents) {
            throw new Error(
                `No documents found for collection ${collectionName}.`
            );
        }

        const documentIndex = documents.findIndex(
            (doc) => doc.id === documentId
        );
        if (documentIndex === -1) {
            throw new Error(
                `Document with id ${documentId} does not exist in collection ${collectionName}.`
            );
        }

        const [deletedDocument] = documents.splice(documentIndex, 1);
        collection.numDocuments--;

        return deletedDocument;
    }

    async createApiKey(apiKey: SearchApiKeyData): Promise<SearchApiKey> {
        const newApiKey: SearchApiKey = {
            ...apiKey,
            id: this._idCounter++,
            expiresAt:
                apiKey.expiresAt ||
                Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // Default to 100 year expiration
            value: 'api_key_' + this._idCounter,
        };
        this._apiKeys.push(newApiKey);

        return newApiKey;
    }
}
