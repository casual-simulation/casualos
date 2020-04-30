import { prompt } from 'inquirer';
import {
    CausalRepoStore,
    CausalObjectStore,
    CausalRepoObject,
} from '@casual-simulation/causal-trees';
import { MongoDBRepoStore } from '@casual-simulation/causal-tree-store-mongodb';
import {
    CassandraDBObjectStore,
    CassandraDBCausalReposConfig,
    AWS_KEYSPACES_REGION_MAP,
    AwsKeyspacesRegion,
} from '@casual-simulation/causal-tree-store-cassandradb';
import { connect } from 'mongodb';
import { Client as CassandraClient, DseClientOptions } from 'cassandra-driver';
import AmazonRootCA1 from '@casual-simulation/causal-tree-store-cassandradb/certificates/AmazonRootCA1.pem';

main().catch(err => {
    console.error(err);
    process.exit(1);
});

async function main() {
    // Menu structure:
    // - Load branch
    //   - From where? (MongoDB, CassandraDB)
    // - Migrate
    //   - From where?
    //      - To where?

    while (true) {
        await mainMenu();
    }
}

async function mainMenu() {
    const answer = await prompt({
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: ['Migrate'],
    });

    if (answer.action === 'Migrate') {
        await migrateMenu();
    } else {
        console.log('Invalid Choice');
    }
}

async function migrateMenu() {
    const sourceAnswer = await prompt({
        type: 'list',
        name: 'source',
        message: 'Where do you want to migrate from?',
        choices: ['MongoDB'],
    });

    const source = await connectionInfo(sourceAnswer.source);

    const destinationAnswer = await prompt({
        type: 'list',
        name: 'destination',
        message: 'Where do you want to migrate to?',
        choices: ['CassandraDB'],
    });

    const destination = await connectionInfo(destinationAnswer.destination);

    await migrate(source, destination);

    console.log(
        `Migrating from ${sourceAnswer.source} to ${
            destinationAnswer.destination
        }!`
    );
}

async function migrate(
    source: MigrationSource,
    destination: MigrationDestination
) {
    if (isRepoStore(source)) {
        const allBranches = await source.getBranches(null);
    } else {
        throw new Error(
            'It is currently not supported to migrate from a system that cannot list all the available branches.'
        );
    }
}

function isRepoStore(obj: MigrationSource): obj is CausalRepoStore {
    return 'getBranches' in obj;
}

type MigrationSource = CausalRepoStore | CausalObjectStore;
type MigrationDestination = CausalRepoStore | CausalObjectStore;

type ConnectionType = 'MongoDB' | 'CassandraDB';

async function connectionInfo(
    connectionType: ConnectionType
): Promise<CausalRepoStore | CausalObjectStore> {
    if (connectionType === 'MongoDB') {
        return mongoConnectionInfo();
    } else {
        return cassandraConnectionInfo();
    }
}

async function mongoConnectionInfo(): Promise<MongoDBRepoStore> {
    const urlAnswer = await prompt({
        type: 'input',
        name: 'url',
        message: 'Enter the MongoDB URL',
    });

    const client = await connect(
        urlAnswer.url,
        { useNewUrlParser: true }
    );

    const databasesResult = (await client
        .db()
        .admin()
        .listDatabases()) as {
        databases: {
            name: string;
        }[];
    };

    const databases = databasesResult.databases.map(d => d.name);

    const databaseAnswer = await prompt({
        type: 'list',
        name: 'database',
        message: 'Select the database',
        choices: databases,
    });

    const db = client.db(databaseAnswer.database);

    const objectsCollection = db.collection('objects');
    const headsCollection = db.collection('heads');

    const mongoStore = new MongoDBRepoStore(objectsCollection, headsCollection);
    await mongoStore.init();
    return mongoStore;
}

async function cassandraConnectionInfo(): Promise<CassandraDBObjectStore> {
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
