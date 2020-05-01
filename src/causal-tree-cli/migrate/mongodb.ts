import { prompt } from 'inquirer';
import { MongoDBRepoStore } from '@casual-simulation/causal-tree-store-mongodb';
import { connect, MongoClient } from 'mongodb';

export async function mongoConnectionInfo(
    opts = {
        urlMessage: 'Enter the source MongoDB URL',
    }
): Promise<MongoDBRepoStore> {
    const urlAnswer = await prompt({
        type: 'input',
        name: 'url',
        message: opts.urlMessage,
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
