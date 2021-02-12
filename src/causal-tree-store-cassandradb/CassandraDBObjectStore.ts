import {
    CausalRepoObject,
    CausalObjectStore,
    getObjectHash,
    CausalRepoIndex,
} from '@casual-simulation/causal-trees';
import { Client, concurrent } from 'cassandra-driver';
import { sortBy, flatMap } from 'lodash';
import { CassandraDBCausalReposConfig } from './CassandraDBCausalReposConfig';

/**
 * Defines a CausalObjectStore that interfaces with CassandraDB.
 */
export class CassandraDBObjectStore implements CausalObjectStore {
    private _client: Client;
    private _config: CassandraDBCausalReposConfig;

    constructor(config: CassandraDBCausalReposConfig, client: Client) {
        this._config = config;
        this._client = client;
    }

    async init() {
        console.log('[CassandraDBObjectStore] Initializing...');
        await this._createKeyspaceIfNeeded();

        this._client.keyspace = this._config.keyspace;

        console.log('[CassandraDBObjectStore] Creating tables...');
        await this._client.execute(
            `CREATE TABLE IF NOT EXISTS objects (
                hash text,
                type text,
                data text,
                message text,
                idx text,
                time timestamp,
                previous_commit text,
                PRIMARY KEY (hash)
            ) WITH comment='Objects indexed by hash';`
        );
        await this._client.execute(
            `CREATE TABLE IF NOT EXISTS objects_by_head (
                head text,
                hash text,
                data text,
                PRIMARY KEY (head, hash)
            ) WITH comment='Objects indexed by head/branch'
              AND CLUSTERING ORDER BY (hash ASC);`
        );
        console.log('[CassandraDBObjectStore] Initialization Done.');
    }

    private async _createKeyspaceIfNeeded() {
        if (this._config.replication) {
            if (this._config.replication.class === 'SimpleStrategy') {
                console.log('[CassandraDBObjectStore] Using Simple Strategy');
                await this._client
                    .execute(`CREATE KEYSPACE IF NOT EXISTS ${this._config.keyspace} WITH replication = {
                        'class': 'SimpleStrategy',
                        'replication_factor': ${this._config.replication.replicationFactor}
                    };`);
            } else {
                console.log(
                    '[CassandraDBObjectStore] Using NetworkTopologyStrategy'
                );
                const replication = this._config.replication;
                const dataCenters = Object.keys(replication.dataCenters);
                const dataCenterReplications = dataCenters
                    .map((key) => `'${key}': '${replication.dataCenters[key]}'`)
                    .join(',\n');
                await this._client.execute(`CREATE KEYSPACE IF NOT EXISTS ${
                    this._config.keyspace
                } WITH replication = {
                        'class': 'NetworkTopologyStrategy',
                        'replication_factor': ${replication.replicationFactor}${
                    dataCenters.length > 0 ? ',' : ''
                }
                        ${dataCenterReplications}
                    };`);
            }
        }
    }

    async getObjects(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        if (this._config.behavior.allowInOperator) {
            return await this._getObjectsWithInOperator(head, keys);
        } else {
            return await this._getObjectsWithoutIn(head, keys);
        }
    }

    private async _getObjectsWithoutIn(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        const start = process.hrtime();
        try {
            const query = `SELECT * FROM objects_by_head WHERE head = ?`;
            const result = await this._client.execute(query, [head, keys], {
                prepare: true,
                fetchSize: 100_000,
                executionProfile: 'read',
            });
            const asyncResult = (<any>result) as {
                isPaged: () => boolean;
                [Symbol.asyncIterator]: any;
            };

            let queryTime = process.hrtime(start);
            console.log(
                `[CassandraDBObjectStore] Query took %d seconds and %d nanoseconds`,
                queryTime[0],
                queryTime[1]
            );

            let hashes = new Set(keys);
            let objects: CausalRepoObject[] = null;
            let totalObjects = 0;
            if (asyncResult.isPaged()) {
                console.log(`[CassandraDBObjectStore] Query is paged`);
                objects = [];
                // Use the async iterator to process
                // all the results.
                for await (const row of asyncResult) {
                    totalObjects += 1;
                    if (hashes.has(row.hash)) {
                        objects.push(JSON.parse(row.data));
                    }
                }
            } else {
                objects = [];
                totalObjects += result.rows.length;
                for (let row of result.rows) {
                    if (hashes.has(row.hash)) {
                        objects.push(JSON.parse(row.data));
                    }
                }
            }

            let filterTime = process.hrtime(queryTime);
            console.log(
                `[CassandraDBObjectStore] Filter took %d seconds and %d nanoseconds`,
                filterTime[0],
                filterTime[1]
            );

            console.log(
                `[CassandraDBObjectStore] Query returned ${objects.length} objects out of ${totalObjects} objects.`
            );
            return sortBy(objects, (o) =>
                o.type === 'atom' ? o.data.id.timestamp : -1
            );
        } finally {
            const [seconds, nanoseconds] = process.hrtime(start);
            console.log(
                `[CassandraDBObjectStore] Total took %d seconds and %d nanoseconds`,
                seconds,
                nanoseconds
            );
        }
    }

    private async _getObjectsWithInOperator(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        const query = `SELECT * FROM objects_by_head WHERE head = ? AND hash IN ?`;
        const result = await this._client.execute(query, [head, keys], {
            prepare: true,
            fetchSize: 100_000,
            executionProfile: 'read',
        });
        const asyncResult = (<any>result) as {
            isPaged: () => boolean;
            [Symbol.asyncIterator]: any;
        };

        let objects: CausalRepoObject[] = null;
        if (asyncResult.isPaged()) {
            objects = [];
            // Use the async iterator to process
            // all the results.
            for await (const row of asyncResult) {
                objects.push(JSON.parse(row.data));
            }
        } else {
            objects = result.rows.map((row) => JSON.parse(row.data));
        }
        return sortBy(objects, (o) =>
            o.type === 'atom' ? o.data.id.timestamp : -1
        );
    }

    async getObject(key: string): Promise<CausalRepoObject> {
        if (!key) {
            return null;
        }
        const query = `SELECT * FROM objects WHERE hash = ?`;
        const result = await this._client.execute(query, [key], {
            prepare: true,
            executionProfile: 'read',
        });
        const first = result.first();
        if (first) {
            const obj = JSON.parse(first.data);
            return obj;
        } else {
            return null;
        }
    }

    async storeObjects(
        head: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        const queries = flatMap(objects, (o) => {
            const hash = getObjectHash(o);
            const data = JSON.stringify(o);
            const message = o.type === 'commit' ? o.message : null;
            const index = o.type === 'commit' ? o.index : null;
            const time = o.type === 'commit' ? o.time : null;
            const previousCommit =
                o.type === 'commit' ? o.previousCommit : null;
            return [
                {
                    query: `UPDATE objects SET type = ?, data = ?, message = ?, idx = ?, time = ?, previous_commit = ? WHERE hash = ?`,
                    params: [
                        o.type,
                        data,
                        message,
                        index,
                        time,
                        previousCommit,
                        hash,
                    ],
                },
                {
                    query: `UPDATE objects_by_head SET data = ? WHERE head = ? AND hash = ?`,
                    params: [data, head, hash],
                },
            ];
        });

        if (queries.length <= 0) {
            return;
        }

        const results = await concurrent.executeConcurrent(
            this._client,
            queries,
            {
                executionProfile: 'write',
            }
        );

        for (let err of results.errors) {
            console.error(err);
        }
    }
}
