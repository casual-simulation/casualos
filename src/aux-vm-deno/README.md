# AUX VM Deno

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-vm-deno.svg)](https://www.npmjs.com/package/@casual-simulation/aux-vm-deno)

A set of utilities required to run an AUX in [Deno](https://deno.land/).

## Installation

1. Install the NPM package

```
npm install @casual-simulation/aux-vm-deno
```

2. Add the `DenoEntry.ts` file to your Webpack config:

```
entry: {
    deno: path.resolve(
        __dirname,
        'node_modules',
        '@casual-simulation',
        'aux-vm-deno',
        'vm',
        'DenoEntry.ts'
    ),
},
```

3. Specify a specific output filename for the `deno` bundle.

```
output: {
    filename: (pathData) => {
        return pathData.chunk.name === 'deno' ? '[name].js' : '[name].[contenthash].js';
    },
}
```
