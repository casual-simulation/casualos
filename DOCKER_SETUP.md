# Docker Setup

## Setting up a Raspberry PI

1. Get a clean Raspbian installation on your Raspberry PI
2. Install docker ([source](https://medium.freecodecamp.org/the-easy-way-to-set-up-docker-on-a-raspberry-pi-7d24ced073ef))
    1. `curl -fsSL get.docker.com -o get-docker.sh && sh get-docker.sh`
    2. Setup to run without sudo:
        1. `sudo groupadd docker`
        2. `sudo gpasswd -a $USER docker`
        3. Logout and log back in.
    3. Setup to run at start ([source](https://docs.docker.com/install/linux/linux-postinstall/#configure-docker-to-start-on-boot)):
        1. `sudo systemctl enable docker`
        2. `sudo nano /etc/docker/daemon.json`
            ```
            {
            "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2375"]
            }
            ```
        3. `sudo systemctl restart docker.service`
        4. Test: `sudo netstat -lntp | grep dockerd`
3. Test that you can run an image on the Raspberry PI from another machine.
    1. `docker -H {your_pi_ip_address} run hello-world`

## Building an arm32v7 image on a Raspberry PI

Prerequisites:

1. Follow the steps above to setup a Raspberry PI with docker.
2. Make sure git is installed
    - `sudo apt-get install git`
3. Make sure NVM is installed
    - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash`
    - Make sure to run the commands they indicate so bash knows where to find nvm.
4. Make sure Node.js 10.13.0 or later is installed
    - `nvm install node`
5. Make sure lerna is installed
    - `npm install -g lerna`
6. Clone the aux repository
    - `git clone https://github.com/casual-simulation/aux.git`

Steps:

1. Pull the latest `master`
    - `git pull`
2. Run a build
    - `npm run bootstrap && npm run build:docker:arm32`
