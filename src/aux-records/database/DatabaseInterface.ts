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
 * Defines a basic interface that is able to interact with a multi-database engine.
 */
export interface DatabaseInterface<T> {
    /**
     * Creates a new database.
     * @param databaseName The name of the database.
     * @param options The options for creating the database.
     */
    createDatabase(
        databaseName: string,
        options: CreateDatabaseOptions
    ): Promise<Result<T, SimpleError>>;

    /**
     * Deletes the database with the given name.
     * @param databaseName The name of the database.
     */
    deleteDatabase(databaseName: string): Promise<Result<void, SimpleError>>;

    /**
     * Executes a read-only query on the given database.
     * @param database The database to execute the query on.
     * @param statements The statements to execute.
     * @param readonly Whether the query is read-only or not.
     * @param automaticTransaction Whether to automatically wrap the statements in a transaction if there are multiple statements.
     */
    query(
        database: T,
        statements: DatabaseStatement[],
        readonly: boolean,
        automaticTransaction: boolean
    ): Promise<Result<QueryResult[], SimpleError>>;
}

/**
 * Defines a statement that can be sent to the database.
 *
 * @dochash types/records/database
 * @docname DatabaseStatement
 */
export interface DatabaseStatement {
    /**
     * The query text of the statement.
     */
    query: string;

    /**
     * The parameters for the query.
     */
    params?: unknown[];
}

/**
 * Defiens an interface that represents the results of a single query.
 *
 * @dochash types/records/database
 * @docname RawQueryResult
 */
export interface QueryResult {
    /**
     * The columns that were returned with the query.
     */
    columns: string[];

    /**
     * The rows that were returned with the query.
     */
    rows: any[];

    /**
     * The number of rows that were affected by the query.
     */
    affectedRowCount: number;

    /**
     * The ID of the last row that was inserted.
     */
    lastInsertId?: number | string;
}

export interface CreateDatabaseOptions {
    /**
     * The maximum size of the database in bytes.
     */
    maxSizeBytes: number;
}

/**
 * Information about a database that is stored in turso.
 */
export interface TursoDatabase {
    /**
     * The name of the database.
     */
    name: string;

    /**
     * The hostname that should be used to connect to the database.
     */
    databaseHostname: string;

    /**
     * The ID of the database in turso.
     */
    databaseId: string;

    /**
     * The read token for the database in turso.
     */
    tursoDatabaseReadToken: string;

    /**
     * The write token for the database in turso.
     */
    tursoDatabaseWriteToken: string;
}

export interface SQliteDatabase {
    /**
     * The file path for the SQLite database.
     */
    filePath: string;
}
