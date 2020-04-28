import {
    CausalRepoObject,
    CausalObjectStore,
    getObjectHash,
} from '@casual-simulation/causal-trees';
import { Client } from 'cassandra-driver';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import { CassandraDBCausalReposConfig } from 'server/config';

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
        if (this._config.replication.class === 'SimpleStrategy') {
            await this._client.execute(
                `
                CREATE KEYSPACE IF NOT EXISTS ? WITH replication = {
                    'class': 'SimpleStrategy',
                    'replication_factor': ?
                };
            `,
                [
                    this._config.keyspace,
                    this._config.replication.replicationFactor,
                ]
            );
        } else {
            const replication = this._config.replication;
            const dataCenters = Object.keys(replication.dataCenters);
            const dataCenterReplications = dataCenters
                .map(key => `'${key}': ?`)
                .join(',\n');
            const dataCenterParams = dataCenters.map(
                key => replication.dataCenters[key]
            );
            await this._client.execute(
                `
                CREATE KEYSPACE IF NOT EXISTS ? WITH replication = {
                    'class': 'NetworkTopologyStrategy',
                    'replication_factor': ?${dataCenters.length > 0 ? ',' : ''}
                    ${dataCenterReplications}
                };
            `,
                [
                    this._config.keyspace,
                    this._config.replication.replicationFactor,
                    ...dataCenterParams,
                ]
            );
        }
        await this._client.execute(
            `
            CREATE TABLE IF NOT EXISTS objects (
                hash text,
                type text,
                data text,
                message text,
                index text,
                time timestamp,
                previous_commit text,
                PRIMARY KEY (hash)
            ) WITH comment='Objects indexed by hash';

            CREATE TABLE IF NOT EXISTS objects_by_head (
                head text,
                hash text,
                data text,
                PRIMARY KEY (head, hash)
            ) WITH comment='Objects indexed by head/branch'
              AND CLUSTERING ORDER BY (hash ASC);
        `,
            []
        );
    }

    async getObjects(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        const query = `SELECT * FROM objects_by_head WHERE head = ? AND hash IN ?`;
        const result = await this._client.execute(query, [head, keys], {
            prepare: true,
            fetchSize: 100_000,
        });
        const objects = result.rows.map(row =>
            JSON.parse(row.data)
        ) as CausalRepoObject[];
        return sortBy(objects, o =>
            o.type === 'atom' ? o.data.id.timestamp : -1
        );
    }

    async getObject(key: string): Promise<CausalRepoObject> {
        const query = `SELECT * FROM objects WHERE hash = ?`;
        const result = await this._client.execute(query, [key], {
            prepare: true,
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
        const queries = flatMap(objects, o => {
            const hash = getObjectHash(o);
            const data = JSON.stringify(o);
            const message = o.type === 'commit' ? o.message : null;
            const index = o.type === 'commit' ? o.index : null;
            const time = o.type === 'commit' ? o.time : null;
            const previousCommit =
                o.type === 'commit' ? o.previousCommit : null;
            return [
                {
                    query: `UPDATE objects SET hash = ?, type = ?, data = ?, message = ?, index = ?, time = ?, previous_commit = ? WHERE hash = ?`,
                    parameters: [
                        hash,
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
                    query: `UPDATE objects_by_head SET head = ?, hash = ?, data = ? WHERE head = ? AND hash = ?`,
                    parameters: [head, hash, data, head, hash],
                },
            ];
        });

        await this._client.batch(queries, { prepare: true });
    }
}
