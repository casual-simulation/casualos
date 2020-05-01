import { prompt } from 'inquirer';
import {
    Client as CassandraClient,
    DseClientOptions,
    ExecutionProfile,
    types,
} from 'cassandra-driver';
import {
    CassandraDBObjectStore,
    CassandraDBCausalReposConfig,
    AwsKeyspacesRegion,
    AWS_KEYSPACES_REGION_MAP,
    AWS_KEYSPACES_REGIONS,
} from '@casual-simulation/causal-tree-store-cassandradb';
import AmazonRootCA1 from '@casual-simulation/causal-tree-store-cassandradb/certificates/AmazonRootCA1.pem';
import {
    CausalRepoStore,
    CombinedCausalRepoStore,
} from '@casual-simulation/causal-trees';
import { mongoConnectionInfo } from './mongodb';

export async function cassandraAndMongoDBConnectionInfo(): Promise<
    CausalRepoStore
> {
    const objectStore = await casandraObjectStore();
    const mongoStore = await mongoConnectionInfo({
        urlMessage: 'Enter the destination MongoDB URL',
    });

    return new CombinedCausalRepoStore(mongoStore, objectStore);
}

async function casandraObjectStore() {
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
            host: region.endpoint,
            port: region.port,
            servername: region.endpoint,
            rejectUnauthorized: true,
            ca: [AmazonRootCA1],
        };
    }
    const readProfile = new ExecutionProfile('read', {
        consistency: types.consistencies.localOne,
    });
    const writeProfile = new ExecutionProfile('write', {
        consistency: types.consistencies.localQuorum,
    });
    const defaultProfile = new ExecutionProfile('default', {
        consistency: types.consistencies.localQuorum,
    });
    options.profiles = [readProfile, writeProfile, defaultProfile];

    const authenticationType = await prompt({
        type: 'list',
        name: 'type',
        message: 'Which Authentication type do you want to use?',
        choices: ['None', 'Username + Password'],
    });

    if (authenticationType.type === 'Username + Password') {
        let username = await prompt({
            type: 'input',
            name: 'username',
            message: 'Username:',
            validate: input => !!input && input.length > 0,
        });

        let password = await prompt({
            type: 'password',
            name: 'password',
            message: 'Password:',
            validate: input => !!input && input.length > 0,
        });

        options.credentials = {
            username: username.username,
            password: password.password,
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
        choices: AWS_KEYSPACES_REGIONS.map(region => ({
            name: `${region.region} (${region.name})`,
            value: region,
        })),
    });

    return awsRegionAnswer.region;
}
