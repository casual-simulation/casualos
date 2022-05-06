# Development Setup

> Note: you can [open this repository using Gitpod.io](https://gitpod.io/#https://github.com/casual-simulation/casualos)
> for a cloud development environment that is setup with everything you need.

## Prerequisites

Make sure you have all the prerequisite tools installed:

-   [Node.js](https://nodejs.org/en/download/) v14.16.1 or later.
    -   If installing for the first time, it is reccommended that you install it via Node Version Manager. ([Mac][nvm-mac], [Windows][nvm-windows])
    -   Once NVM is installed, you can install the correct version of Node by running `nvm install v14.16.1` in your favorite terminal.
-   [Deno](https://deno.land/).
-   [Rancher Desktop](https://rancherdesktop.io/)
    -   Used to make development with extra services (MongoDB, Redis, etc.) easy.
    -   It works exactly like `docker`, except the command is `nerdctl`.
-   [AWS CLI](https://aws.amazon.com/cli/)
-   (Windows Only)[Visual Studio with C++ tools](https://visualstudio.microsoft.com/)(Windows Only)
    -   Select the "Desktop Development with C++" workflow.

## First Time Setup

1. Clone the repository.
    - `git clone https://github.com/casual-simulation/casualos.git`
2. Make sure global dependencies are installed.
    - `npm install -g lerna gulp node-gyp`
    - (Windows Only) [Tell NPM to use the global `node-gyp`.](https://github.com/nodejs/node-gyp/issues/2272) (Older versions of node-gyp cannot detect Visual Studio 2022)
        - Powershell: `npm prefix -g | % {npm config set node_gyp "$_\node_modules\node-gyp\bin\node-gyp.js"}`
3. (Optional) Add `casualos.localhost` to your [hosts file][hosts-file].
    - You can use this domain to prevent the service worker from installing.
    - Follow these steps:
        1. Open the hosts file as Sudo/Admin.
            - On Max/Linux it's at `/etc/hosts`
            - On Windows it's at `C:\Windows\System32\drivers\etc\hosts`
        2. Add entries to route `casualos.localhost` to `127.0.0.1`:
            ```
            127.0.0.1 casualos.localhost
            ```
4. Start related services:
    1. `nerdctl compose -f docker/docker-compose.dev.yml up -d`
5. Bootstrap the project.
    - `npm run bootstrap`
6. Install commit hooks.
    -   `npx husky install`

## Commands

When developing there are a couple of key commands you can run.
Most of them are NPM scripts, so they're easy to run.

-   Build & Run in Watch Mode
    -   `npm run watch`
    -   This will trigger Vite to start in watch mode and run nodemon.
    -   When ready, the server will be available at http://localhost:3000.
-   Build in Production Mode
    -   `npm run build`
    -   This will trigger Vite in production mode.
    -   The output files will be in the `dist` folders of each project.
-   Run tests In Watch Mode
    -   `npm run test:watch`
-   Run tests
    -   `npm test`

You can find other scripts in the `package.json` file at the root of the repository.

## Deployment Process

Making new releases for CasualOS is pretty simple. All that needs to happen is for the `master` branch to be updated and pushed to Github. From there a webhook is sent to the CI server which instructs it to make a new build and push it to production.

The version number shown in the app is taken from the most recent git tag. We additionally package the git commit hash just in case `master` is pushed multiple times without updating the git tag.

Additionally, the CI server will publish the `aux-common` NPM package whenever the version number in its `package.json` is updated.

**To make a new release, use this process:**

1. Make sure everything you want to release is ready and merged into `develop`.
2. Update the [CHANGELOG.md](./CHANGELOG.md) file with the next version number, date, and changes that were made since the last version.
3. Commit the updated CHANGELOG to the `develop` branch.
4. Merge the `develop` branch into the `master` branch.
    - Don't use [fast-forward](https://ariya.io/2013/09/fast-forward-git-merge). (`--no-ff`)
    - Don't push yet.
5. Run `lerna version`.
    - This will look at the changes made and prompt you for the next version number.
    - In most cases all you need to do is select **patch**.
    - After confirmation lerna will update the `package.json` version numbers, add a git tag, and push the branch.
6. You're done.
    - GitHub will send a webhook to the CI server which will make a build and publish everything.

## Analyze Build Bundle Size

You can analyze builds to see what is making them large and which dependencies are included.

1. Go to https://www.bundle-buddy.com/rollup
2. Run a build with `npm run build:server` (we only need the server to be built - not all the libraries)
3. Upload the dependency graph from `src/aux-server/aux-web/dist/dependency-graph.json`.
4. Upload the sourcemaps from `src/aux-server/aux-web/dist/assets`.
5. Advance to the analysis page by clicking the button at the bottom of the page.

## Projects

### [AUX Server](./src/aux-server/)

<a href="https://hub.docker.com/r/casualsimulation/aux">
    <img alt="AUX Docker Pulls" src="https://img.shields.io/docker/pulls/casualsimulation/aux?label=aux&logo=docker&logoColor=white"/>
</a>
<a href="https://hub.docker.com/r/casualsimulation/aux-arm32">
    <img alt="AUX ARM32 Docker Pulls" src="https://img.shields.io/docker/pulls/casualsimulation/aux-arm32?label=aux-arm32&logo=docker&logoColor=white"/>
</a>

A web application that serves the CasualOS experience. Built on the other projects.

### [AUX Common](./src/aux-common/)

<a href="https://www.npmjs.com/package/@casual-simulation/aux-common">
    <img alt="AUX Common NPM" src="https://img.shields.io/npm/v/@casual-simulation/aux-common/latest"/>
</a>

A library that contains common operations needed to modify and understand AUX files.

### [AUX VM](./src/aux-vm/)

<a href="https://www.npmjs.com/package/@casual-simulation/aux-vm">
    <img alt="AUX VM NPM" src="https://img.shields.io/npm/v/@casual-simulation/aux-vm/latest"/>
</a>

A set of abstractions and common utilities required to run an AUX on any platform.

#### Related libraries

-   [AUX VM Browser](./src/aux-vm-browser)
-   [AUX VM Client](./src/aux-vm-client)
-   [AUX VM Node](./src/aux-vm-node)

### [Causal Trees](./src/causal-trees/)

<a href="https://www.npmjs.com/package/@casual-simulation/aux-vm">
    <img alt="Causal Trees NPM" src="https://img.shields.io/npm/v/@casual-simulation/causal-trees/latest"/>
</a>

A library to create persistent, distributed, realtime, and conflict-free data types.

#### Related libraries

-   [Causal Tree Client Websocket](./src/causal-tree-client-native)
-   [Causal Tree Server](./src/causal-tree-server)
-   [Causal Tree Server Websocket](./src/causal-tree-server-websocket)
-   [Causal Tree Store Browser](./src/causal-tree-store-browser)
-   [Causal Tree Store MongoDB](./src/causal-tree-store-mongodb)

### [AUX Proxy](./src/aux-proxy/)

<a href="https://hub.docker.com/r/casualsimulation/aux-proxy">
    <img alt="AUX Docker Pulls" src="https://img.shields.io/docker/pulls/casualsimulation/aux-proxy?label=aux-proxy&logo=docker&logoColor=white"/>
</a>

A web service that can facilitate WebSocket tunnels from the external web to a device in an internal network.

### Miscellaneous

-   [Crypto](./src/crypto)
-   [Crypto Browser](./src/crypto-browser)
-   [Crypto Node](./src/crypto-node)
-   [Tunnel](./src/tunnel)
-   [AUX Benchmarks](./src/aux-benchmarks)

## Tools we use

Here's a list of the tools and packages that we're using to build CasualOS.

-   Dev tools
    -   [TypeScript](https://github.com/Microsoft/TypeScript) for type checking.
    -   [Vite](https://vitejs.dev/) and [esbuild](https://esbuild.github.io/) for bundling assets.
    -   [Lerna](https://github.com/lerna/lerna) for managing multiple NPM packages.
    -   [Gulp](https://gulpjs.com/) for minor tasks that Vite doesn't handle.
    -   [Jest](https://jestjs.io/) for testing.
        -   [ts-jest](https://kulshekhar.github.io/ts-jest/) for using TypeScript.
    -   [concurrently](https://github.com/kimmobrunfeldt/concurrently) for running multiple things at a time.
    -   [nodemon](https://nodemon.io/) for running node in watch mode.
    -   [Visual Studio Code](https://code.visualstudio.com/) for file editing and debugging.
    -   [TypeDoc](https://typedoc.org/) for API documentation generation.
    -   [Husky](https://github.com/typicode/husky) for pre-commit hooks.
-   Dependencies
    -   AUX Common
        -   [acorn](https://github.com/acornjs/acorn) for parsing listener functions.
            -   [acorn-jsx](https://github.com/acornjs/acorn-jsx) for parsing JSX code in listeners.
        -   [astring](https://github.com/davidbonnet/astring) for generating JS from acorn trees.
        -   [estraverse](https://github.com/estools/estraverse) for traversing the acorn trees and transforming them.
        -   [lodash](https://lodash.com/) for easy array/object manipulation.
        -   [lru-cache](https://github.com/isaacs/node-lru-cache) for caching formula transpilation results.
        -   [rxjs](https://github.com/ReactiveX/rxjs) for reactive programming.
        -   [uuid](https://github.com/kelektiv/node-uuid) for generating UUIDs.
        -   [base64-js](https://github.com/beatgammit/base64-js) for base64 encoding/decoding of binary data.
        -   [sha.js](https://github.com/crypto-browserify/sha.js/tree/master) for SHA hashing.
        -   [tweetnacl](https://github.com/dchest/tweetnacl-js) for Encryption/Decryption.
        -   [fast-json-stable-stringify](https://github.com/epoberezkin/fast-json-stable-stringify) for deterministic JSON serialization. (for hashing)
    -   AUX Server
        -   [vue](https://github.com/vuejs/vue) for JS <--> HTML UI binding.
            -   [vue-material](https://github.com/vuematerial/vue-material) for Material components.
            -   [vue-color](https://github.com/xiaokaike/vue-color) for color pickers.
            -   [@chenfengyuan/vue-qrcode](https://fengyuanchen.github.io/vue-qrcode/) for rendering QR Codes.
            -   [vue-router](https://github.com/vuejs/vue-router) for SPA routing.
            -   [vue-property-decorator](https://github.com/kaorun343/vue-property-decorator) for property decorators on Vue classes.
            -   [vue-class-component](https://github.com/vuejs/vue-class-component) for class decorators on Vue classes.
            -   [vue-shortkey](https://github.com/iFgR/vue-shortkey) for keyboard shortcuts.
        -   [three](https://threejs.org/) for 3D WebGL rendering.
            -   [troika-three-text](https://github.com/protectwise/troika/tree/master/packages/troika-three-text) for 3D text rendering.
        -   [express](http://expressjs.com/) for the HTTP server.
        -   [es6-promise](https://github.com/stefanpenner/es6-promise) for ES6-style promises.
        -   [filepond](https://github.com/pqina/filepond) for file uploads.
            -   [vue-filepond](https://github.com/pqina/vue-filepond) for Vue.js integration.
        -   [downloadjs](https://github.com/rndme/download) for file downloads.
        -   [mongodb](https://github.com/mongodb/node-mongodb-native) for MongoDB connections.

If you're using Visual Studio Code, I recommend getting the Jest extension. It makes it real easy to debug unit tests.

[nvm-mac]: https://github.com/creationix/nvm
[nvm-windows]: https://github.com/coreybutler/nvm-windows
[hosts-file]: https://en.wikipedia.org/wiki/Hosts_(file)
