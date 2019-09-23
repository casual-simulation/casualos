# Causal Tree Store Browser

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-tree-store-browser.svg)](https://www.npmjs.com/package/@casual-simulation/causal-tree-store-browser)

A causal tree store that stores data in Indexed DB.

## Usage

#### Create a Browser Causal Tree Store

```typescript
import { BrowserCausalTreeStore } from '@casual-simulation/causal-tree-store-browser';

demo();

async function demo() {
    const store = new BrowserCausalTreeStore();

    await store.init();

    const storedCausalTree = await store.get('example');

    // TODO: Create a causal tree from the stored version.
}
```
