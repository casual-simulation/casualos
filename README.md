# Process for Teams

The repository for the Process for Teams project.

# Setup

1. Make sure you have Node 10.13.0 installed.
2. Make sure you have [Docker for Mac][docker-for-mac] installed.
3. `npm install`
    - This command might take a while as NPM downloads and installs dependencies.
4. `sudo -u *username* ./scripts/gitlab_setup.sh`
    - This command creates a couple of folders that will be used for the Gitlab installation.
5. Go to Docker Menu (On top bar) -> Preferences... -> File Sharing and add the `/data` directory.
6. `docker-compose up -d`
    - This command will take a while as docker downloads and runs the gitlab image and then boots up.
    - Run `docker logs -f process-for-teams_gitlab_1` to see the logs as gitlab sets up.
7. `npm run watch`
    - This will build the TypeScript into JavaScript and start the node server.
    - You can view the server at http://localhost:3000


[docker-for-mac]: https://docs.docker.com/v17.12/docker-for-mac/install/