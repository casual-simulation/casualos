# Causal Tree Store MongoDB

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-store-mongodb.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-store-mongodb)

A causal repo store that interfaces with MongoDB.

## Usage

#### Create a MongoDB Causal Repo Store

```typescript
import { MongoDBRepoStore } from '@casual-simulation/causal-tree-store-mongodb';
import { MongoClient } from 'mongodb';

MongoClient.connect('mongodb://127.0.0.1:27017', client => {
    const db = client.db('my_db');
    const objects = db.collection('objects');
    const heads = db.collection('heads');
    const store = new MongoDBRepoStore(objects, heads);

    store.init().then(() => {
        // TODO: Store or create objects and heads
    });
});
```
