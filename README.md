# File Simulator

A monorepo that contains the AUX (Ambient User Experience) and SO4 packages.

# Projects

This repository contains the following projects:

- AUX Common
    - Library of common code for AUX projects.
    - Contains the AUX file format and basic primitives to enable realtime-web applications.
- AUX Server
    - Web application containing the AUX Projector and AUX Player.
    - Uses a Node.js server to distribute the files and WebSockets for realtime communication.
    - Build on top of AUX Common.

# Setup

## Prerequisites

Make sure you have all the prerequisite tools installed:

- [Node.js](https://nodejs.org/en/download/) 10.13.0 or later.
    - If installing for the first time, it is reccommended that you install it via Node Version Manager. ([Mac][nvm-mac], [Windows][nvm-windows])
    - Once NVM is installed, you can install the correct version of Node by running `nvm install 10.13.0` in your favorite terminal.
- Docker ([Mac][docker-for-mac], [Windows][docker-for-windows])
    - Used to make development with MongoDB easy.
    - Once installed, make sure the `/data` directory is shared with docker.
        - On Mac you can get to this via:
        - Docker Menu (On top bar) -> Preferences... -> File Sharing and add the `/data` directory.

## First Time Setup
1. Clone the repository.
    - `git clone https://github.com/yeticgi/file-simulator`
2. Make sure Lerna is installed.
    - `npm install -g lerna`
3. Bootstrap the project.
    - `npm run bootstrap`
3. Start MongoDB.
    1. `cd` to `src/aux-server`
    2. `docker-compose up -d`

## Commands

When developing there are a couple of key commands you can run.
Most of them are NPM scripts, so they're easy to run.

- Build & Run in Watch Mode
    - `npm run watch`
    - This will trigger webpack to start in watch mode and run nodemon.
    - When ready, the server will be available at http://localhost:3000.
- Build in Production Mode
    - `npm run build`
    - This will trigger Webpack in production mode.
    - The output files will be in the `dist` folders of each project.
- Test In Watch Mode
    - `npm run test:watch`
- Test
    - `npm test`
- Add a NPM Package
    - `lerna add <package-name>`
    - This will add the given NPM package to all of the projects.
- Add a NPM Package to a specific project
    - `lerna add <package-name> src/<project-name>`
    - This will add the given NPM package to all of the projects matching `src/<project-name>`

You can find other scripts in the `package.json` file at the root of the repository.

If you're using Visual Studio Code, I recommend getting the Jest extension. It makes it real easy to debug unit tests.

[docker-for-mac]: https://docs.docker.com/v17.12/docker-for-mac/install/
[docker-for-windows]: https://docs.docker.com/docker-for-windows/install/
[nvm-mac]: https://github.com/creationix/nvm
[nvm-windows]: https://github.com/coreybutler/nvm-windows
