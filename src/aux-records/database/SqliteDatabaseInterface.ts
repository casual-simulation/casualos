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
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * Defines a database interface that uses in-memory SQLite databases.
 */
export class SqliteDatabaseInterface
    implements DatabaseInterface<SQliteDatabase>
{
    private _folderPath: string;
    #encryptionKey: string | null = null;

    constructor(folder: string, encryptionKey: string | null = null) {
        this._folderPath = folder;
        this.#encryptionKey = encryptionKey;
    }

    async createDatabase(
        databaseName: string,
        options: CreateDatabaseOptions
    ): Promise<Result<SQliteDatabase, SimpleError>> {
        const fullPath = this._getDatabasePath(databaseName);
        return success({
            filePath: fullPath,
        });
    }

    private _getDatabasePath(databaseName: string): string {
        const sanitized = sanitizeDatabaseName(databaseName);
        return path.resolve(this._folderPath, `${sanitized}.sqlite.db`);
    }

    async deleteDatabase(
        databaseName: string
    ): Promise<Result<void, SimpleError>> {
        const fullPath = this._getDatabasePath(databaseName);
        if (existsSync(fullPath)) {
            await rm(fullPath, {
                force: true,
            });
        }
        return success();
    }

    async query(
        database: SQliteDatabase,
        statements: DatabaseStatement[],
        readonly: boolean,
        automaticTransaction: boolean
    ): Promise<Result<QueryResult[], SimpleError>> {
        const options = {
            readonly,
            encryptionKey: this.#encryptionKey ?? undefined,
        };
        const db = new BetterSQLite3(database.filePath, options);
        try {
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
                        lastInsertId: result.lastInsertRowid || undefined,
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
        } finally {
            db.close();
        }
    }

    dispose() {}
}

function sanitizeDatabaseName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
