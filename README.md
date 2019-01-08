# Process for Teams

The repository for the Process for Teams project.

# Developer Setup

1. Make sure you have Node 10.13.0 or later installed.
    - If this is your first time installing Node.js, install Node Version Manager ([Mac][nvm-mac], [Windows][nvm-windows]) to help manage different Node versions.
    - If/once you have NVM installed, you can install node 10.13.0 by running `nvm install 10.13.0`.
2. Make sure you have Docker ([Mac][docker-for-mac], [Windows][docker-for-windows]) installed.
3. Run `npm install` in the project directory
    - This command might take a while as NPM downloads and installs dependencies.
4. Go to Docker Menu (On top bar) -> Preferences... -> File Sharing and add the `/data` directory.
5. Run `docker-compose up -d`
    - This command might take a while as docker downloads and runs the mongo image and then boots up.
6. Run `npm run watch`
    - This will build the TypeScript into JavaScript and start the node server.
    - You can view the server at http://localhost:3000

## Run Tests

1. Run `npm test`.

To watch for changes and re-run tests, run `npx jest --watchAll`.


[docker-for-mac]: https://docs.docker.com/v17.12/docker-for-mac/install/
[docker-for-windows]: https://docs.docker.com/docker-for-windows/install/
[nvm-mac]: https://github.com/creationix/nvm
[nvm-windows]: https://github.com/coreybutler/nvm-windows
