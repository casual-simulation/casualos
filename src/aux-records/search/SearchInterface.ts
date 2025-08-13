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
     * The nodes that should be used by clients to connect to the search engine.
     */
    readonly nodes: SearchNode[];

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

    /**
     * Searches for documents in the specified collection.
     * @param collectionName The name of the collection to search.
     * @param query The search query.
     */
    searchCollection(
        collectionName: string,
        query: SearchQuery
    ): Promise<SearchResult>;
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
    /**
     * The name of the field.
     */
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

/**
 * Defines a node that search clients can use to connect to the search engine.
 *
 * @dochash types/records/search
 * @docname SearchNode
 */
export interface SearchNode {
    /**
     * The host of the node.
     */
    host: string;

    /**
     * The port number of the node.
     */
    port: number;

    /**
     * The protocol to use when connecting to the node.
     */
    protocol?: 'http' | 'https';
}

export interface SearchQuery {
    /**
     * The query text to search for in the collection.
     *
     * Use `q: "*"` (wildcard operator) as the search string to return all documents. This is typically useful when used in conjunction with `filter_by`.
     *
     * For example, to return all documents that match a filter, use: `q=*&filter_by=num_employees:10`.
     *
     * Surround words with double quotes to do an exact phrase search. Eg: Setting `q` to `"tennis ball"` (including the surrounding double quotes) will only return documents that have those two words in that exact order, without any typo tolerance.
     *
     * To exclude words in your query explicitly, prefix the word with the `-` operator, e.g. `q: 'electric car -tesla'`.
     */
    q: string;

    /**
     * One or more field names that should be queried against.
     *
     * Separate multiple fields with a comma: `company_name, country`.
     *
     * The order of the fields is important: a record that matches on a field earlier in the list is considered more relevant than a record matched on a field later in the list. So, in the example above, documents that match on the `company_name` field are ranked above documents matched on the country field.
     *
     * Only string and string array fields can be used for full-text search in the `query_by` parameter. When you specify an object or object array field, Typesense uses the object(s)' children's string and string array fields automatically. You can read more about nested object fields here.
     */
    queryBy: string;

    // Filter parameters

    /**
     * Filter conditions for refining your search results.
     *
     * A field can be matched against one or more values.
     *
     * Examples:
     * - `country: USA`
     * - `country: [USA, UK]` returns documents that have country of USA OR UK.
     *
     * **Exact vs Non-Exact Filtering:**
     *
     * To match a string field's full value verbatim, you can use the `:=` (exact match) operator. For eg: `category := Shoe` will match documents with `category` set as `Shoe` and not documents with a `category` field set as `Shoe Rack`.
     *
     * Using the `:` (non-exact) operator will do a word-level partial match on the field, without taking token position into account (so is usually faster). Eg: `category:Shoe` will match records with `category` of `Shoe` or `Shoe Rack` or `Outdoor Shoe`.
     *
     * Tip: If you have a field that doesn't have any spaces in the values across any documents and want to filter on it, you want to use the `:` operator to improve performance, since it will avoid doing token position checks.
     *
     * **Escaping Special Characters:**
     *
     * You can also filter using multiple values and use the backtick character to denote a string literal: `category:= [`Running Shoes, Men`, `Sneaker (Men)`, Boots]`.
     *
     * **Negation:**
     *
     * Not equals / negation is supported via the `:!=` operator, e.g. `author:!=JK Rowling` or `id:!=[id1, id2]`. You can also negate multiple values: `author:!=[JK Rowling, Gilbert Patten]`
     *
     * To exclude results that _contains_ a specific string during filtering you can do `artist:! Jackson` will exclude all documents whose artist field value contains the word `jackson`.
     *
     * **Numeric Filtering:**
     *
     * Filter documents with numeric values between a min and max value, using the range operator `[min..max]` or using simple comparison operators `>`, `>=`, `<`, `<=`, `=`.
     *
     * You can enable `"range_index": true` on the numerical field schema for fast range queries (will incur additional memory usage for the index though).
     *
     * Examples:
     * -`num_employees:<40`
     * -`num_employees:[10..100]`
     * -`num_employees:[<10, >100]`
     * -`num_employees:[10..100, 140]` (Filter docs where value is between 10 to 100 or exactly 140).
     * -`num_employees:!= [10, 100, 140]` (Filter docs where value is **NOT** 10, 100 or 140).
     *
     * **Multiple Conditions:**
     *
     * You can separate multiple conditions with the `&&` operator.
     *
     * Examples:
     * - `num_employees:>100 && country: [USA, UK]`
     * - `categories:=Shoes && categories:=Outdoor`
     *
     * To do ORs across different fields (eg: color is blue OR category is Shoe), you can use the `||` operator.
     *
     * Examples:
     * - `color: blue || category: shoe`
     * - `(color: blue || category: shoe) && in_stock: true`
     *
     * **Filtering Arrays:**
     *
     * filter_by can be used with array fields as well.
     *
     * For eg: If `genres` is a `string[]` field:
     *
     * - `genres:=[Rock, Pop]` will return documents where the genres array field contains `Rock OR Pop`.
     * - `genres:=Rock && genres:=Acoustic` will return documents where the genres array field contains both `Rock AND Acoustic`.
     *
     * **Filtering Nested Arrays of Objects:**
     *
     * When filtering on fields inside nested array objects, you need to use a special syntax to ensure the filters are applied to the same object within the array. The syntax is: `<nested_field_parent>.{<filter_conditions>}`.
     *
     * For eg, if you have a document like this:
     *
     *      {"name": "Pasta", "ingredients": [ {"name": "cheese", "concentration": 40}, {"name": "spinach", "concentration": 10} ] }
     *
     * To filter on all dishes that have cheese with a concentration of less than 30, you would do:
     *
     *      filter_by: ingredients.{name:=cheese && concentration:<30}
     *
     * **Prefix filtering:**
     *
     * You can filter on records that begin with a given prefix string like this:
     *
     * `company_name: Acm*`
     *
     * This will will return documents where any of the words in the `company_name` field begin with `acm`, for e.g. a name like `Corporation of Acme`.
     *
     * You can combine the field-level match operator `:=` with prefix filtering like this:
     *
     * `name := S*`
     *
     * This will return documents that have name: `Steve Jobs` but not documents that have name: `Adam Stator`.
     *
     * **Geo Filtering:**
     *
     * Read more about [GeoSearch and filtering in this dedicated section](https://typesense.org/docs/29.0/api/geosearch.html).
     *
     * **Embedding Filters in API Keys:**
     *
     * You can embed the `filter_by` parameter (or parts of it) in a Scoped Search API Key to set up conditional access control for documents and/or enforce filters for any search requests that use that API key. Read more about [Scoped Search API Key](https://typesense.org/docs/29.0/api/api-keys.html#generate-scoped-search-key) in this dedicated section.
     */
    filterBy?: string;

    /**
     * A parameter that controls the search query.
     */
    [key: string]: any;
}

export type SearchResult = Result<
    {
        found: number;
        outOf: number;
        page: number;
        searchTimeMs: number;
        hits: SearchHit[];
    },
    SimpleError
>;

export interface SearchHit {
    document: SearchDocument;
    highlights?: SearchHighlight[];
    highlight: SearchHighlight;
    textMatch?: number;
}

export interface SearchHighlight {
    field: string;
    indices: [number, number];
    snippet: string;
    snippets?: string[];
    matchedTokens: string[][] | string[];
    value?: string;
}
