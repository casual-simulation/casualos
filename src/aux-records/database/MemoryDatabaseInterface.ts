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

import {
    failure,
    success,
    type Result,
    type SimpleError,
} from '@casual-simulation/aux-common';
import type {
    CreateDatabaseOptions,
    DatabaseInterface,
    QueryResult,
    SQliteDatabase,
} from './DatabaseInterface';
import Database from 'better-sqlite3';

export class MemoryDatabaseInterface
    implements DatabaseInterface<SQliteDatabase>
{
    // private _databases: SQliteDatabase[] = [];
    private _databases: Map<string, Database.Database> = new Map();

    async createDatabase(
        databaseName: string,
        options: CreateDatabaseOptions
    ): Promise<Result<SQliteDatabase, SimpleError>> {
        const db = new Database(':memory:');
        this._databases.set(databaseName, db);
        return success({
            filePath: databaseName,
        });
    }

    async deleteDatabase(
        databaseName: string
    ): Promise<Result<void, SimpleError>> {
        const db = this._databases.get(databaseName);
        if (!db) {
            return failure({
                errorCode: 'not_found',
                errorMessage: 'The database was not found.',
            });
        }
        db.close();
        this._databases.delete(databaseName);
        return success();
    }

    async execute(
        database: SQliteDatabase,
        query: string,
        params: any[]
    ): Promise<Result<QueryResult, SimpleError>> {}
}
