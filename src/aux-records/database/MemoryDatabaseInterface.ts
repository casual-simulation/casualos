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
    DatabaseStatement,
    QueryResult,
    SQliteDatabase,
} from './DatabaseInterface';
import BetterSQLite3 from 'libsql';

/**
 * Defines a database interface that uses in-memory SQLite databases.
 */
export class MemoryDatabaseInterface
    implements DatabaseInterface<SQliteDatabase>
{
    private _databases: Map<string, BetterSQLite3.Database> = new Map();

    get databases() {
        return Array.from(this._databases.keys());
    }

    async createDatabase(
        databaseName: string,
        options: CreateDatabaseOptions
    ): Promise<Result<SQliteDatabase, SimpleError>> {
        const db = new BetterSQLite3(':memory:');
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

    async query(
        database: SQliteDatabase,
        statements: DatabaseStatement[],
        readonly: boolean,
        automaticTransaction: boolean
    ): Promise<Result<QueryResult[], SimpleError>> {
        try {
            const db = this._databases.get(database.filePath);

            if (!db) {
                return failure({
                    errorCode: 'not_found',
                    errorMessage: 'The database was not found.',
                });
            }

            const results: QueryResult[] = [];

            let hasTransaction = false;
            if (automaticTransaction) {
                db.exec('BEGIN;');
                hasTransaction = true;
            }

            for (let s of statements) {
                const q = db.prepare(s.query);

                if (q.reader) {
                    q.raw(true);
                    const columns = q.columns();
                    const rows = q.all(s.params);

                    results.push({
                        columns: columns.map((c) => c.name),
                        rows,
                        affectedRowCount: 0,
                    });
                } else {
                    if (readonly && !q.readonly) {
                        if (hasTransaction) {
                            db.exec('ROLLBACK;');
                        }

                        return failure({
                            errorCode: 'invalid_request',
                            errorMessage:
                                'Queries that modify data are not allowed in read-only mode.',
                        } as SimpleError);
                    }

                    const result = q.run(s.params);

                    results.push({
                        columns: [],
                        rows: [],
                        affectedRowCount: result.changes,
                        lastInsertId:
                            (result.lastInsertRowid as any) || undefined,
                    });
                }
            }

            if (hasTransaction) {
                db.exec('COMMIT;');
            }

            return success(results);
        } catch (err) {
            if (err instanceof BetterSQLite3.SqliteError) {
                return failure({
                    errorCode: 'server_error',
                    errorMessage: err.message,
                });
            } else {
                throw err;
            }
        }
    }

    dispose() {
        for (let db of this._databases.values()) {
            db.close();
        }
        this._databases.clear();
    }
}
