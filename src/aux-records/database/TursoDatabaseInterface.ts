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
    TursoDatabase,
} from './DatabaseInterface';
import { traced } from '../tracing/TracingDecorators';
import { z } from 'zod';
import { createClient, LibsqlError } from '@libsql/client';

const TRACE_NAME = 'TursoDatabaseInterface';

const createDatabaseSchema = z.object({
    database: z.object({
        Hostname: z.string().min(1),
        DbId: z.string().min(1),
    }),
});

const createAuthTokenSchema = z.object({
    jwt: z.string().min(1),
});

export interface TursoDatabaseInterfaceOptions {
    /**
     * The auth token to use to authenticate to the API.
     */
    authToken: string;

    /**
     * The organization that operations should be performed in.
     */
    organizationSlug: string;

    /**
     * The name of the group that new databases should be created in.
     */
    groupName: string;
}

/**
 * Defines a database interface that uses databases hosted on turso.tech.
 */
export class TursoDatabaseInterface
    implements DatabaseInterface<TursoDatabase>
{
    private _organizationSlug: string;
    private _groupName: string;
    private _authToken: string;
    private _headers: HeadersInit;

    constructor(options: TursoDatabaseInterfaceOptions) {
        this._organizationSlug = options.organizationSlug;
        this._groupName = options.groupName;
        this._authToken = options.authToken;

        this._headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this._authToken}`,
        };
    }

    @traced(TRACE_NAME)
    async createDatabase(
        databaseName: string,
        options: CreateDatabaseOptions
    ): Promise<Result<TursoDatabase, SimpleError>> {
        console.log(
            `[${TRACE_NAME}] Creating database:`,
            databaseName,
            options
        );
        const createUrl = new URL(
            `https://api.turso.tech/v1/organizations/${encodeURIComponent(
                this._organizationSlug
            )}/databases`
        );
        const body: any = {
            group: this._groupName,
            name: databaseName,
        };

        if (options.maxSizeBytes) {
            body.size_limit = options.maxSizeBytes;
        }

        const result = await fetch(createUrl, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: this._headers,
        });

        if (!result.ok) {
            console.error(
                'Failed to create database:',
                result.status,
                await result.text()
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while creating the database.`,
            });
        }

        const data = await result.json();

        const parsed = createDatabaseSchema.safeParse(data);
        if (parsed.success === false) {
            console.error(
                'Failed to parse create database response:',
                parsed.error
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while creating the database.`,
            });
        }

        const databaseHostname = parsed.data.database.Hostname;
        const databaseId = parsed.data.database.DbId;

        // https://api.turso.tech/v1/organizations/{organizationSlug}/databases/{databaseName}/auth/tokens
        const createAuthTokenUrl = new URL(
            `https://api.turso.tech/v1/organizations/${encodeURIComponent(
                this._organizationSlug
            )}/databases/${encodeURIComponent(databaseName)}/auth/tokens`
        );

        const readTokenUrl = new URL(createAuthTokenUrl);
        readTokenUrl.searchParams.set('authorization', 'read-only');

        const writeTokenUrl = new URL(createAuthTokenUrl);
        writeTokenUrl.searchParams.set('authorization', 'full-access');

        const [readTokenResult, fullAccessResult] = await Promise.all([
            fetch(readTokenUrl, {
                method: 'POST',
                headers: this._headers,
            }),
            fetch(writeTokenUrl, {
                method: 'POST',
                headers: this._headers,
            }),
        ]);

        if (!readTokenResult.ok) {
            console.error(
                'Failed to create read token:',
                readTokenResult.status,
                await readTokenResult.text()
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while creating the database.`,
            });
        }
        if (!fullAccessResult.ok) {
            console.error(
                'Failed to create full access token:',
                fullAccessResult.status,
                await fullAccessResult.text()
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while creating the database.`,
            });
        }

        const readTokenData = await readTokenResult.json();
        const fullAccessData = await fullAccessResult.json();
        const parsedReadToken = createAuthTokenSchema.safeParse(readTokenData);
        const parsedFullAccessToken =
            createAuthTokenSchema.safeParse(fullAccessData);

        if (parsedReadToken.success === false) {
            console.error(
                'Failed to parse create read token response:',
                parsedReadToken.error
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while creating the database.`,
            });
        }

        if (parsedFullAccessToken.success === false) {
            console.error(
                'Failed to parse create full access token response:',
                parsedFullAccessToken.error
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while creating the database.`,
            });
        }

        console.log(`[${TRACE_NAME}] Database created:`, databaseName);

        const database: TursoDatabase = {
            name: databaseName,
            databaseHostname: databaseHostname,
            databaseId: databaseId,
            tursoDatabaseReadToken: parsedReadToken.data.jwt,
            tursoDatabaseWriteToken: parsedFullAccessToken.data.jwt,
        };

        return success(database);
    }

    @traced(TRACE_NAME)
    async deleteDatabase(
        databaseName: string
    ): Promise<Result<void, SimpleError>> {
        console.log(`[${TRACE_NAME}] Deleting database:`, databaseName);
        const deleteUrl = new URL(
            `https://api.turso.tech/v1/organizations/${encodeURIComponent(
                this._organizationSlug
            )}/databases/${encodeURIComponent(databaseName)}`
        );

        const result = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: this._headers,
        });

        if (!result.ok) {
            console.error(
                'Failed to delete database:',
                result.status,
                await result.text()
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: `A server error occurred while deleting the database.`,
            });
        }

        console.log(`[${TRACE_NAME}] Database deleted:`, databaseName);

        return success();
    }

    @traced(TRACE_NAME)
    async query(
        database: TursoDatabase,
        statements: DatabaseStatement[],
        readonly: boolean,
        automaticTransaction: boolean
    ): Promise<Result<QueryResult[], SimpleError>> {
        if (!automaticTransaction) {
            return failure({
                errorCode: 'invalid_request',
                errorMessage:
                    'Only automatic transactions are supported for Turso-hosted databases.',
            });
        }

        const client = createClient({
            url: `libsql://${database.databaseHostname}`,
            authToken: readonly
                ? database.tursoDatabaseReadToken
                : database.tursoDatabaseWriteToken,
            concurrency: 1,
        });

        try {
            const results = await client.batch(
                statements.map((s) => ({
                    sql: s.query,
                    args: s.params as any[],
                })),
                readonly ? 'read' : 'write'
            );

            return success(
                results.map(
                    (r) =>
                        ({
                            columns: r.columns,
                            rows: r.rows.map((r) => {
                                const row = new Array(r.length);
                                for (let i = 0; i < r.length; i++) {
                                    row[i] = r[i];
                                }
                                return row;
                            }),
                            affectedRowCount: r.rowsAffected,
                            lastInsertId:
                                r.lastInsertRowid !== null &&
                                r.lastInsertRowid !== undefined
                                    ? Number(r.lastInsertRowid)
                                    : undefined,
                        } satisfies QueryResult)
                )
            );
        } catch (err) {
            if (err instanceof LibsqlError) {
                console.error(`[${TRACE_NAME}] LibSQL query error:`, err);
                return failure({
                    errorCode: 'invalid_request',
                    errorMessage: err.message,
                });
            } else {
                throw err;
            }
        } finally {
            client.close();
        }
    }

    dispose() {}
}
