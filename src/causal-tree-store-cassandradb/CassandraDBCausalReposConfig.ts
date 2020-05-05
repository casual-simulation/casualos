export interface CassandraDBCausalReposConfig {
    /**
     * The keyspace that should be used for the tables.
     */
    keyspace: string;

    /**
     * Options to control the behavior of the storage drivers.
     */
    behavior: {
        /**
         * Whether to structure queries so that they don't use the IN operator.
         */
        allowInOperator: boolean;
    };

    /**
     * The replication parameters that should be used for the keyspace.
     * If null, then creating the keyspace will be skipped.
     */
    replication: CassandraDBReplication | null;
}

export type CassandraDBReplication =
    | CassandraDBSimpleReplication
    | CassandraDBNetworkTopologyReplication;

export interface CassandraDBSimpleReplication {
    class: 'SimpleStrategy';
    replicationFactor: number;
}

export interface CassandraDBNetworkTopologyReplication {
    class: 'NetworkTopologyStrategy';
    replicationFactor: number;
    dataCenters: { [key: string]: any };
}
