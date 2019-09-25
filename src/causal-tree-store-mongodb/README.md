# Causal Tree Store MongoDB

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-store-mongodb.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-store-mongodb)

A causal tree store that interfaces with MongoDB.

## Usage

#### Create a MongoDB Causal Tree Store

```typescript
import { MongoDBTreeStore } from '@casual-simulation/causal-tree-store-mongodb';
import { MongoClient } from 'mongodb';

MongoClient.connect('mongodb://127.0.0.1:27017', client => {
    const store = new MongoDBTreeStore(client, 'my_db');

    store
        .init()
        .then(() => store.get('example'))
        .then(storedCausalTree => {
            // TODO: Create a CausalTree from the stored version
        });
});
```
