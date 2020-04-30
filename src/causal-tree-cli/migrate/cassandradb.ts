import { prompt } from 'inquirer';
import { Client as CassandraClient, DseClientOptions } from 'cassandra-driver';
import {
    CassandraDBObjectStore,
    CassandraDBCausalReposConfig,
    AwsKeyspacesRegion,
    AWS_KEYSPACES_REGION_MAP,
} from '@casual-simulation/causal-tree-store-cassandradb';
import AmazonRootCA1 from '@casual-simulation/causal-tree-store-cassandradb/certificates/AmazonRootCA1.pem';

export async function cassandraConnectionInfo(): Promise<
    CassandraDBObjectStore
> {
    const cassandraTypeAnswer = await prompt({
        type: 'list',
        name: 'type',
        message: 'What type of CassandraDB are you connecting to?',
        choices: ['Standard', 'Amazon Web Services'],
    });

    let options = {} as DseClientOptions;

    if (cassandraTypeAnswer.type === 'Standard') {
        const contactPointsAnswer = await prompt({
            type: 'input',
            name: 'contactPoints',
            message: 'What are the contact points? (Comma-separated)',
        });

        const contactPoints = contactPointsAnswer.contactPoints.split(',');
        options.contactPoints = contactPoints;

        const localDataCenter = await prompt({
            type: 'input',
            name: 'dataCenter',
            message: 'What is your local data center?',
            default: 'datacenter1',
        });

        options.localDataCenter = localDataCenter.dataCenter;
    } else {
        const region = await awsRegion();

        options.contactPoints = [region.endpoint];
        options.protocolOptions = {
            port: region.port,
        };

        options.localDataCenter = region.region;
        options.sslOptions = {
            rejectUnauthorized: true,
            ca: [AmazonRootCA1],
        };
    }

    const client = new CassandraClient(options);
    await client.connect();

    const config = await cassandraReposConfig(client);

    const store = new CassandraDBObjectStore(config, client);
    await store.init();

    return store;
}

async function cassandraReposConfig(
    client: CassandraClient
): Promise<CassandraDBCausalReposConfig> {
    const keyspacesResult = await client.execute(
        'SELECT keyspace_name from system_schema.keyspaces;'
    );

    const keyspaces = keyspacesResult.rows.map(r => r.get('keyspace_name'));

    const keyspaceAnswer = await prompt({
        type: 'list',
        name: 'keyspace',
        message: 'Which Keyspace do you want to use?',
        choices: keyspaces,
    });

    return {
        keyspace: keyspaceAnswer.keyspace,
        replication: null,
    };
}

async function awsRegion(): Promise<AwsKeyspacesRegion> {
    const awsRegionAnswer = await prompt({
        type: 'list',
        name: 'region',
        message: 'Which AWS Region are you in?',
        choices: [...AWS_KEYSPACES_REGION_MAP.keys()],
    });

    return AWS_KEYSPACES_REGION_MAP.get(awsRegionAnswer.region);
}
