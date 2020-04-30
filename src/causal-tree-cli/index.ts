import { prompt } from 'inquirer';
import {
    CausalRepoStore,
    CausalObjectStore,
} from '@casual-simulation/causal-trees';
import { MongoDBRepoStore } from '@casual-simulation/causal-tree-store-mongodb';
import { CassandraDBObjectStore } from '@casual-simulation/causal-tree-store-cassandradb';
import { connect } from 'mongodb';

main();

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

    const sourceInfo = await connectionInfoMenu(sourceAnswer.source);

    const destinationAnswer = await prompt({
        type: 'list',
        name: 'destination',
        message: 'Where do you want to migrate to?',
        choices: ['CassandraDB'],
    });

    const destinationInfo = await connectionInfoMenu(
        destinationAnswer.destination
    );

    console.log(
        `Migrating from ${sourceAnswer.source} to ${
            destinationAnswer.destination
        }!`
    );
}

type ConnectionType = 'MongoDB' | 'CassandraDB';

async function connectionInfoMenu(
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

    const client = await connect(urlAnswer.url);

    const databases = (await client
        .db()
        .admin()
        .listDatabases()) as string[];

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
    return null;
}
